const { pool } = require('./database');

/**
 * Idempotent migrations — safe to run on every cold start.
 * All statements use IF NOT EXISTS / IF EXISTS so re-running is harmless.
 */
async function runMigrations() {
  const client = await pool.connect();
  try {
    // Products: cost_price and soft-delete column
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT NULL
          CHECK (cost_price IS NULL OR cost_price >= 0);
    `);
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);

    // Settings: extra contact and printer fields
    await client.query(`
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS phone_number_2 VARCHAR(30) DEFAULT '';
    `);
    await client.query(`
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS printer_name VARCHAR(200) DEFAULT '';
    `);

    console.log('[migrate] schema up-to-date');
  } catch (err) {
    console.error('[migrate] error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
