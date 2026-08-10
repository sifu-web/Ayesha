const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

/** Parses a JWT_EXPIRES_IN-style string ("2h", "30m", "1d") into seconds. */
function parseExpirySeconds(fallbackSeconds = 7200) {
  const raw = process.env.JWT_EXPIRES_IN;
  if (!raw) return fallbackSeconds;
  const match = /^(\d+)\s*([smhd])$/i.exec(String(raw).trim());
  if (!match) return fallbackSeconds;
  const num = parseInt(match[1], 10);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase()];
  return num * mult;
}

/**
 * Signs a session token for a key-based (non-account) login.
 * The session length is capped by whichever is shorter: the app's normal
 * default session length, or the access key's own remaining validity —
 * so a session can never outlive the key that created it.
 */
function signKeyToken(keyRecord, remainingMs) {
  const defaultSeconds = parseExpirySeconds();
  const seconds =
    remainingMs != null ? Math.max(1, Math.min(defaultSeconds, Math.floor(remainingMs / 1000))) : defaultSeconds;
  return jwt.sign({ role: 'keyuser', keyId: keyRecord.id }, process.env.JWT_SECRET, { expiresIn: seconds });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24, // cookie lifespan ceiling; actual auth validity is bounded by the JWT's own expiry
    path: '/',
  };
}

module.exports = { signToken, signKeyToken, cookieOptions };
