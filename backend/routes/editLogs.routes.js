const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { entityType, entityId, limit = 50, offset = 0 } = req.query;
    const where = [];
    const params = [];
    let idx = 1;
    if (entityType) { where.push(`entity_type = $${idx++}`); params.push(entityType); }
    if (entityId)   { where.push(`entity_id = $${idx++}`);   params.push(entityId); }
    const sql = `SELECT * FROM edit_logs ${where.length ? 'WHERE '+where.join(' AND ') : ''}
                 ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`;
    const result = await query(sql, [...params, parseInt(limit), parseInt(offset)]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch edit logs' });
  }
});

router.patch('/:id/approve', requireAdmin, async (req, res) => {
  try {
    await query(
      'UPDATE edit_logs SET approved_by=$1, approved_at=NOW() WHERE id=$2',
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Edit approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve edit' });
  }
});

module.exports = router;
