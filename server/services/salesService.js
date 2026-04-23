const { withTransaction, query } = require('../config/database');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { SALE_STATUS } = require('../config/constants');

/**
 * Create a new sale. All stock deductions happen inside one transaction
 * with row-level locking to prevent overselling.
 */
async function createSale({ cashierId, items, amount_tendered, cash_amount, momo_amount, payment_method = 'cash' }) {
  return withTransaction(async (client) => {
    const normalizedItems = [];

    // 1. Validate and lock stock for each product
    for (const item of items) {
      const stockRes = await client.query(
        `SELECT s.quantity, p.name, p.is_active, p.price
         FROM stock s
         JOIN products p ON p.id = s.product_id
         WHERE s.product_id = $1 FOR UPDATE`,
        [item.product_id]
      );
      const stock = stockRes.rows[0];
      if (!stock) throw Object.assign(new Error(`Product ${item.product_id} not found.`), { status: 404 });
      if (!stock.is_active) throw Object.assign(new Error(`Product "${stock.name}" is deactivated.`), { status: 400 });
      if (Number(stock.quantity) < Number(item.quantity)) {
        throw Object.assign(
          new Error(`Insufficient stock for "${stock.name}". Available: ${stock.quantity}, Requested: ${item.quantity}`),
          { status: 400 }
        );
      }

      const productPrice = Number(stock.price);
      const originalUnitPrice = item.original_unit_price != null
        ? Number(item.original_unit_price)
        : productPrice;
      const requestedUnitPrice = item.unit_price != null
        ? Number(item.unit_price)
        : originalUnitPrice;
      const discountAmount = item.discount_amount != null
        ? Number(item.discount_amount)
        : Math.max(0, originalUnitPrice - requestedUnitPrice);

      if (requestedUnitPrice < 0 || originalUnitPrice < 0 || discountAmount < 0) {
        throw Object.assign(new Error('Sale item prices cannot be negative.'), { status: 400, expose: true });
      }

      normalizedItems.push({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: requestedUnitPrice,
        original_unit_price: originalUnitPrice,
        discount_amount: discountAmount,
      });
    }

    const grandTotal = normalizedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    let cashAmount = cash_amount != null
      ? Number(cash_amount)
      : (amount_tendered != null && Number(amount_tendered) > 0 ? Number(amount_tendered) : 0);
    let momoAmount = momo_amount != null ? Number(momo_amount) : 0;

    if (payment_method === 'cash') momoAmount = 0;
    if (payment_method === 'momo') cashAmount = 0;

    const totalPaid = cashAmount + momoAmount;

    if (payment_method === 'cash' && cashAmount <= 0) {
      throw Object.assign(new Error('Please enter the cash amount tendered.'), { status: 400, expose: true });
    }
    if (payment_method === 'momo' && momoAmount <= 0) {
      throw Object.assign(new Error('Please enter the MoMo amount.'), { status: 400, expose: true });
    }
    if (payment_method === 'split' && (cashAmount <= 0 || momoAmount <= 0)) {
      throw Object.assign(new Error('Please enter both cash and MoMo amounts.'), { status: 400, expose: true });
    }
    if (totalPaid + 0.001 < grandTotal) {
      throw Object.assign(new Error('Payment amount is less than the sale total.'), { status: 400, expose: true });
    }

    // 2. Insert sale record — retry up to 5 times if receipt number collides
    const tendered = cashAmount > 0 ? cashAmount : null;
    const changeDue = Math.max(0, totalPaid - grandTotal);
    let sale;
    for (let attempt = 0; attempt < 5; attempt++) {
      const receiptNumber = await generateReceiptNumber(client);
      try {
        await client.query('SAVEPOINT receipt_insert');
        const saleRes = await client.query(`
          INSERT INTO sales (
            receipt_number, cashier_id, status,
            amount_tendered, payment_method, cash_amount, momo_amount, change_due
          )
          VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7)
          RETURNING id, receipt_number, created_at
        `, [receiptNumber, cashierId, tendered, payment_method, cashAmount, momoAmount, changeDue]);
        sale = saleRes.rows[0];
        await client.query('RELEASE SAVEPOINT receipt_insert');
        break;
      } catch (err) {
        if (err.code === '23505' && err.constraint === 'sales_receipt_number_key') {
          await client.query('ROLLBACK TO SAVEPOINT receipt_insert');
        } else {
          throw err;
        }
      }
    }
    if (!sale) throw Object.assign(new Error('Could not generate a unique receipt number. Please try again.'), { status: 500 });

    const receiptNumber = sale.receipt_number;

    // 4. Insert sale items + deduct stock
    const saleItems = [];
    for (const item of normalizedItems) {
      const itemRes = await client.query(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_price, original_unit_price, discount_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [sale.id, item.product_id, item.quantity, item.unit_price, item.original_unit_price, item.discount_amount]);
      saleItems.push(itemRes.rows[0]);

      // Deduct stock
      await client.query(
        `UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );

      // Movement record
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, created_by)
        VALUES ($1, 'sale', $2, $3, $4)
      `, [item.product_id, -item.quantity, receiptNumber, cashierId]);
    }

    // 5. Return full receipt data
    const fullSale = await getSaleById(sale.id, client);

    return fullSale;
  });
}

/**
 * Fetch a single sale with all its items and product details.
 */
async function getSaleById(id, client) {
  const db = client ? client : { query: (t, p) => query(t, p) };

  const saleRes = await db.query(`
    SELECT s.id, s.receipt_number, s.status, s.notes, s.created_at, s.updated_at,
           s.cashier_id, s.amount_tendered, s.change_due, s.payment_method,
           s.cash_amount, s.momo_amount,
           u.username AS cashier_name,
           ue.username AS edited_by
    FROM sales s
    JOIN users u ON u.id = s.cashier_id
    LEFT JOIN users ue ON ue.id = s.updated_by
    WHERE s.id = $1
  `, [id]);
  const sale = saleRes.rows[0];
  if (!sale) return null;

  const itemsRes = await db.query(`
    SELECT si.id, si.product_id, si.quantity, si.unit_price,
           si.original_unit_price, si.discount_amount, si.subtotal,
           p.code AS product_code, p.name AS product_name, p.unit
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = $1
  `, [id]);

  const total = itemsRes.rows.reduce((sum, r) => sum + Number(r.subtotal), 0);
  return { ...sale, items: itemsRes.rows, grand_total: total };
}

/**
 * Get paginated sales list.
 */
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

async function getSales({ from, to, cashierId, status, search = '', page = 1, limit = 50, excludeVoided = false } = {}) {
  const { PAGINATION, SALE_STATUS: SS } = require('../config/constants');
  limit = Math.min(Math.max(parseInt(limit) || 50, 1), PAGINATION.MAX_LIMIT);
  page  = Math.max(parseInt(page) || 1, 1);

  // Handle string boolean from query params
  excludeVoided = excludeVoided === true || excludeVoided === 'true';

  // Reject non-date strings to prevent unexpected query behaviour
  if (from && !ISO_DATE_RE.test(from)) from = undefined;
  if (to   && !ISO_DATE_RE.test(to))   to   = undefined;

  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (from) { params.push(from); conditions.push(`s.created_at >= $${params.length}`); }
  if (to)   { params.push(to + ' 23:59:59'); conditions.push(`s.created_at <= $${params.length}`); }
  if (cashierId) { params.push(cashierId); conditions.push(`s.cashier_id = $${params.length}`); }
  if (status)    { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (excludeVoided) { params.push('voided'); conditions.push(`s.status != $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      s.receipt_number ILIKE $${params.length}
      OR u.username ILIKE $${params.length}
      OR EXISTS (
        SELECT 1
        FROM sale_items si_search
        JOIN products p_search ON p_search.id = si_search.product_id
        WHERE si_search.sale_id = s.id
          AND (p_search.name ILIKE $${params.length} OR p_search.code ILIKE $${params.length})
      )
    )`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const res = await query(`
    SELECT s.id, s.receipt_number, s.status, s.created_at, s.updated_at,
           u.username AS cashier_name,
           s.payment_method, s.cash_amount, s.momo_amount,
           SUM(si.subtotal) AS grand_total,
           COUNT(si.id) AS item_count
    FROM sales s
    JOIN users u ON u.id = s.cashier_id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    ${where}
    GROUP BY s.id, u.username
    ORDER BY s.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  const countParams = params.slice(0, params.length - 2);
  const countRes = await query(
    `SELECT COUNT(*) AS total
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     ${where}`,
    countParams
  );

  return { sales: res.rows, total: parseInt(countRes.rows[0].total), page, limit };
}

/**
 * Admin: edit a completed sale.
 * Reverses original stock movements and applies updated values.
 */
async function editSale(id, { items, notes }, editorId) {
  return withTransaction(async (client) => {
    // Fetch original sale
    const saleRes = await client.query(
      `SELECT id, receipt_number, status FROM sales WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const sale = saleRes.rows[0];
    if (!sale) throw Object.assign(new Error('Sale not found.'), { status: 404 });
    if (sale.status === SALE_STATUS.VOIDED) throw Object.assign(new Error('Cannot edit a voided sale.'), { status: 400 });

    // Fetch original items
    const origItemsRes = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
      [id]
    );

    // Reverse original stock deductions
    for (const orig of origItemsRes.rows) {
      await client.query(
        `UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2`,
        [orig.quantity, orig.product_id]
      );
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, note, created_by)
        VALUES ($1, 'sale_edit', $2, $3, 'Reversal for sale edit', $4)
      `, [orig.product_id, orig.quantity, sale.receipt_number, editorId]);
    }

    // Lock and validate new stock
    for (const item of items) {
      const stockRes = await client.query(
        `SELECT s.quantity, p.name FROM stock s JOIN products p ON p.id = s.product_id WHERE s.product_id = $1 FOR UPDATE`,
        [item.product_id]
      );
      const stock = stockRes.rows[0];
      if (!stock) throw Object.assign(new Error(`Product ${item.product_id} not found.`), { status: 404 });
      if (Number(stock.quantity) < Number(item.quantity)) {
        throw Object.assign(
          new Error(`Insufficient stock for "${stock.name}" after reversal. Available: ${stock.quantity}`),
          { status: 400 }
        );
      }
    }

    // Delete old items, insert new
    await client.query(`DELETE FROM sale_items WHERE sale_id = $1`, [id]);

    for (const item of items) {
      await client.query(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_price, original_unit_price, discount_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        id,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.original_unit_price ?? item.unit_price,
        item.discount_amount ?? 0,
      ]);

      await client.query(
        `UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );

      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, note, created_by)
        VALUES ($1, 'sale_edit', $2, $3, 'Updated sale', $4)
      `, [item.product_id, -item.quantity, sale.receipt_number, editorId]);
    }

    // Update sale record
    await client.query(`
      UPDATE sales SET status = 'edited', notes = $1, updated_by = $2, updated_at = NOW()
      WHERE id = $3
    `, [notes || null, editorId, id]);

    return getSaleById(id, client);
  });
}

/**
 * Void a sale (admin only). Restores all stock.
 */
async function voidSale(id, editorId) {
  return withTransaction(async (client) => {
    const saleRes = await client.query(
      `SELECT id, receipt_number, status FROM sales WHERE id = $1 FOR UPDATE`, [id]
    );
    const sale = saleRes.rows[0];
    if (!sale) throw Object.assign(new Error('Sale not found.'), { status: 404 });
    if (sale.status === SALE_STATUS.VOIDED) throw Object.assign(new Error('Sale already voided.'), { status: 400 });

    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`, [id]
    );

    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
      await client.query(`
        INSERT INTO stock_movements (product_id, type, quantity, reference, note, created_by)
        VALUES ($1, 'sale_edit', $2, $3, 'Void reversal', $4)
      `, [item.product_id, item.quantity, sale.receipt_number, editorId]);
    }

    await client.query(`
      UPDATE sales SET status = 'voided', updated_by = $1, updated_at = NOW() WHERE id = $2
    `, [editorId, id]);

    return { id, receipt_number: sale.receipt_number, status: 'voided' };
  });
}

/**
 * Permanently delete a sale and all its data, restoring stock.
 */
async function permanentDeleteSale(id, editorId) {
  return withTransaction(async (client) => {
    // Get the sale and its items first
    const saleRes = await client.query(
      `SELECT receipt_number FROM sales WHERE id = $1`, [id]
    );
    if (!saleRes.rows.length) {
      throw Object.assign(new Error('Sale not found.'), { status: 404, expose: true });
    }
    const receiptNumber = saleRes.rows[0].receipt_number;

    // Get all items to restore stock
    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`, [id]
    );

    // Restore stock for each product
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // Delete activity logs mentioning this sale
    await client.query(`DELETE FROM activity_logs WHERE entity = 'sales' AND entity_id = $1`, [id]);

    // Delete sale items
    await client.query(`DELETE FROM sale_items WHERE sale_id = $1`, [id]);

    // Delete stock movements related to this sale
    await client.query(
      `DELETE FROM stock_movements WHERE reference = $1`,
      [receiptNumber]
    );

    // Delete the sale itself
    const res = await client.query(
      `DELETE FROM sales WHERE id = $1 RETURNING id, receipt_number`, [id]
    );
    if (!res.rows.length) {
      throw Object.assign(new Error('Sale not found.'), { status: 404, expose: true });
    }
    return res.rows[0];
  });
}

module.exports = { createSale, getSaleById, getSales, editSale, voidSale, permanentDeleteSale };
