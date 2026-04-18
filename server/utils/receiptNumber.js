/**
 * Receipt number generator.
 * Uses PostgreSQL sequence for concurrency-safe unique numbers.
 * Format: RCPT-YYYYMMDD-XXXX
 */
const { query } = require('../config/database');

async function generateReceiptNumber(client) {
  // Use the provided client (inside a transaction) for atomicity
  const db = client || { query: (text, params) => query(text, params) };

  const seqRes = await db.query("SELECT nextval('receipt_seq') AS seq");
  const seq = seqRes.rows[0].seq;

  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const seqStr = String(seq).padStart(4, '0');
  return `RCPT-${dateStr}-${seqStr}`;
}

module.exports = { generateReceiptNumber };
