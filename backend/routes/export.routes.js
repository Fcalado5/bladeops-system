const express = require('express');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { generateTechlogPDF } = require('../utils/pdf');

const router = express.Router();
router.use(authenticate);

router.get('/pdf/:id', async (req, res) => {
  try {
    const dayResult = await query(
      `SELECT d.*,
              cmd.name AS commander_name, cop.name AS copilot_name,
              a.registration AS aircraft_reg, a.type AS aircraft_type
       FROM day_operations d
       LEFT JOIN pilots cmd ON d.commander_id = cmd.id
       LEFT JOIN pilots cop ON d.copilot_id = cop.id
       LEFT JOIN aircraft a ON d.aircraft_id = a.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!dayResult.rows[0]) return res.status(404).json({ error: 'Day operation not found' });

    const flightsResult = await query(
      `SELECT f.*, fd.name AS from_name, td.name AS to_name
       FROM flights f
       LEFT JOIN destinations fd ON f.from_dest_id = fd.id
       LEFT JOIN destinations td ON f.to_dest_id = td.id
       WHERE f.day_op_id = $1 ORDER BY f.flight_number`,
      [req.params.id]
    );

    const editResult = await query(
      `SELECT * FROM edit_logs
       WHERE entity_type = 'flight'
         AND entity_id IN (SELECT id FROM flights WHERE day_op_id = $1)
       ORDER BY created_at`,
      [req.params.id]
    );

    const { filename, filepath } = await generateTechlogPDF(
      dayResult.rows[0],
      flightsResult.rows,
      editResult.rows
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(filepath, () => {});
    });
  } catch (err) {
    console.error('PDF export error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
