/**
 * Rate limiters. Auth endpoints get a tight limit to slow brute-force
 * attempts; the general API gets a more generous limit; uploads get their
 * own bucket since they are naturally heavier requests.
 */
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Upload rate limit reached. Please try again shortly.' },
});

module.exports = { authLimiter, apiLimiter, uploadLimiter };
