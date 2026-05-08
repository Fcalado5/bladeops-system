// ===========================================
// BLADEOPS — Day Operations Routes (FIXED)
// ===========================================

const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticate, requireAdmin, validateUUID } = require('../middleware/auth');
const { calcBlockTime, formatMinutes, isPilotAptToFly } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── GET /api/day-operations ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { date, pilotId, limit = 30, offset = 0 } = req.query;
    const where = [];
    const params = [];
    let idx = 1;

    if (date) { where.push(`d.date = $${idx++}`); params.push(date); }

    if (req.user.role !== 'admin') {
      const pilotResult = await query('SELECT id FROM pilots WHERE user_id = $1', [req.user.id]);
      if (pilotResult.rows[0]) {
        where.push(`(d.commander_id = $${idx} OR d.copilot_id = $${idx})`);
        params.push(pilotResult.rows[0].id);
        idx++;
      }
    } else if (pilotId) {
      where.push(`(d.commander_id = $${idx} OR d.copilot_id = $${idx})`);
      params.push(pilotId);
      idx++;
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await query(
      `SELECT d.id, d.date, d.motor_on_time, d.motor_off_time, d.status,
              d.total_block_minutes, d.total_nm, d.total_fuel_burn_lbs,
              d.total_passengers, d.initial_fuel_lbs, d.final_fuel_lbs,
              cmd.name AS commander_name, cop.name AS copilot_name,
              a.registration AS aircraft_reg, a.type AS aircraft_type,
              COUNT(f.id) AS flight_count
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id = a.id
       LEFT JOIN flights f ON f.day_op_id = d.id
       ${whereSQL}
       GROUP BY d.id, cmd.name, cop.name, a.registration, a.type
       ORDER BY d.date DESC, d.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch day operations' });
  }
});

// ── GET /api/day-operations/:id ───────────────────────────────────────────
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const dayResult = await query(
      `SELECT d.*,
              cmd.name AS commander_name, cmd.id AS commander_pilot_id,
              cop.name AS copilot_name, cop.id AS copilot_pilot_id,
              a.registration AS aircraft_reg, a.type AS aircraft_type,
              a.mtow_lbs, a.operating_weight_lbs, a.pax_std_weight_lbs
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id = a.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });
    const dayOp = dayResult.rows[0];

    if (req.user.role !== 'admin') {
      const pilotResult = await query('SELECT id FROM pilots WHERE user_id = $1', [req.user.id]);
      const myPilotId = pilotResult.rows[0]?.id;
      if (myPilotId !== dayOp.commander_pilot_id && myPilotId !== dayOp.copilot_pilot_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const flightsResult = await query(
      `SELECT f.*,
              fd.name AS from_name, fd.type AS from_type,
              td.name AS to_name, td.type AS to_type
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id = td.id
       WHERE f.day_op_id = $1
       ORDER BY f.flight_number`,
      [req.params.id]
    );

    const editResult = await query(
      `SELECT el.*, u.name AS approved_by_name
       FROM edit_logs el
       LEFT JOIN users u ON el.approved_by = u.id
       WHERE el.entity_type = 'flight'
         AND el.entity_id IN (SELECT id FROM flights WHERE day_op_id = $1)
       ORDER BY el.created_at DESC`,
      [req.params.id]
    );

    res.json({
      dayOperation: dayOp,
      flights: flightsResult.rows,
      editLogs: editResult.rows,
      summary: {
        flightCount: flightsResult.rows.length,
        totalBlockTime: formatMinutes(dayOp.total_block_minutes || 0),
        totalNM: dayOp.total_nm || 0,
        totalFuelBurn: dayOp.total_fuel_burn_lbs || 0,
        totalPassengers: dayOp.total_passengers || 0,
        finalFuel: dayOp.final_fuel_lbs || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch day operation' });
  }
});

// ── POST /api/day-operations ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { commanderId, copilotId, aircraftId, motorOnTime, initialFuelLbs, date } = req.body;

    if (!commanderId || !copilotId || !aircraftId || !motorOnTime || !initialFuelLbs) {
      return res.status(400).json({ error: 'commanderId, copilotId, aircraftId, motorOnTime and initialFuelLbs are required' });
    }

    // FIXED: Comandante e copiloto não podem ser a mesma pessoa
    if (commanderId === copilotId) {
      return res.status(400).json({ error: 'Commander and copilot cannot be the same person' });
    }

    // FIXED: require() movido para o topo do ficheiro
    const pilotResult = await query('SELECT * FROM pilots WHERE id = $1', [commanderId]);
    if (pilotResult.rows[0] && !isPilotAptToFly(pilotResult.rows[0])) {
      return res.status(400).json({ error: 'Commander has expired documents and is not apt to fly' });
    }

    const opDate = date || new Date().toISOString().split('T')[0];

    const existing = await query(
      `SELECT id FROM day_operations WHERE aircraft_id = $1 AND date = $2 AND status = 'open'`,
      [aircraftId, opDate]
    );
    if (existing.rows[0]) {
      return res.status(409).json({
        error: 'An open day operation already exists for this aircraft today',
        existingId: existing.rows[0].id,
      });
    }

    const result = await query(
      `INSERT INTO day_operations
         (date, commander_id, copilot_id, aircraft_id, motor_on_time, initial_fuel_lbs, status)
       VALUES ($1,$2,$3,$4,$5,$6,'open') RETURNING id`,
      [opDate, commanderId, copilotId, aircraftId, motorOnTime, initialFuelLbs]
    );

    res.status(201).json({ id: result.rows[0].id, message: 'Day operation opened' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create day operation' });
  }
});

// ── PATCH /api/day-operations/:id/close ──────────────────────────────────
router.patch('/:id/close', validateUUID, async (req, res) => {
  try {
    const { motorOffTime } = req.body;

    const dayResult = await query('SELECT * FROM day_operations WHERE id = $1', [req.params.id]);
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const day = dayResult.rows[0];

    if (day.status === 'closed' || day.status === 'signed') {
      return res.status(400).json({ error: 'Operation is already closed' });
    }

    const flightsResult = await query(
      'SELECT * FROM flights WHERE day_op_id = $1 ORDER BY flight_number',
      [req.params.id]
    );
    const flights = flightsResult.rows;

    // FIXED: fechar dia sem voos
    const lastFlight = flights.length > 0 ? flights[flights.length - 1] : null;

    const blockMin = day.motor_on_time && motorOffTime
      ? calcBlockTime(day.motor_on_time, motorOffTime)
      : (day.total_block_minutes || 0);

    const totalBurn = flights.reduce((a, f) => a + (f.fuel_burn_lbs || 0), 0);
    const totalPax  = flights.reduce((a, f) => a + (f.passengers_on_board || 0), 0);
    const totalNM   = flights.reduce((a, f) => a + (f.distance_nm || 0), 0);
    const finalFuel = lastFlight?.fuel_after_lbs ?? day.initial_fuel_lbs ?? 0;

    const closingMotorOff = motorOffTime
      || lastFlight?.arrival_time
      || day.motor_on_time
      || null;

    await query(
      `UPDATE day_operations SET
         motor_off_time = $1, status = 'closed',
         total_block_minutes = $2, total_fuel_burn_lbs = $3,
         total_passengers = $4, total_nm = $5, final_fuel_lbs = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [closingMotorOff, blockMin, totalBurn, totalPax, totalNM, finalFuel, req.params.id]
    );

    res.json({ message: 'Day operation closed', blockTime: formatMinutes(blockMin) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close day operation' });
  }
});

// ── PATCH /api/day-operations/:id/sign ───────────────────────────────────
router.patch('/:id/sign', validateUUID, async (req, res) => {
  try {
    const { role } = req.user;

    // FIXED: campo mapeado estaticamente — sem SQL injection
    const fieldMap = {
      admin:   'signed_by_admin',
      pilot:   'signed_by_commander',
      copilot: 'signed_by_copilot',
    };
    const field = fieldMap[role];
    if (!field) return res.status(403).json({ error: 'Cannot sign' });

    const result = await query(
      `UPDATE day_operations SET ${field} = TRUE, signed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING signed_by_commander, signed_by_copilot, signed_by_admin`,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];

    if (row.signed_by_commander && row.signed_by_copilot && row.signed_by_admin) {
      await query(
        "UPDATE day_operations SET status = 'signed', updated_at = NOW() WHERE id = $1",
        [req.params.id]
      );
    }

    res.json({ message: 'Signed', signatures: row });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sign' });
  }
});

module.exports = router;
