const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../config/constants');

/**
 * 404 handler — placed after all routes.
 */
function notFound(req, res, next) {
  res.status(HTTP_STATUS.NOT_FOUND).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Global error handler.
 * Never expose internal DB errors, stack traces, or query details to the client.
 */
function errorHandler(err, req, res, next) {
  // PostgreSQL constraint violations — return safe messages, not raw DB errors
  if (err.code === '23505') {
    const constraint = err.constraint || '';
    const detail = err.detail || '';

    if (constraint.includes('products_code') || detail.includes('(code)=')) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'A product with that code already exists. Please try saving again.',
      });
    }

    if (constraint.includes('products_name') || detail.includes('(name)=')) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'A product with that name already exists.',
      });
    }

    return res.status(HTTP_STATUS.CONFLICT).json({ error: 'Duplicate entry. A record with that value already exists.' });
  }
  if (err.code === '23503') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Referenced record does not exist.' });
  }
  if (err.code === '23514') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Data violates a business constraint (e.g. negative stock).' });
  }
  // Any other PostgreSQL error — log internally, return generic message
  if (err.code && /^\d{5}$/.test(err.code)) {
    logger.error({ message: err.message, code: err.code, url: req.originalUrl, user: req.user?.id });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'A database error occurred.' });
  }

  // Validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: err.message });
  }

  // CORS errors
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Request blocked by CORS policy.' });
  }

  const status  = err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  // Only expose the message if the developer explicitly flagged it safe (err.expose = true)
  const message = err.expose ? err.message : 'An unexpected error occurred.';

  // Log full details server-side only
  if (status >= 500) {
    logger.error({
      message: err.message,
      stack:   err.stack,
      url:     req.originalUrl,
      method:  req.method,
      user:    req.user?.id,
    });
  }

  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
