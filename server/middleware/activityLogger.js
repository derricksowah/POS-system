const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Log a user action to the activity_logs table.
 */
async function logActivity({ userId, action, entity, entityId, details, ipAddress }) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, entity, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entity, entityId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    // Non-fatal: log but don't throw
    logger.warn('Failed to write activity log:', err.message);
  }
}

module.exports = { logActivity };
