const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Verify the JWT access token from Authorization: Bearer <token>.
 * Also checks that the account is still active on every request,
 * so deactivated users are blocked immediately without waiting
 * for their token to expire.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid token.' });
  }

  // Verify the user still exists and is active
  try {
    const result = await query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Account not found.' });
    }
    if (!user.is_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Account is deactivated.' });
    }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication failed.' });
  }
}

module.exports = { authenticate };
