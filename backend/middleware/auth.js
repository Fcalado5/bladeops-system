// ===========================================
// BLADEOPS — Auth Middleware (FIXED)
// ===========================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// ── JWT Authentication ────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      'SELECT id, name, email, role, initials, active FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!result.rows[0] || !result.rows[0].active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── Role Guards ───────────────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requirePilot = (req, res, next) => {
  if (!['admin', 'pilot', 'copilot'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Pilot access required' });
  }
  next();
};

// ── UUID Validation ───────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUUID = (req, res, next) => {
  const id = req.params.id;
  if (id && !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
};

// ── Rate Limiter (FIXED — memory leak + counts only failed attempts) ───────
const loginAttempts = new Map();

// Auto cleanup every 15 min — prevents memory leak
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [ip, attempts] of loginAttempts.entries()) {
    const recent = attempts.filter(a => a.time > cutoff);
    if (recent.length === 0) loginAttempts.delete(ip);
    else loginAttempts.set(ip, recent);
  }
}, 15 * 60 * 1000);

const rateLimit = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const cutoff = now - 15 * 60 * 1000;
  const failedAttempts = (loginAttempts.get(ip) || [])
    .filter(a => a.time > cutoff && !a.success);

  if (failedAttempts.length >= 10) {
    return res.status(429).json({
      error: 'Too many failed login attempts. Try again in 15 minutes.',
    });
  }

  // Auth route calls this after result is known
  req._recordLoginAttempt = (success) => {
    const current = (loginAttempts.get(ip) || []).filter(a => a.time > cutoff);
    current.push({ time: now, success });
    loginAttempts.set(ip, current);
  };

  next();
};

module.exports = { authenticate, requireAdmin, requirePilot, validateUUID, rateLimit };
