// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { getClient, pool } = require('../config/database');

async function clearSales() {
  const client = await getClient();

  try {
    console.log('Starting sales clear...\n');

    // Start transaction
    await client.query('BEGIN');

    // Get all sales items to restore stock
    console.log('1️⃣  Retrieving sales items for stock restoration...');
    const itemsRes = await client.query(`
      SELECT product_id, SUM(quantity) as total_qty
      FROM sale_items
      GROUP BY product_id
    `);

    // Restore stock for each product
    console.log('2️⃣  Restoring stock levels...');
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE stock SET quantity = quantity + $1, updated_at = NOW() WHERE product_id = $2`,
        [item.total_qty, item.product_id]
      );
    }

    // Delete activity logs related to sales
    console.log('3️⃣  Deleting activity logs...');
    await client.query(`DELETE FROM activity_logs WHERE entity = 'sales'`);

    // Delete sale items
    console.log('4️⃣  Deleting sale items...');
    await client.query(`DELETE FROM sale_items`);

    // Delete stock movements related to sales
    console.log('5️⃣  Deleting stock movements...');
    await client.query(`DELETE FROM stock_movements WHERE type IN ('sale', 'sale_edit')`);

    // Delete all sales
    console.log('6️⃣  Deleting all sales...');
    const salesRes = await client.query(`SELECT COUNT(*) as count FROM sales`);
    const salesCount = parseInt(salesRes.rows[0].count);
    await client.query(`DELETE FROM sales`);

    // Reset the receipt sequence
    console.log('7️⃣  Resetting receipt sequence...');
    await client.query(`ALTER SEQUENCE receipt_seq RESTART WITH 1`);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Sales cleared successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Deleted ${salesCount} sales`);
    console.log(`   • Restored stock for ${itemsRes.rows.length} products`);
    console.log(`   • Reset receipt counter to 1`);
    console.log('\n✨ Database cleaned! Ready for fresh sales data.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during sales clear:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearSales().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
