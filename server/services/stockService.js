const { query, withTransaction } = require('../config/database');

/**
 * Record a stock-in (purchase).
 */
async function stockIn({ productId, quantity, supplier, reference, note, userId }) {
  return withTransaction(async (client) => {
    // Lock the stock row
    const stockRes = await client.query(
      `SELECT quantity FROM stock WHERE product_id = $1 FOR UPDATE`,
      [productId]
    );
    if (!stockRes.rows[0]) {
      throw Object.assign(new Error('Product stock record not found.'), { status: 404 });
    }

    // Update stock
    await client.query(
      `UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2`,
      [quantity, productId]
    );

    // Record stock_in
    const stockInRes = await client.query(`
      INSERT INTO stock_ins (product_id, quantity, supplier, reference, note, created_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [productId, quantity, supplier, reference, note, userId]);

    // Movement record
    await client.query(`
      INSERT INTO stock_movements (product_id, type, quantity, reference, note, created_by)
      VALUES ($1, 'purchase', $2, $3, $4, $5)
    `, [productId, quantity, reference, note, userId]);

    return stockInRes.rows[0];
  });
}

/**
 * Get stock-in history with optional filters.
 */
async function getStockIns({ productId, from, to, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (productId) {
    params.push(productId);
    conditions.push(`si.product_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`si.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to + ' 23:59:59');
    conditions.push(`si.created_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const res = await query(`
    SELECT si.*, p.code AS product_code, p.name AS product_name, p.unit,
           u.username AS created_by_username
    FROM stock_ins si
    JOIN products p ON p.id = si.product_id
    LEFT JOIN users u ON u.id = si.created_by
    ${where}
    ORDER BY si.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  const countParams = params.slice(0, params.length - 2);
  const countRes = await query(
    `SELECT COUNT(*) AS total FROM stock_ins si ${where}`,
    countParams
  );

  return {
    stockIns: res.rows,
    total:    parseInt(countRes.rows[0].total),
    page,
    limit,
  };
}

/**
 * Get current stock levels for all products.
 */
async function getCurrentStock() {
  const res = await query(`
    SELECT p.id, p.code, p.name, p.unit, p.low_stock_threshold,
           p.opening_stock, p.is_active,
           COALESCE(s.quantity, 0) AS current_stock
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    ORDER BY p.name
  `);
  return res.rows;
}

module.exports = { stockIn, getStockIns, getCurrentStock };
