const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { isPilotAptToFly, checkDocExpiry } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ── GET /api/pilots ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.email, u.active AS user_active, u.last_login
       FROM pilots p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.role, p.name`
    );
    const pilots = result.rows.map(p => ({
      ...p,
      flightStatus: isPilotAptToFly(p) ? 'apt' : 'not_apt',
      docStatuses: {
        license:     checkDocExpiry(p.license_expiry),
        medical:     checkDocExpiry(p.medical_class1_expiry),
        huet:        checkDocExpiry(p.huet_expiry),
        bosiet:      checkDocExpiry(p.bosiet_expiry),
        annualCheck: checkDocExpiry(p.annual_check_expiry),
      },
    }));
    res.json(pilots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pilots' });
  }
});

// ── GET /api/pilots/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.email, u.active AS user_active, u.last_login
       FROM pilots p JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pilot not found' });
    const p = result.rows[0];
    res.json({
      ...p,
      flightStatus: isPilotAptToFly(p) ? 'apt' : 'not_apt',
      docStatuses: {
        license:     checkDocExpiry(p.license_expiry),
        medical:     checkDocExpiry(p.medical_class1_expiry),
        huet:        checkDocExpiry(p.huet_expiry),
        bosiet:      checkDocExpiry(p.bosiet_expiry),
        annualCheck: checkDocExpiry(p.annual_check_expiry),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pilot' });
  }
});

// ── POST /api/pilots — admin only ─────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name, email, password, role, aircraftAssigned, phone,
      totalHours, hoursAw169, licenseNumber, licenseType,
      licenseExpiry, medicalClass1Expiry, huetExpiry,
      bosietExpiry, annualCheckExpiry, weightLbs,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }

    await transaction(async (client) => {
      const hash     = await bcrypt.hash(password, 12);
      const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();

      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role, initials)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, email.toLowerCase(), hash, role, initials]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO pilots (user_id, name, email, role, aircraft_assigned, phone,
           total_hours, hours_aw169, license_number, license_type,
           license_expiry, medical_class1_expiry, huet_expiry, bosiet_expiry,
           annual_check_expiry, weight_lbs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          userId, name, email.toLowerCase(), role,
          aircraftAssigned || null, phone || null,
          totalHours || 0, hoursAw169 || 0,
          licenseNumber || null, licenseType || null,
          licenseExpiry || null, medicalClass1Expiry || null,
          huetExpiry || null, bosietExpiry || null, annualCheckExpiry || null,
          weightLbs || 187,
        ]
      );
    });

    res.status(201).json({ message: 'Pilot created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create pilot' });
  }
});

// ── PUT /api/pilots/:id — admin only ──────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name, role, aircraftAssigned, phone, totalHours, hoursAw169,
      licenseNumber, licenseType, licenseExpiry, medicalClass1Expiry,
      huetExpiry, bosietExpiry, annualCheckExpiry, active, password, weightLbs,
    } = req.body;

    await transaction(async (client) => {
      await client.query(
        `UPDATE pilots SET
           name=$1, role=$2, aircraft_assigned=$3, phone=$4,
           total_hours=$5, hours_aw169=$6, license_number=$7, license_type=$8,
           license_expiry=$9, medical_class1_expiry=$10, huet_expiry=$11,
           bosiet_expiry=$12, annual_check_expiry=$13, active=$14,
           weight_lbs=$15, updated_at=NOW()
         WHERE id=$16`,
        [
          name, role, aircraftAssigned || null, phone || null,
          totalHours || 0, hoursAw169 || 0,
          licenseNumber || null, licenseType || null,
          licenseExpiry || null, medicalClass1Expiry || null,
          huetExpiry || null, bosietExpiry || null, annualCheckExpiry || null,
          active !== undefined ? active : true,
          weightLbs || 187,
          req.params.id,
        ]
      );

      if (password) {
        const hash = await bcrypt.hash(password, 12);
        const pilotResult = await client.query(
          'SELECT user_id FROM pilots WHERE id=$1', [req.params.id]
        );
        if (pilotResult.rows[0]) {
          await client.query(
            'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2',
            [hash, pilotResult.rows[0].user_id]
          );
        }
      }
    });

    res.json({ message: 'Pilot updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pilot' });
  }
});

// ── PATCH /api/pilots/:id/toggle — admin only ─────────────────────────────
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `UPDATE pilots SET active = NOT active, updated_at = NOW()
       WHERE id = $1 RETURNING active`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pilot not found' });
    res.json({ active: result.rows[0].active });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle pilot' });
  }
});

module.exports = router;