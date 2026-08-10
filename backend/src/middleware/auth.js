/**
 * Authentication & authorization middleware.
 * JWTs are issued on login and stored in an httpOnly, SameSite=Strict cookie
 * so they are inaccessible to client-side JavaScript (XSS mitigation) and are
 * not sent on cross-site requests (CSRF mitigation).
 */
const jwt = require('jsonwebtoken');
const db = require('../config/db');

async function verifyToken(req, res, next) {
  const token = req.cookies?.ayesha_token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Key-based (non-account) sessions are re-validated against the access_keys
    // table on every request, so an expired or admin-revoked key stops working
    // immediately rather than waiting for the JWT itself to expire.
    if (decoded.role === 'keyuser') {
      const { rows } = await db.query('SELECT * FROM access_keys WHERE id = $1', [decoded.keyId]);
      const key = rows[0];

      if (!key || key.status === 'revoked') {
        return res.status(401).json({ success: false, message: 'Access key is no longer valid.' });
      }
      if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ success: false, message: 'Access key has expired.' });
      }

      req.user = { id: null, username: 'Key Access', role: 'keyuser' };
      return next();
    }

    const { rows } = await db.query('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin };
