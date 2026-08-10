const crypto = require('crypto');
const db = require('../config/db');
const { logAction } = require('../utils/audit');

const DURATION_MS = {
  one_time: null,
  '1_hour': 60 * 60 * 1000,
  '1_day': 24 * 60 * 60 * 1000,
  '1_week': 7 * 24 * 60 * 60 * 1000,
  '1_month': 30 * 24 * 60 * 60 * 1000,
};

/** Generates a secure random key formatted as readable dash-separated groups. */
function generateSecureKey() {
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase(); // 32 hex chars
  return raw.match(/.{1,4}/g).join('-');
}

/** Adds a computed, always-current status and remaining time to a key row. */
function computeKeyView(key) {
  const now = Date.now();
  let status = key.status;

  if (status !== 'revoked') {
    if (key.duration_type === 'one_time') {
      status = key.used_at ? 'used' : 'active';
    } else if (key.expires_at) {
      status = new Date(key.expires_at).getTime() < now ? 'expired' : 'active';
    }
  }

  let remainingSeconds = 0;
  if (status === 'active') {
    remainingSeconds = key.expires_at
      ? Math.max(0, Math.floor((new Date(key.expires_at).getTime() - now) / 1000))
      : null; // one-time keys: valid until first use, no countdown
  }

  return { ...key, status, remaining_seconds: remainingSeconds };
}

async function generateKey(req, res) {
  const { durationType } = req.body;
  const keyValue = generateSecureKey();
  const ms = DURATION_MS[durationType];
  const expiresAt = ms ? new Date(Date.now() + ms).toISOString() : null;

  const result = await db.query(
    `INSERT INTO access_keys (key_value, duration_type, status, expires_at, created_by)
     VALUES ($1, $2, 'active', $3, $4) RETURNING *`,
    [keyValue, durationType, expiresAt, req.user.id]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'KEY_GENERATED',
    details: `Generated a "${durationType}" access key`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, key: computeKeyView(result.rows[0]) });
}

async function listKeys(req, res) {
  const { rows } = await db.query('SELECT * FROM access_keys ORDER BY created_at DESC');
  res.json({ success: true, keys: rows.map(computeKeyView) });
}

async function deleteKey(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM access_keys WHERE id = $1', [id]);
  const key = result.rows[0];

  if (!key) {
    return res.status(404).json({ success: false, message: 'Key not found.' });
  }

  await db.query('DELETE FROM access_keys WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'KEY_DELETED',
    details: `Deleted access key "${key.key_value}"`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'Key deleted successfully.' });
}

module.exports = { generateKey, listKeys, deleteKey };
