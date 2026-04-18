const { HTTP_STATUS } = require('../config/constants');

/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin') or authorize('admin', 'cashier')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { authorize };
