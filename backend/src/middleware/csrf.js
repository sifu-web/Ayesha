/**
 * Lightweight CSRF protection using the "reliable origin check" pattern
 * recommended by OWASP as an alternative to token-based CSRF middleware.
 * Combined with SameSite=Strict cookies, this prevents state-changing
 * requests from being forged by third-party sites.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const allowedOrigin = process.env.CLIENT_URL;
  const origin = req.get('origin') || req.get('referer');

  if (!origin || !allowedOrigin || !origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ success: false, message: 'Request blocked: invalid origin.' });
  }

  next();
}

module.exports = csrfProtection;
