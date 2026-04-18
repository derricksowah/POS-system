/**
 * Database Reset Script - DANGER: drops all tables and re-runs migration + seed.
 * For development use only.
 */
require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

if (process.env.NODE_ENV === 'production') {
  console.error('Cannot reset database in production!');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function reset() {
  const client = await pool.connect();
  try {
    console.log('Dropping all tables...');
    await client.query(`
      DROP TABLE IF EXISTS
        activity_logs, refresh_tokens, stock_ins, stock_movements,
        sale_items, sales, stock, products, settings, users
      CASCADE;
      DROP SEQUENCE IF EXISTS receipt_seq;
      DROP FUNCTION IF EXISTS update_updated_at CASCADE;
    `);
    console.log('Tables dropped. Re-running migration and seed...');
    client.release();
    await pool.end();

    // Chain migrate then seed
    require('./migrate');
  } catch (err) {
    console.error('Reset failed:', err.message);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

reset();
