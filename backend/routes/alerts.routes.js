// ===========================================
// BLADEOPS — Alerts Routes (FIXED)
// ===========================================

const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { checkDocExpiry, MAX_DAILY_HOURS_MIN } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const alerts = [];
    const today = new Date().toISOString().split('T')[0];
    const isAdmin = req.user.role === 'admin';
    const generatedAt = new Date().toISOString();

    // FIXED: myPilotId null check — admin sem perfil de piloto não falha
    let myPilotId = null;
    if (!isAdmin) {
      const pilotResult = await query(
        'SELECT id FROM pilots WHERE user_id = $1', [req.user.id]
      );
      myPilotId = pilotResult.rows[0]?.id || null;

      if (!myPilotId) {
        return res.json({ alerts: [], counts: { total: 0, danger: 0, warning: 0 }, generatedAt });
      }
    }

    const DOC_LABELS = {
      license_expiry:        'Licence',
      medical_class1_expiry: 'Medical Class 1',
      huet_expiry:           'HUET',
      bosiet_expiry:         'BOSIET',
      annual_check_expiry:   'Annual Check AW169',
    };

    // ── 1. Document expiry — admin vê todos, piloto vê só os seus ─────────
    const pilotsResult = isAdmin
      ? await query(`SELECT id, name, role, license_expiry, medical_class1_expiry,
                    huet_expiry, bosiet_expiry, annual_check_expiry FROM pilots WHERE active = TRUE`)
      : await query(`SELECT id, name, role, license_expiry, medical_class1_expiry,
                    huet_expiry, bosiet_expiry, annual_check_expiry
                    FROM pilots WHERE active = TRUE AND id = $1`, [myPilotId]);

    for (const p of pilotsResult.rows) {
      for (const [field, label] of Object.entries(DOC_LABELS)) {
        const s = checkDocExpiry(p[field]);
        if (s.status === 'expired') {
          alerts.push({
            type: 'doc_expiry', severity: 'danger',
            title: `${p.name} — ${label} expired`,
            message: `Expired ${Math.abs(s.daysLeft)} day(s) ago. Pilot is NOT apt to fly.`,
            pilotId: p.id, pilotName: p.name, generatedAt,
          });
        } else if (s.status === 'expiring_soon') {
          alerts.push({
            type: 'doc_expiry', severity: 'warning',
            title: `${p.name} — ${label} expires in ${s.daysLeft} day(s)`,
            message: `Renew before ${new Date(p[field]).toLocaleDateString('pt-PT')}.`,
            pilotId: p.id, pilotName: p.name, generatedAt,
          });
        } else if (s.status === 'missing') {
          alerts.push({
            type: 'doc_expiry', severity: 'danger',
            title: `${p.name} — ${label} missing`,
            message: `No record found. Please update pilot profile.`,
            pilotId: p.id, pilotName: p.name, generatedAt,
          });
        }
      }
    }

    // ── 2. Daily hours limit ───────────────────────────────────────────────
    const hoursQuery = isAdmin
      ? await query(
          `SELECT d.commander_id AS pilot_id, p.name,
                  COALESCE(SUM(f.duration_minutes), 0) AS total_minutes
           FROM day_operations d
           JOIN flights f ON f.day_op_id = d.id
           JOIN pilots p ON p.id = d.commander_id
           WHERE d.date = $1 GROUP BY d.commander_id, p.name
           UNION ALL
           SELECT d.copilot_id, p.name, COALESCE(SUM(f.duration_minutes), 0)
           FROM day_operations d
           JOIN flights f ON f.day_op_id = d.id
           JOIN pilots p ON p.id = d.copilot_id
           WHERE d.date = $1 GROUP BY d.copilot_id, p.name`, [today])
      : await query(
          `SELECT d.commander_id AS pilot_id, p.name,
                  COALESCE(SUM(f.duration_minutes), 0) AS total_minutes
           FROM day_operations d
           JOIN flights f ON f.day_op_id = d.id
           JOIN pilots p ON p.id = d.commander_id
           WHERE d.date = $1 AND d.commander_id = $2 GROUP BY d.commander_id, p.name
           UNION ALL
           SELECT d.copilot_id, p.name, COALESCE(SUM(f.duration_minutes), 0)
           FROM day_operations d
           JOIN flights f ON f.day_op_id = d.id
           JOIN pilots p ON p.id = d.copilot_id
           WHERE d.date = $1 AND d.copilot_id = $2 GROUP BY d.copilot_id, p.name`,
          [today, myPilotId]);

    for (const row of hoursQuery.rows) {
      const mins = parseInt(row.total_minutes);
      const pct  = Math.round((mins / MAX_DAILY_HOURS_MIN) * 100);
      if (mins >= MAX_DAILY_HOURS_MIN) {
        alerts.push({
          type: 'hours_limit', severity: 'danger',
          title: `${row.name} — Daily 8h limit reached`,
          message: `Flown ${Math.floor(mins/60)}h ${mins%60}m today. No more flights permitted.`,
          pilotName: row.name, pilotId: row.pilot_id, generatedAt,
        });
      } else if (pct >= 87) {
        const remaining = MAX_DAILY_HOURS_MIN - mins;
        alerts.push({
          type: 'hours_limit', severity: 'warning',
          title: `${row.name} — ${pct}% of daily limit`,
          message: `Only ${Math.floor(remaining/60)}h ${remaining%60}m remaining today.`,
          pilotName: row.name, pilotId: row.pilot_id, generatedAt,
        });
      }
    }

    // ── 3. Overweight flights ──────────────────────────────────────────────
    const overweightQuery = isAdmin
      ? await query(
          `SELECT f.id, f.flight_number, f.total_weight_lbs, a.mtow_lbs, d.date, cmd.name AS commander_name
           FROM flights f
           JOIN day_operations d ON f.day_op_id = d.id
           JOIN aircraft a ON d.aircraft_id = a.id
           JOIN pilots cmd ON d.commander_id = cmd.id
           WHERE f.total_weight_lbs > a.mtow_lbs AND d.date >= NOW() - INTERVAL '7 days'`)
      : await query(
          `SELECT f.id, f.flight_number, f.total_weight_lbs, a.mtow_lbs, d.date, cmd.name AS commander_name
           FROM flights f
           JOIN day_operations d ON f.day_op_id = d.id
           JOIN aircraft a ON d.aircraft_id = a.id
           JOIN pilots cmd ON d.commander_id = cmd.id
           WHERE f.total_weight_lbs > a.mtow_lbs
             AND d.date >= NOW() - INTERVAL '7 days'
             AND (d.commander_id = $1 OR d.copilot_id = $1)`, [myPilotId]);

    for (const f of overweightQuery.rows) {
      alerts.push({
        type: 'overweight', severity: 'danger',
        title: `Flight #${f.flight_number} exceeded MTOW`,
        message: `Weight ${f.total_weight_lbs.toLocaleString()} lbs exceeded MTOW ${f.mtow_lbs.toLocaleString()} lbs on ${new Date(f.date).toLocaleDateString('pt-PT')}.`,
        flightId: f.id, generatedAt,
      });
    }

    // ── 4. Aircraft maintenance — admin only ──────────────────────────────
    if (isAdmin) {
      const aircraft = await query(
        'SELECT id, registration, next_100h_check FROM aircraft WHERE active = TRUE'
      );
      for (const ac of aircraft.rows) {
        if (ac.next_100h_check) {
          const s = checkDocExpiry(ac.next_100h_check);
          if (s.status === 'expired') {
            alerts.push({
              type: 'maintenance', severity: 'danger',
              title: `${ac.registration} — 100h check overdue`,
              message: `Aircraft should be grounded until inspected.`,
              aircraftId: ac.id, generatedAt,
            });
          } else if (s.status === 'expiring_soon') {
            alerts.push({
              type: 'maintenance', severity: 'warning',
              title: `${ac.registration} — 100h check in ${s.daysLeft} days`,
              message: `Schedule maintenance before ${new Date(ac.next_100h_check).toLocaleDateString('pt-PT')}.`,
              aircraftId: ac.id, generatedAt,
            });
          }
        }
      }
    }

    alerts.sort((a, b) => a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1);

    res.json({
      alerts,
      generatedAt,
      counts: {
        total:   alerts.length,
        danger:  alerts.filter(a => a.severity === 'danger').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
      },
    });
  } catch (err) {
    console.error('Alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
