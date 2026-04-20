const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'pos_db',
  user:     process.env.DB_USER     || 'pos_user',
  password: process.env.DB_PASSWORD || '',
  // Connection pool settings
  max:                20,
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

/**
 * Execute a single query.
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 120));
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nQuery:', text);
    throw err;
  }
}

/**
 * Get a client for transaction use.
 */
async function getClient() {
  return pool.connect();
}

/**
 * Run fn(client) inside a transaction; auto-commit or rollback.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, getClient, withTransaction, pool };
