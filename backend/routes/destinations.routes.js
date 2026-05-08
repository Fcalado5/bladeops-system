const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET all destinations with their distances
router.get('/', async (req, res) => {
  try {
    const dests = await query('SELECT * FROM destinations WHERE active = TRUE ORDER BY name');
    const dists = await query(
      `SELECT d.from_dest_id, d.to_dest_id, d.distance_nm,
              f.name AS from_name, t.name AS to_name
       FROM distances d
       JOIN destinations f ON d.from_dest_id = f.id
       JOIN destinations t ON d.to_dest_id = t.id`
    );

    // Build distance map: { "FromName:ToName": nm }
    const distMap = {};
    dists.rows.forEach(r => {
      distMap[`${r.from_name}:${r.to_name}`] = r.distance_nm;
    });

    res.json({ destinations: dests.rows, distances: distMap });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

// GET distance between two destinations
router.get('/distance', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    const result = await query(
      `SELECT d.distance_nm
       FROM distances d
       JOIN destinations f ON d.from_dest_id = f.id
       JOIN destinations t ON d.to_dest_id = t.id
       WHERE (f.name = $1 AND t.name = $2) OR (f.name = $2 AND t.name = $1)
       LIMIT 1`,
      [from, to]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Distance not found', nm: 0 });
    res.json({ nm: result.rows[0].distance_nm });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch distance' });
  }
});

// POST new destination — admin only
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, type, coordinates, distances } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });

    const result = await query(
      `INSERT INTO destinations (name, type, coordinates)
       VALUES ($1, $2, $3) RETURNING id`,
      [name, type, coordinates || null]
    );
    const newId = result.rows[0].id;

    // Insert distances to all other destinations
    if (distances && typeof distances === 'object') {
      for (const [destName, nm] of Object.entries(distances)) {
        if (!nm || nm <= 0) continue;
        const destResult = await query(
          'SELECT id FROM destinations WHERE name = $1', [destName]
        );
        if (destResult.rows[0]) {
          const otherId = destResult.rows[0].id;
          await query(
            `INSERT INTO distances (from_dest_id, to_dest_id, distance_nm)
             VALUES ($1,$2,$3),($2,$1,$3)
             ON CONFLICT (from_dest_id, to_dest_id) DO UPDATE SET distance_nm = EXCLUDED.distance_nm`,
            [newId, otherId, nm]
          );
        }
      }
    }

    res.status(201).json({ id: newId, message: 'Destination created' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Destination already exists' });
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

// PUT update distances from a destination — admin only
router.put('/:id/distances', requireAdmin, async (req, res) => {
  try {
    const { distances } = req.body; // { destId: nm, ... }
    if (!distances) return res.status(400).json({ error: 'distances object required' });

    for (const [toId, nm] of Object.entries(distances)) {
      await query(
        `INSERT INTO distances (from_dest_id, to_dest_id, distance_nm)
         VALUES ($1,$2,$3),($2,$1,$3)
         ON CONFLICT (from_dest_id, to_dest_id) DO UPDATE SET distance_nm = EXCLUDED.distance_nm, updated_at = NOW()`,
        [req.params.id, toId, parseInt(nm)]
      );
    }

    res.json({ message: 'Distances updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update distances' });
  }
});

module.exports = router;
