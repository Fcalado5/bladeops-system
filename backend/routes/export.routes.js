const express = require('express');
const fs      = require('fs');
const { query }              = require('../config/database');
const { authenticate }       = require('../middleware/auth');
const { generateTechlogPDF } = require('../utils/pdf');

const router = express.Router();
router.use(authenticate);

router.get('/pdf/:id', async (req, res) => {
  try {
    // ── Day operation + aircraft ───────────────────────────────────
    const dayResult = await query(
      `SELECT d.*,
              cmd.name AS commander_name, cop.name AS copilot_name,
              a.registration AS aircraft_reg, a.type AS aircraft_type,
              a.mtow_lbs, a.operating_weight_lbs
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id   = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id  = a.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });

    // ── Trips ──────────────────────────────────────────────────────
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

    // ── Flights ────────────────────────────────────────────────────
    const flightsResult = await query(
      `SELECT f.*, fd.name AS from_name, td.name AS to_name
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id   = td.id
       WHERE f.day_op_id = $1
       ORDER BY f.flight_number`,
      [req.params.id]
    );

    // ── Uplifts ────────────────────────────────────────────────────
    const upliftsResult = await query(
      `SELECT u.*, t.trip_number
       FROM fuel_uplifts u
       LEFT JOIN trips t ON u.trip_id = t.id
       WHERE u.day_op_id = $1
       ORDER BY u.created_at ASC`,
      [req.params.id]
    );

    // ── Edit logs ──────────────────────────────────────────────────
    const editResult = await query(
      `SELECT * FROM edit_logs
       WHERE entity_type = 'flight'
         AND entity_id IN (SELECT id FROM flights WHERE day_op_id = $1)
       ORDER BY created_at`,
      [req.params.id]
    );

    const { filename, filepath } = await generateTechlogPDF(
      dayResult.rows[0],
      tripsResult.rows,
      flightsResult.rows,
      upliftsResult.rows,
      editResult.rows
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
    stream.on('end', () => fs.unlink(filepath, () => {}));

  } catch (err) {
    console.error('PDF export error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;