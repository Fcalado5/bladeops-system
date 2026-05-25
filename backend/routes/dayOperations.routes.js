// ===========================================
// BLADEOPS — Day Operations Routes
// ===========================================

const express = require('express');
const { query } = require('../config/database');
const { authenticate, validateUUID } = require('../middleware/auth');
const { calcBlockTime, formatMinutes, isPilotAptToFly } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── GET /api/day-operations ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { date, pilotId, limit = 30, offset = 0, online } = req.query;

    if (online === 'true') {
      const today = new Date().toISOString().split('T')[0];
      const result = await query(
        `SELECT d.id, d.date, d.motor_on_time, d.status,
                cmd.name AS commander_name, cop.name AS copilot_name,
                cmd.id AS commander_pilot_id, cop.id AS copilot_pilot_id,
                a.registration AS aircraft_reg
         FROM day_operations d
         LEFT JOIN pilots cmd ON d.commander_id = cmd.id
         LEFT JOIN pilots cop ON d.copilot_id   = cop.id
         LEFT JOIN aircraft a ON d.aircraft_id  = a.id
         WHERE d.date = $1 AND d.status = 'open'`,
        [today]
      );
      return res.json(result.rows);
    }

    const where = [], params = [];
    let idx = 1;
    if (date) { where.push(`d.date = $${idx++}`); params.push(date); }

    if (req.user.role !== 'admin') {
      const pr = await query('SELECT id FROM pilots WHERE user_id = $1', [req.user.id]);
      if (pr.rows[0]) {
        where.push(`(d.commander_id = $${idx} OR d.copilot_id = $${idx})`);
        params.push(pr.rows[0].id); idx++;
      }
    } else if (pilotId) {
      where.push(`(d.commander_id = $${idx} OR d.copilot_id = $${idx})`);
      params.push(pilotId); idx++;
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(
      `SELECT d.id, d.date, d.motor_on_time, d.motor_off_time, d.status,
              d.total_block_minutes, d.total_nm, d.total_fuel_burn_lbs,
              d.total_passengers, d.initial_fuel_lbs, d.final_fuel_lbs,
              d.crew_weight_lbs, d.fuel_added_lbs, d.current_fuel_lbs,
              cmd.id AS commander_id, cmd.name AS commander_name,
              cop.id AS copilot_id,   cop.name AS copilot_name,
              a.registration AS aircraft_reg, a.type AS aircraft_type,
              COUNT(f.id) AS flight_count
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id   = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id  = a.id
       LEFT JOIN flights  f ON f.day_op_id    = d.id
       ${whereSQL}
       GROUP BY d.id, cmd.id, cmd.name, cop.id, cop.name, a.registration, a.type
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
              cop.name AS copilot_name,   cop.id AS copilot_pilot_id,
              a.registration AS aircraft_reg, a.type AS aircraft_type,
              a.mtow_lbs, a.operating_weight_lbs, a.pax_std_weight_lbs,
              a.empty_weight_lbs, a.crew_equip_lbs, a.max_fuel_lbs
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id   = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id  = a.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });
    const dayOp = dayResult.rows[0];

    if (req.user.role !== 'admin') {
      const pr = await query('SELECT id FROM pilots WHERE user_id = $1', [req.user.id]);
      const myId = pr.rows[0]?.id;
      if (myId !== dayOp.commander_pilot_id && myId !== dayOp.copilot_pilot_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const tripsResult = await query(
      `SELECT t.*,
              COUNT(f.id) AS leg_count,
              COALESCE(SUM(f.fuel_burn_lbs), 0)  AS trip_fuel_burn,
              COALESCE(SUM(f.passengers_drop), 0) AS trip_pax
       FROM trips t
       LEFT JOIN flights f ON f.trip_id = t.id
       WHERE t.day_op_id = $1
       GROUP BY t.id
       ORDER BY t.trip_number`,
      [req.params.id]
    );

    const flightsResult = await query(
      `SELECT f.*, fd.name AS from_name, td.name AS to_name
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id   = td.id
       WHERE f.day_op_id = $1
       ORDER BY f.flight_number`,
      [req.params.id]
    );

    const upliftsResult = await query(
      `SELECT u.*, t.trip_number
       FROM fuel_uplifts u
       LEFT JOIN trips t ON u.trip_id = t.id
       WHERE u.day_op_id = $1
       ORDER BY u.created_at ASC`,
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

    const totalBlockMin = tripsResult.rows.reduce((a, t) => a + (t.block_minutes || 0), 0);

    res.json({
      dayOperation: { ...dayOp, total_block_minutes: totalBlockMin },
      trips:    tripsResult.rows,
      flights:  flightsResult.rows,
      uplifts:  upliftsResult.rows,
      editLogs: editResult.rows,
      summary: {
        flightCount:     flightsResult.rows.length,
        tripCount:       tripsResult.rows.length,
        upliftCount:     upliftsResult.rows.length,
        totalUpliftLbs:  upliftsResult.rows.reduce((a, u) => a + (u.uplift_lbs || 0), 0),
        totalBlockTime:  formatMinutes(totalBlockMin),
        totalNM:         dayOp.total_nm            || 0,
        totalFuelBurn:   dayOp.total_fuel_burn_lbs || 0,
        totalPassengers: dayOp.total_passengers    || 0,
        finalFuel:       dayOp.final_fuel_lbs      || 0,
        crewWeightLbs:   dayOp.crew_weight_lbs     || 0,
      },
    });
  } catch (err) {
    console.error('GET day-op error:', err);
    res.status(500).json({ error: 'Failed to fetch day operation' });
  }
});

// ── POST /api/day-operations ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { commanderId, copilotId, aircraftId, motorOnTime, initialFuelLbs, date } = req.body;
    if (!commanderId || !copilotId || !aircraftId || !motorOnTime || !initialFuelLbs) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (commanderId === copilotId) {
      return res.status(400).json({ error: 'Commander and copilot cannot be the same person' });
    }

    const pr = await query('SELECT * FROM pilots WHERE id = $1', [commanderId]);
    if (pr.rows[0] && !isPilotAptToFly(pr.rows[0])) {
      return res.status(400).json({ error: 'Commander has expired documents' });
    }

    const cmdWt = await query('SELECT weight_lbs FROM pilots WHERE id = $1', [commanderId]);
    const copWt = await query('SELECT weight_lbs FROM pilots WHERE id = $1', [copilotId]);
    const crewWeight = (cmdWt.rows[0]?.weight_lbs || 187) + (copWt.rows[0]?.weight_lbs || 187);

    const opDate = date || new Date().toISOString().split('T')[0];

    const existing = await query(
      `SELECT id FROM day_operations WHERE aircraft_id = $1 AND date = $2 AND status = 'open'`,
      [aircraftId, opDate]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Open operation already exists for this aircraft today', existingId: existing.rows[0].id });
    }

    const copilotBusy = await query(
      `SELECT id FROM day_operations WHERE copilot_id = $1 AND date = $2 AND status = 'open'`,
      [copilotId, opDate]
    );
    if (copilotBusy.rows[0]) {
      return res.status(409).json({ error: 'Este copiloto já está em serviço hoje' });
    }

    const commanderBusy = await query(
      `SELECT id FROM day_operations WHERE commander_id = $1 AND date = $2 AND status = 'open'`,
      [commanderId, opDate]
    );
    if (commanderBusy.rows[0]) {
      return res.status(409).json({ error: 'Este comandante já tem operação aberta hoje' });
    }

    const result = await query(
      `INSERT INTO day_operations
         (date, commander_id, copilot_id, aircraft_id, motor_on_time,
          initial_fuel_lbs, current_fuel_lbs, crew_weight_lbs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'open') RETURNING id`,
      [opDate, commanderId, copilotId, aircraftId, motorOnTime, initialFuelLbs, crewWeight]
    );

    res.status(201).json({ id: result.rows[0].id, crewWeightLbs: crewWeight, message: 'Day operation opened' });
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
      return res.status(400).json({ error: 'Already closed' });
    }

    const tripsResult   = await query('SELECT * FROM trips WHERE day_op_id = $1', [req.params.id]);
    const flightsResult = await query('SELECT * FROM flights WHERE day_op_id = $1', [req.params.id]);
    const flights = flightsResult.rows;
    const trips   = tripsResult.rows;

    const totalBurn  = flights.reduce((a, f) => a + (f.fuel_burn_lbs   || 0), 0);
    const totalPax   = flights.reduce((a, f) => a + (f.passengers_drop || 0), 0);
    const totalNM    = flights.reduce((a, f) => a + (f.distance_nm     || 0), 0);
    const totalBlock = trips.reduce((a, t)   => a + (t.block_minutes   || 0), 0);
    const finalFuel  = day.current_fuel_lbs || day.initial_fuel_lbs || 0;

    await query(
      `UPDATE day_operations SET
         motor_off_time = $1, status = 'closed',
         total_block_minutes = $2, total_fuel_burn_lbs = $3,
         total_passengers = $4, total_nm = $5, final_fuel_lbs = $6,
         updated_at = NOW()
       WHERE id = $7`,
      [motorOffTime || null, totalBlock, totalBurn, totalPax, totalNM, finalFuel, req.params.id]
    );

    res.json({ message: 'Day operation closed', blockTime: formatMinutes(totalBlock) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close day operation' });
  }
});

// ── PATCH /api/day-operations/:id/reopen ─────────────────────────────────
router.patch('/:id/reopen', validateUUID, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Apenas admin pode reabrir operações' });

    const dayResult = await query(
      'SELECT * FROM day_operations WHERE id = $1', [req.params.id]
    );
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const day = dayResult.rows[0];

    if (day.status === 'open')
      return res.status(400).json({ error: 'Operação já está aberta' });
    if (day.status === 'signed')
      return res.status(400).json({ error: 'Operação já assinada — não pode ser reaberta' });
    if ((day.total_block_minutes || 0) >= 480)
      return res.status(400).json({ error: 'Limite de 8h atingido — não pode ser reaberta' });

    await query(
      `UPDATE day_operations SET
         status = 'open',
         motor_off_time = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Operação reaberta ✅' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reopen' });
  }
});

// ── PATCH /api/day-operations/:id/addfuel ────────────────────────────────
router.patch('/:id/addfuel', validateUUID, async (req, res) => {
  try {
    const { fuelAddedLbs, tripId, notes } = req.body;
    if (!fuelAddedLbs || fuelAddedLbs <= 0) {
      return res.status(400).json({ error: 'fuelAddedLbs inválido' });
    }

    const dayResult = await query(
      'SELECT initial_fuel_lbs, current_fuel_lbs, fuel_added_lbs FROM day_operations WHERE id = $1',
      [req.params.id]
    );
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Not found' });

    const day        = dayResult.rows[0];
    const fuelBefore = day.current_fuel_lbs > 0 ? day.current_fuel_lbs : (day.initial_fuel_lbs || 0);
    const fuelAfter  = fuelBefore + parseInt(fuelAddedLbs);
    const upliftTime = new Date().toTimeString().slice(0, 5);

    await query(
      `UPDATE day_operations SET
         fuel_added_lbs   = COALESCE(fuel_added_lbs, 0) + $1,
         current_fuel_lbs = $2,
         updated_at       = NOW()
       WHERE id = $3`,
      [parseInt(fuelAddedLbs), fuelAfter, req.params.id]
    );

    const upliftResult = await query(
      `INSERT INTO fuel_uplifts
         (day_op_id, trip_id, uplift_lbs, fuel_before_lbs, fuel_after_lbs, uplift_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        req.params.id,
        tripId || null,
        parseInt(fuelAddedLbs),
        fuelBefore,
        fuelAfter,
        upliftTime,
        notes || null,
      ]
    );

    res.json({
      id:        upliftResult.rows[0].id,
      message:   'Uplift registado ✅',
      upliftTime,
      fuelBefore,
      fuelAdded: parseInt(fuelAddedLbs),
      fuelAfter,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add fuel' });
  }
});

// ── PATCH /api/day-operations/:id/sign ───────────────────────────────────
router.patch('/:id/sign', validateUUID, async (req, res) => {
  try {
    const fieldMap = { admin:'signed_by_admin', pilot:'signed_by_commander', copilot:'signed_by_copilot' };
    const field = fieldMap[req.user.role];
    if (!field) return res.status(403).json({ error: 'Cannot sign' });
    const result = await query(
      `UPDATE day_operations SET ${field} = TRUE, signed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING signed_by_commander, signed_by_copilot, signed_by_admin`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];
    if (row.signed_by_commander && row.signed_by_copilot && row.signed_by_admin) {
      await query("UPDATE day_operations SET status = 'signed', updated_at = NOW() WHERE id = $1", [req.params.id]);
    }
    res.json({ message: 'Signed', signatures: row });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sign' });
  }
});

module.exports = router;