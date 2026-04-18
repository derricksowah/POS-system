const { query, withTransaction } = require('../config/database');

async function getAll({ search = '', includeInactive = false, page = 1, limit = 50 } = {}) {
  const { PAGINATION } = require('../config/constants');
  limit  = Math.min(Math.max(parseInt(limit)  || 50, 1), PAGINATION.MAX_LIMIT);
  page   = Math.max(parseInt(page) || 1, 1);
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  conditions.push(`p.deleted_at IS NULL`);
  if (!includeInactive) {
    conditions.push(`p.is_active = TRUE`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.code ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const dataRes = await query(`
    SELECT p.id, p.code, p.name, p.price, p.unit,
           p.opening_stock, p.low_stock_threshold, p.is_active,
           p.created_at, p.updated_at,
           COALESCE(s.quantity, 0) AS current_stock
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    ${where}
    ORDER BY p.name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  // Count query (without limit/offset params)
  const countParams = params.slice(0, params.length - 2);
  const countRes = await query(`
    SELECT COUNT(*) AS total FROM products p ${where}
  `, countParams);

  return {
    products: dataRes.rows,
    total:    parseInt(countRes.rows[0].total),
    page,
    limit,
  };
}

async function getById(id) {
  const res = await query(`
    SELECT p.*, COALESCE(s.quantity, 0) AS current_stock
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE p.id = $1 AND p.deleted_at IS NULL
  `, [id]);
  return res.rows[0] || null;
}

async function create({ code, name, price, unit, opening_stock, low_stock_threshold }) {
  return withTransaction(async (client) => {
    const res = await client.query(`
      INSERT INTO products (code, name, price, unit, opening_stock, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [code.toUpperCase(), name, price, unit, opening_stock, low_stock_threshold]);
    const product = res.rows[0];

    // Initialize stock
    await client.query(
      `INSERT INTO stock (product_id, quantity) VALUES ($1, $2)`,
      [product.id, opening_stock]
    );

    // Record opening stock movement
    await client.query(`
      INSERT INTO stock_movements (product_id, type, quantity, note)
      VALUES ($1, 'opening', $2, 'Initial opening stock')
    `, [product.id, opening_stock]);

    return product;
  });
}

async function update(id, { name, price, unit, low_stock_threshold }) {
  const res = await query(`
    UPDATE products
    SET name = $1, price = $2, unit = $3, low_stock_threshold = $4, updated_at = NOW()
    WHERE id = $5 RETURNING *
  `, [name, price, unit, low_stock_threshold, id]);
  return res.rows[0] || null;
}

async function deactivate(id) {
  const res = await query(`
    UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id
  `, [id]);
  return res.rows[0] || null;
}

async function activate(id) {
  const res = await query(`
    UPDATE products SET is_active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id
  `, [id]);
  return res.rows[0] || null;
}

// Soft-delete: marks deleted_at, keeps all data intact
async function deleteProduct(id) {
  const res = await query(
    `UPDATE products SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, name`,
    [id]
  );
  if (!res.rows.length) {
    throw Object.assign(new Error('Product not found.'), { status: 404 });
  }
  return res.rows[0];
}

// Get all soft-deleted products for the recycle bin
async function getDeleted() {
  const res = await query(`
    SELECT p.id, p.code, p.name, p.price, p.unit,
           p.opening_stock, p.low_stock_threshold, p.is_active,
           p.created_at, p.deleted_at,
           COALESCE(s.quantity, 0) AS current_stock
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC
  `);
  return res.rows;
}

// Restore a soft-deleted product
async function restoreProduct(id) {
  const res = await query(
    `UPDATE products SET deleted_at = NULL, is_active = TRUE, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NOT NULL
     RETURNING id, name`,
    [id]
  );
  if (!res.rows.length) {
    throw Object.assign(new Error('Product not found in recycle bin.'), { status: 404, expose: true });
  }
  return res.rows[0];
}

// Permanently delete from recycle bin
async function permanentDelete(id) {
  return withTransaction(async (client) => {
    // Delete activity logs mentioning this product
    await client.query(`DELETE FROM activity_logs WHERE entity = 'products' AND entity_id = $1`, [id]);

    // Delete sale line items (sale_items)
    await client.query(`DELETE FROM sale_items WHERE product_id = $1`, [id]);

    // Delete orphaned sales (sales with no items left)
    await client.query(`DELETE FROM sales WHERE id NOT IN (SELECT DISTINCT sale_id FROM sale_items)`);

    // Delete stock movements
    await client.query(`DELETE FROM stock_movements WHERE product_id = $1`, [id]);

    // Delete stock-in records
    await client.query(`DELETE FROM stock_ins WHERE product_id = $1`, [id]);

    // Delete stock
    await client.query(`DELETE FROM stock WHERE product_id = $1`, [id]);

    // Finally delete the product
    const res = await client.query(
      `DELETE FROM products WHERE id = $1 RETURNING id, name`, [id]
    );
    if (!res.rows.length) {
      throw Object.assign(new Error('Product not found.'), { status: 404, expose: true });
    }
    return res.rows[0];
  });
}

async function getLowStock() {
  const res = await query(`
    SELECT p.id, p.code, p.name, p.unit, p.low_stock_threshold,
           COALESCE(s.quantity, 0) AS current_stock
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE p.is_active = TRUE
      AND COALESCE(s.quantity, 0) <= p.low_stock_threshold
    ORDER BY COALESCE(s.quantity, 0) ASC
  `);
  return res.rows;
}

module.exports = { getAll, getById, create, update, deactivate, activate, deleteProduct, getDeleted, restoreProduct, permanentDelete, getLowStock };
