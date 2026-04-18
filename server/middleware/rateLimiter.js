const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max      = parseInt(process.env.RATE_LIMIT_MAX)        || 500;

/**
 * General API rate limiter.
 */
const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Stricter limiter for auth endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

module.exports = { apiLimiter, authLimiter };
