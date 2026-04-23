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

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => dateParts.find((p) => p.type === type)?.value;
  const dateStr = `${part('year')}${part('month')}${part('day')}`;

  const seqStr = String(seq).padStart(4, '0');
  return `RCPT-${dateStr}-${seqStr}`;
}

module.exports = { generateReceiptNumber };
