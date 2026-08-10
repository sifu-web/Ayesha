const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logAction } = require('../utils/audit');

async function listUsers(req, res) {
  const { rows } = await db.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
  res.json({ success: true, users: rows });
}

async function createUser(req, res) {
  const { username, password, role } = req.body;

  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length) {
    return res.status(409).json({ success: false, message: 'That username is already taken.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const inserted = await db.query(
    'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
    [username, hash, role]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'USER_CREATED',
    details: `Created user "${username}" with role "${role}"`,
    ip: req.ip,
  });

  res.status(201).json({ success: true, user: inserted.rows[0] });
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const targetResult = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  const target = targetResult.rows[0];
  if (!target) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (target.role === 'admin' && role === 'user') {
    const adminCountResult = await db.query('SELECT COUNT(*) AS count FROM users WHERE role = $1', ['admin']);
    if (Number(adminCountResult.rows[0].count) <= 1) {
      return res.status(400).json({ success: false, message: 'At least one administrator account must remain.' });
    }
  }

  if (username && username !== target.username) {
    const clash = await db.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
    if (clash.rows.length) {
      return res.status(409).json({ success: false, message: 'That username is already taken.' });
    }
  }

  const newUsername = username || target.username;
  const newRole = role || target.role;
  const newHash = password ? await bcrypt.hash(password, 12) : target.password_hash;

  await db.query(
    `UPDATE users SET username = $1, role = $2, password_hash = $3, updated_at = now() WHERE id = $4`,
    [newUsername, newRole, newHash, id]
  );

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'USER_UPDATED',
    details: `Updated user #${id} (${newUsername})`,
    ip: req.ip,
  });

  const updated = await db.query('SELECT id, username, role, created_at FROM users WHERE id = $1', [id]);
  res.json({ success: true, user: updated.rows[0] });
}

async function deleteUser(req, res) {
  const { id } = req.params;

  const targetResult = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  const target = targetResult.rows[0];
  if (!target) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (Number(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account while logged in.' });
  }

  if (target.role === 'admin') {
    const adminCountResult = await db.query('SELECT COUNT(*) AS count FROM users WHERE role = $1', ['admin']);
    if (Number(adminCountResult.rows[0].count) <= 1) {
      return res.status(400).json({ success: false, message: 'At least one administrator account must remain.' });
    }
  }

  await db.query('DELETE FROM users WHERE id = $1', [id]);

  await logAction({
    userId: req.user.id,
    username: req.user.username,
    action: 'USER_DELETED',
    details: `Deleted user "${target.username}" (#${id})`,
    ip: req.ip,
  });

  res.json({ success: true, message: 'User deleted successfully.' });
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
