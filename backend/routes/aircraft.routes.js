const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM aircraft ORDER BY registration');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch aircraft' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM aircraft WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Aircraft not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch aircraft' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      registration, type, mtowLbs, emptyWeightLbs, crewEquipLbs,
      operatingWeightLbs, maxPassengers, maxFuelLbs, cruiseSpeedKts,
      paxStdWeightLbs,
    } = req.body;

    if (!registration || !type) {
      return res.status(400).json({ error: 'registration and type are required' });
    }

    const result = await query(
      `INSERT INTO aircraft (registration, type, mtow_lbs, empty_weight_lbs, crew_equip_lbs,
         operating_weight_lbs, max_passengers, max_fuel_lbs, cruise_speed_kts, pax_std_weight_lbs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        registration.toUpperCase(), type,
        mtowLbs || 10560, emptyWeightLbs || 6834, crewEquipLbs || 1074,
        operatingWeightLbs || 7908, maxPassengers || 12, maxFuelLbs || 2200,
        cruiseSpeedKts || 155, paxStdWeightLbs || 187,
      ]
    );

    res.status(201).json({ id: result.rows[0].id, message: 'Aircraft created' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Registration already exists' });
    res.status(500).json({ error: 'Failed to create aircraft' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      registration, type, mtowLbs, emptyWeightLbs, crewEquipLbs,
      operatingWeightLbs, maxPassengers, maxFuelLbs, cruiseSpeedKts,
      paxStdWeightLbs, active,
    } = req.body;

    await query(
      `UPDATE aircraft SET
         registration=$1, type=$2, mtow_lbs=$3, empty_weight_lbs=$4, crew_equip_lbs=$5,
         operating_weight_lbs=$6, max_passengers=$7, max_fuel_lbs=$8,
         cruise_speed_kts=$9, pax_std_weight_lbs=$10, active=$11, updated_at=NOW()
       WHERE id=$12`,
      [
        registration, type, mtowLbs, emptyWeightLbs, crewEquipLbs,
        operatingWeightLbs, maxPassengers, maxFuelLbs, cruiseSpeedKts,
        paxStdWeightLbs, active !== undefined ? active : true,
        req.params.id,
      ]
    );

    res.json({ message: 'Aircraft updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update aircraft' });
  }
});

module.exports = router;
