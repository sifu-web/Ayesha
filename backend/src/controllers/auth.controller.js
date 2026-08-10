const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken, signKeyToken, cookieOptions } = require('../utils/tokens');
const { logAction } = require('../utils/audit');

async function login(req, res) {
  const { username, password } = req.body;

  const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];

  if (!user) {
    await logAction({ username, action: 'LOGIN_FAILED', details: 'Unknown username', ip: req.ip });
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await logAction({ userId: user.id, username, action: 'LOGIN_FAILED', details: 'Wrong password', ip: req.ip });
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  const token = signToken(user);
  res.cookie('ayesha_token', token, cookieOptions());

  await logAction({ userId: user.id, username, action: 'LOGIN_SUCCESS', ip: req.ip });

  res.json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
    inactivityLogoutMinutes: Number(process.env.INACTIVITY_LOGOUT_MINUTES || 15),
  });
}

async function logout(req, res) {
  res.clearCookie('ayesha_token', { ...cookieOptions(), maxAge: undefined });
  if (req.user) {
    await logAction({ userId: req.user.id, username: req.user.username, action: 'LOGOUT', ip: req.ip });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
}

/**
 * Unauthenticated session-reset endpoint used by the frontend on every fresh
 * app load. By design this app never auto-restores a session: whatever the
 * login method (password or access key), reopening/reloading the site must
 * always land on the login screen. This clears any leftover cookie without
 * requiring a currently-valid token, so it also works when the cookie is
 * already expired/malformed and verifyToken would otherwise reject it before
 * it could be cleared.
 */
function clearSession(req, res) {
  res.clearCookie('ayesha_token', { ...cookieOptions(), maxAge: undefined });
  res.json({ success: true });
}

function me(req, res) {
  res.json({ success: true, user: req.user });
}

/**
 * Logs in with a generated access key instead of a username/password account.
 * Grants a view-only "keyuser" session (see Key Generator).
 */
async function keyLogin(req, res) {
  const { key } = req.body;
  const { rows } = await db.query('SELECT * FROM access_keys WHERE key_value = $1', [(key || '').trim()]);
  const record = rows[0];

  if (!record || record.status === 'revoked') {
    await logAction({ action: 'KEY_LOGIN_FAILED', details: 'Unknown or revoked key', ip: req.ip });
    return res.status(401).json({ success: false, message: 'Invalid or expired access key.' });
  }

  if (record.duration_type === 'one_time' && record.used_at) {
    await logAction({ action: 'KEY_LOGIN_FAILED', details: 'One-time key already used', ip: req.ip });
    return res.status(401).json({ success: false, message: 'This key has already been used.' });
  }

  const now = Date.now();
  if (record.expires_at && new Date(record.expires_at).getTime() < now) {
    await logAction({ action: 'KEY_LOGIN_FAILED', details: 'Expired key', ip: req.ip });
    return res.status(401).json({ success: false, message: 'This key has expired.' });
  }

  const remainingMs = record.expires_at ? new Date(record.expires_at).getTime() - now : null;

  if (record.duration_type === 'one_time') {
    await db.query(`UPDATE access_keys SET used_at = now(), status = 'used' WHERE id = $1`, [record.id]);
  }

  const token = signKeyToken(record, remainingMs);
  res.cookie('ayesha_token', token, cookieOptions());

  await logAction({ action: 'KEY_LOGIN_SUCCESS', details: `Key "${record.key_value}"`, ip: req.ip });

  res.json({
    success: true,
    user: { id: null, username: 'Key Access', role: 'keyuser' },
    inactivityLogoutMinutes: Number(process.env.INACTIVITY_LOGOUT_MINUTES || 15),
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];

  if (!user) {
    return res.status(403).json({ success: false, message: 'This session cannot change a password.' });
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, user.id]);

  await logAction({ userId: user.id, username: user.username, action: 'PASSWORD_CHANGED', ip: req.ip });

  res.json({ success: true, message: 'Password updated successfully.' });
}

module.exports = { login, logout, me, changePassword, keyLogin, clearSession };
