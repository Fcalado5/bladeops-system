// ===========================================
// BLADEOPS — Trips Routes (Rotor ON/OFF)
// ===========================================

const express = require('express');
const { query } = require('../config/database');
const { authenticate, validateUUID } = require('../middleware/auth');
const { calcBlockTime, formatMinutes } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── GET /api/trips?dayOpId=xxx ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { dayOpId } = req.query;
    if (!dayOpId) return res.status(400).json({ error: 'dayOpId required' });

    const result = await query(
      `SELECT t.*,
              COUNT(f.id) AS leg_count,
              COALESCE(SUM(f.fuel_burn_lbs), 0) AS total_fuel_burn,
              COALESCE(SUM(f.passengers_drop), 0) AS total_pax
       FROM trips t
       LEFT JOIN flights f ON f.trip_id = t.id
       WHERE t.day_op_id = $1
       GROUP BY t.id
       ORDER BY t.trip_number`,
      [dayOpId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// ── POST /api/trips — Rotor ON ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { dayOpId, rotorOnTime } = req.body;
    if (!dayOpId || !rotorOnTime) {
      return res.status(400).json({ error: 'dayOpId and rotorOnTime required' });
    }

    const dayResult = await query('SELECT * FROM day_operations WHERE id = $1', [dayOpId]);
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });
    if (['closed', 'signed'].includes(dayResult.rows[0].status)) {
      return res.status(400).json({ error: 'Day operation is already closed' });
    }

    // Verifica se já há um trip aberto (sem rotor_off)
    const openTrip = await query(
      `SELECT id FROM trips WHERE day_op_id = $1 AND rotor_off_time IS NULL`,
      [dayOpId]
    );
    if (openTrip.rows[0]) {
      return res.status(409).json({ error: 'Já existe um trip com o motor ligado. Faz Rotor OFF primeiro.' });
    }

    const countResult = await query(
      'SELECT COUNT(*) FROM trips WHERE day_op_id = $1', [dayOpId]
    );
    const tripNumber = parseInt(countResult.rows[0].count) + 1;

    const result = await query(
      `INSERT INTO trips (day_op_id, trip_number, rotor_on_time)
       VALUES ($1, $2, $3) RETURNING *`,
      [dayOpId, tripNumber, rotorOnTime]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// ── PATCH /api/trips/:id/rotoroff — Rotor OFF ─────────────────────────────
router.patch('/:id/rotoroff', validateUUID, async (req, res) => {
  try {
    const { rotorOffTime } = req.body;
    if (!rotorOffTime) return res.status(400).json({ error: 'rotorOffTime required' });

    const tripResult = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (!tripResult.rows[0]) return res.status(404).json({ error: 'Trip not found' });

    const trip = tripResult.rows[0];
    const blockMin = calcBlockTime(trip.rotor_on_time, rotorOffTime);

    await query(
      `UPDATE trips SET rotor_off_time = $1, block_minutes = $2, updated_at = NOW()
       WHERE id = $3`,
      [rotorOffTime, blockMin, req.params.id]
    );

    // Actualiza total block minutes na operação
    await query(
      `UPDATE day_operations SET
         total_block_minutes = (
           SELECT COALESCE(SUM(block_minutes), 0) FROM trips WHERE day_op_id = $1
         ),
         updated_at = NOW()
       WHERE id = $1`,
      [trip.day_op_id]
    );

    res.json({ blockMinutes: blockMin, blockTime: formatMinutes(blockMin) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record rotor off' });
  }
});

module.exports = router;