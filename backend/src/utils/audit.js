const db = require('../config/db');

/**
 * Records an audit log entry. Called for every security-relevant or
 * data-changing event: logins, logouts, uploads, deletes, user management.
 */
async function logAction({ userId = null, username = null, action, details = '', ip = '' }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, username, action, details, ip]
    );
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
