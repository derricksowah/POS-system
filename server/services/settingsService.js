const { query } = require('../config/database');

async function getSettings() {
  const res = await query(`SELECT * FROM settings LIMIT 1`);
  return res.rows[0] || null;
}

async function updateSettings({ shop_name, shop_address, phone_number, phone_number_2, currency, receipt_header, receipt_footer, logo_url, printer_name }) {
  const existing = await query(`SELECT id FROM settings LIMIT 1`);
  if (!existing.rows.length) {
    const res = await query(`
      INSERT INTO settings (shop_name, shop_address, phone_number, phone_number_2, currency, receipt_header, receipt_footer, logo_url, printer_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [shop_name, shop_address, phone_number, phone_number_2 || '', currency, receipt_header, receipt_footer, logo_url || '', printer_name || '']);
    return res.rows[0];
  }

  const id = existing.rows[0].id;
  const res = await query(`
    UPDATE settings
    SET shop_name      = $1,
        shop_address   = $2,
        phone_number   = $3,
        phone_number_2 = $4,
        currency       = $5,
        receipt_header = $6,
        receipt_footer = $7,
        logo_url       = $8,
        printer_name   = $9,
        updated_at     = NOW()
    WHERE id = $10
    RETURNING *
  `, [shop_name, shop_address, phone_number, phone_number_2 || '', currency, receipt_header, receipt_footer, logo_url || '', printer_name || '', id]);
  return res.rows[0];
}

module.exports = { getSettings, updateSettings };
