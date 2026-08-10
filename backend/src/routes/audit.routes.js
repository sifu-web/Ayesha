const express = require('express');
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 100);
  const { rows } = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
  res.json({ success: true, logs: rows });
});

module.exports = router;
