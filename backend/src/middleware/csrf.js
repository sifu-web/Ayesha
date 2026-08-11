/**
 * Lightweight CSRF protection using the "reliable origin check" pattern
 * recommended by OWASP as an alternative to token-based CSRF middleware.
 * The session cookie itself is httpOnly and SameSite=None/Lax (see
 * utils/tokens.js) rather than Strict, since the frontend and backend can be
 * on different origins — so this origin check is the primary CSRF defense
 * for state-changing requests, not just a supplement to it.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const allowedOrigin = process.env.CLIENT_URL;
  const origin = req.get('origin') || req.get('referer');

  if (!origin || !allowedOrigin) {
    return res.status(403).json({ success: false, message: 'Request blocked: invalid origin.' });
  }

  // Compare only the scheme+host+port (the actual "origin"), not a raw
  // string prefix — startsWith() would let "https://client.com.evil.com"
  // or "https://client.com@evil.com" pass a check against "https://client.com".
  let originToCheck;
  try {
    originToCheck = new URL(origin).origin;
  } catch {
    return res.status(403).json({ success: false, message: 'Request blocked: invalid origin.' });
  }

  let allowed;
  try {
    allowed = new URL(allowedOrigin).origin;
  } catch {
    return res.status(403).json({ success: false, message: 'Request blocked: invalid origin.' });
  }

  if (originToCheck !== allowed) {
    return res.status(403).json({ success: false, message: 'Request blocked: invalid origin.' });
  }

  next();
}

module.exports = csrfProtection;
