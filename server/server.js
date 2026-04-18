require('dotenv').config();
const app    = require('./app');
const logger = require('./utils/logger');
const { pool } = require('./config/database');

const PORT = parseInt(process.env.PORT) || 5000;

const WEAK_SECRETS = [
  'myposappsecretkey123456789012345',
  'myposapprefreshkey123456789012345',
  'secret', 'changeme', 'password', 'jwt_secret',
];

async function start() {
  // ── Startup security checks ────────────────────────────────
  const jwtSecret     = process.env.JWT_SECRET     || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  if (WEAK_SECRETS.includes(jwtSecret) || jwtSecret.length < 32) {
    logger.warn('⚠  JWT_SECRET is weak or using the default value. Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  if (WEAK_SECRETS.includes(refreshSecret) || refreshSecret.length < 32) {
    logger.warn('⚠  JWT_REFRESH_SECRET is weak or using the default value.');
  }

  // Verify DB connection before starting
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection established.');
  } catch (err) {
    logger.error('Cannot connect to database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`POS Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      logger.info('Server and DB pool closed.');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

start();
