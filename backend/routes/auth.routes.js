// ===========================================
// BLADEOPS — Auth Routes (WITH REFRESH TOKEN)
// ===========================================

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { query } = require('../config/database');
const { authenticate, rateLimit } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

function generateRefreshToken() {
  // Cryptographically secure random token
  return crypto.randomBytes(64).toString('hex');
}

async function saveRefreshToken(userId, token, req) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, token, expiresAt, req.headers['user-agent'] || null, req.ip]
  );
}

async function revokeRefreshToken(token) {
  await query(
    'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token = $1',
    [token]
  );
}

// Cleanup expired tokens periodically (runs every 24h on first request after midnight)
let lastCleanup = null;
async function cleanupExpiredTokens() {
  const now = new Date();
  if (lastCleanup && (now - lastCleanup) < 24 * 60 * 60 * 1000) return;
  lastCleanup = now;
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE');
}

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', rateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.initials, u.active,
              p.id AS pilot_id, p.aircraft_assigned
       FROM users u
       LEFT JOIN pilots p ON p.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user) {
      req._recordLoginAttempt?.(false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.active) {
      req._recordLoginAttempt?.(false);
      return res.status(403).json({ error: 'Account is inactive. Contact administrator.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      req._recordLoginAttempt?.(false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req._recordLoginAttempt?.(true);
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Check pilot docs
    let docWarnings = [];
    if (user.pilot_id && ['pilot', 'copilot'].includes(user.role)) {
      const docResult = await query(
        `SELECT license_expiry, medical_class1_expiry, huet_expiry, bosiet_expiry, annual_check_expiry
         FROM pilots WHERE id = $1`,
        [user.pilot_id]
      );
      if (docResult.rows[0]) {
        const docs = docResult.rows[0];
        const now  = new Date();
        const fields = {
          'Licence':            docs.license_expiry,
          'Medical Class 1':    docs.medical_class1_expiry,
          'HUET':               docs.huet_expiry,
          'BOSIET':             docs.bosiet_expiry,
          'Annual Check AW169': docs.annual_check_expiry,
        };
        for (const [name, exp] of Object.entries(fields)) {
          if (!exp) {
            docWarnings.push({ field: name, status: 'missing' });
          } else {
            const days = Math.floor((new Date(exp) - now) / 86400000);
            if (days < 0)  docWarnings.push({ field: name, status: 'expired', daysLeft: days });
            else if (days < 30) docWarnings.push({ field: name, status: 'expiring_soon', daysLeft: days });
          }
        }
      }
    }

    // Generate tokens
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken, req);

    // Cleanup expired tokens in background
    cleanupExpiredTokens().catch(() => {});

    res.json({
      token: accessToken,
      refreshToken,
      expiresIn: 2 * 60 * 60, // 2h in seconds
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        pilotId: user.pilot_id,
        aircraftAssigned: user.aircraft_assigned,
      },
      docWarnings,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Validate refresh token in DB
    const tokenResult = await query(
      `SELECT rt.*, u.id AS uid, u.name, u.email, u.role, u.initials, u.active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1`,
      [refreshToken]
    );

    const tokenRow = tokenResult.rows[0];

    if (!tokenRow) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (tokenRow.revoked) {
      // Token was revoked — possible token theft, revoke ALL tokens for this user
      await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [tokenRow.user_id]);
      return res.status(401).json({ error: 'Refresh token revoked. Please login again.' });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
    }

    if (!tokenRow.active) {
      return res.status(401).json({ error: 'Account is inactive. Contact administrator.' });
    }

    // Rotate refresh token (revoke old, issue new)
    await revokeRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken();
    await saveRefreshToken(tokenRow.user_id, newRefreshToken, req);

    // Issue new access token
    const newAccessToken = generateAccessToken({
      id:   tokenRow.uid,
      role: tokenRow.role,
      name: tokenRow.name,
    });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 2 * 60 * 60,
    });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.initials, u.last_login,
              p.id AS pilot_id, p.aircraft_assigned, p.total_hours, p.hours_aw169
       FROM users u
       LEFT JOIN pilots p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0] || req.user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'New password must be different from current' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid  = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    // Revoke all refresh tokens after password change for security
    await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [req.user.id]);

    res.json({ message: 'Password updated successfully. Please login again.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
