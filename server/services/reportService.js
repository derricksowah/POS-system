const { query } = require('../config/database');

/**
 * Admin dashboard summary.
 */
async function getDashboard() {
  const today = new Date().toISOString().slice(0, 10);

  const [productsRes, todaySalesRes, lowStockRes, totalValueRes] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM products WHERE is_active = TRUE`),
    query(`
      SELECT COUNT(DISTINCT s.id) AS count, COALESCE(SUM(si.subtotal), 0) AS value
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.created_at::date = $1 AND s.status != 'voided'
    `, [today]),
    query(`
      SELECT COUNT(*) AS count
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id
      WHERE p.is_active = TRUE AND COALESCE(s.quantity, 0) <= p.low_stock_threshold
    `),
    query(`
      SELECT COALESCE(SUM(si.subtotal), 0) AS total
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status != 'voided'
    `),
  ]);

  return {
    total_products:       parseInt(productsRes.rows[0].total),
    today_sales_count:    parseInt(todaySalesRes.rows[0].count),
    today_sales_value:    Number(todaySalesRes.rows[0].value),
    low_stock_count:      parseInt(lowStockRes.rows[0].count),
    all_time_sales_value: Number(totalValueRes.rows[0].total),
  };
}

/**
 * Sales report — individual line items sorted by date.
 * Each row: receipt #, date, product code, product name, qty, unit price, amount.
 */
async function getSalesReport({ from, to } = {}) {
  const fromDate = from || new Date(0).toISOString().slice(0, 10);
  const toDate   = (to || new Date().toISOString().slice(0, 10)) + ' 23:59:59';

  const res = await query(`
    SELECT
      s.receipt_number,
      s.created_at,
      p.code        AS product_code,
      p.name        AS product_name,
      p.unit,
      si.quantity,
      si.unit_price,
      si.subtotal   AS amount
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    JOIN sales    s ON s.id = si.sale_id
    WHERE s.created_at >= $1
      AND s.created_at <= $2
      AND s.status != 'voided'
    ORDER BY s.created_at ASC, s.id ASC, p.name ASC
  `, [fromDate, toDate]);

  const totalsRes = await query(`
    SELECT
      COALESCE(SUM(si.subtotal), 0)  AS grand_total,
      COALESCE(SUM(si.quantity), 0)  AS total_qty,
      COUNT(DISTINCT s.id)           AS transaction_count,
      COUNT(si.id)                   AS line_count
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at >= $1 AND s.created_at <= $2 AND s.status != 'voided'
  `, [fromDate, toDate]);

  return {
    rows:   res.rows,
    totals: totalsRes.rows[0],
    period: { from: fromDate, to: toDate },
  };
}

/**
 * Inventory report: Opening + Purchases - Sales = Closing.
 */
async function getInventoryReport() {
  const res = await query(`
    SELECT
      p.id,
      p.code,
      p.name,
      p.unit,
      p.opening_stock  AS opening,
      p.low_stock_threshold AS threshold,
      p.is_active,
      COALESCE(SUM(CASE WHEN sm.type = 'purchase' THEN sm.quantity ELSE 0 END), 0) AS purchased,
      COALESCE(ABS(SUM(CASE WHEN sm.type IN ('sale', 'sale_edit') AND sm.quantity < 0 THEN sm.quantity ELSE 0 END)), 0) AS sold,
      COALESCE(st.quantity, 0) AS closing
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id
    LEFT JOIN stock st ON st.product_id = p.id
    GROUP BY p.id, p.code, p.name, p.unit, p.opening_stock, p.low_stock_threshold, p.is_active, st.quantity
    ORDER BY p.name
  `);

  return res.rows.map((row) => {
    let status = 'OK';
    const closing = Number(row.closing);
    const sold    = Number(row.sold);
    if (closing < 0)                              status = 'Negative';
    else if (closing === 0)                        status = 'Zero';
    else if (closing <= Number(row.threshold))     status = 'Low';
    else if (sold === 0)                           status = 'Zero Movement';
    return { ...row, status };
  });
}

/**
 * Cashier: today's grouped sales summary.
 */
async function getTodaySalesSummary(cashierId) {
  const today = new Date().toISOString().slice(0, 10);

  const res = await query(`
    SELECT
      p.code AS product_code,
      p.name AS product_name,
      p.unit,
      SUM(si.quantity) AS total_qty,
      AVG(si.unit_price) AS avg_price,
      SUM(si.subtotal) AS total_amount
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at::date = $1
      AND s.cashier_id = $2
      AND s.status != 'voided'
    GROUP BY p.code, p.name, p.unit
    ORDER BY total_amount DESC
  `, [today, cashierId]);

  const summaryRes = await query(`
    SELECT
      COUNT(DISTINCT s.id) AS total_transactions,
      COALESCE(SUM(si.subtotal), 0) AS total_value,
      COALESCE(SUM(si.quantity), 0) AS total_units
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.created_at::date = $1 AND s.cashier_id = $2 AND s.status != 'voided'
  `, [today, cashierId]);

  return { rows: res.rows, summary: summaryRes.rows[0] };
}

/**
 * Daily sales trend for the past N days (default 30).
 * Returns one row per day, filling gaps with zeros so the chart is continuous.
 */
async function getDailyTrend(days = 30) {
  const res = await query(`
    WITH date_series AS (
      SELECT generate_series(
        (CURRENT_DATE - ($1 - 1) * INTERVAL '1 day'),
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      ds.day::text                                    AS date,
      COALESCE(SUM(si.subtotal), 0)                  AS revenue,
      COUNT(DISTINCT s.id)                            AS transactions,
      COALESCE(SUM(si.quantity), 0)                  AS units_sold
    FROM date_series ds
    LEFT JOIN sales s
           ON s.created_at::date = ds.day
          AND s.status != 'voided'
    LEFT JOIN sale_items si ON si.sale_id = s.id
    GROUP BY ds.day
    ORDER BY ds.day ASC
  `, [days]);

  return res.rows.map((r) => ({
    date:         r.date,
    revenue:      Number(r.revenue),
    transactions: Number(r.transactions),
    units_sold:   Number(r.units_sold),
  }));
}

module.exports = { getDashboard, getSalesReport, getInventoryReport, getTodaySalesSummary, getDailyTrend };
