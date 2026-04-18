// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { getClient, pool } = require('../config/database');

async function clearAndSeed() {
  const client = await getClient();

  try {
    console.log('Starting database clear and seed...\n');

    // Start transaction
    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Delete all sales-related data
    // ============================================================
    console.log('1️⃣  Deleting all sale items...');
    await client.query('DELETE FROM sale_items');

    console.log('2️⃣  Deleting all sales...');
    await client.query('DELETE FROM sales');

    // ============================================================
    // STEP 2: Delete all stock-related data
    // ============================================================
    console.log('3️⃣  Deleting stock movements...');
    await client.query('DELETE FROM stock_movements');

    console.log('4️⃣  Deleting current stock...');
    await client.query('DELETE FROM stock');

    console.log('5️⃣  Deleting stock-in records...');
    await client.query('DELETE FROM stock_ins');

    // ============================================================
    // STEP 3: Delete all products
    // ============================================================
    console.log('6️⃣  Deleting all products...');
    await client.query('DELETE FROM products');

    console.log('\n✅ All products and related data cleared!\n');

    // ============================================================
    // STEP 4: Insert fresh test products
    // ============================================================
    console.log('📦 Inserting test products...\n');

    const testProducts = [
      { code: 'TEA001', name: 'Black Tea 500g', price: 85.00, unit: 'box', opening_stock: 20, threshold: 5 },
      { code: 'TEA002', name: 'Green Tea 500g', price: 95.00, unit: 'box', opening_stock: 15, threshold: 5 },
      { code: 'MILK001', name: 'Fresh Milk 1L', price: 12.00, unit: 'pcs', opening_stock: 50, threshold: 10 },
      { code: 'BREAD001', name: 'White Bread Loaf', price: 5.00, unit: 'pcs', opening_stock: 40, threshold: 10 },
      { code: 'BUTTER001', name: 'Creamery Butter 200g', price: 28.00, unit: 'pcs', opening_stock: 25, threshold: 5 },
      { code: 'SUGAR001', name: 'Sugar 1kg', price: 6.00, unit: 'pcs', opening_stock: 60, threshold: 10 },
      { code: 'SALT001', name: 'Sea Salt 500g', price: 4.50, unit: 'pcs', opening_stock: 35, threshold: 5 },
      { code: 'OIL001', name: 'Cooking Oil 1L', price: 18.00, unit: 'bottle', opening_stock: 30, threshold: 5 },
      { code: 'RICE001', name: 'Jasmine Rice 5kg', price: 45.00, unit: 'bag', opening_stock: 20, threshold: 3 },
      { code: 'COFFEE001', name: 'Premium Coffee Beans 250g', price: 120.00, unit: 'pcs', opening_stock: 12, threshold: 3 },
      { code: 'CHOCOLATE001', name: 'Dark Chocolate Bar', price: 15.00, unit: 'pcs', opening_stock: 50, threshold: 10 },
      { code: 'HONEY001', name: 'Raw Honey 500ml', price: 55.00, unit: 'jar', opening_stock: 18, threshold: 3 },
    ];

    const insertProductQuery = `
      INSERT INTO products (code, name, price, unit, opening_stock, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, code, name, price;
    `;

    const insertStockQuery = `
      INSERT INTO stock (product_id, quantity)
      VALUES ($1, $2);
    `;

    const insertMovementQuery = `
      INSERT INTO stock_movements (product_id, type, quantity, reference, note)
      VALUES ($1, 'opening', $2, 'INITIAL_STOCK', 'Opening stock from system initialization');
    `;

    for (const product of testProducts) {
      // Insert product
      const productResult = await client.query(insertProductQuery, [
        product.code,
        product.name,
        product.price,
        product.unit,
        product.opening_stock,
        product.threshold,
      ]);

      const productId = productResult.rows[0].id;

      // Insert stock record
      await client.query(insertStockQuery, [productId, product.opening_stock]);

      // Insert opening stock movement
      await client.query(insertMovementQuery, [productId, product.opening_stock]);

      console.log(`  ✓ ${product.code} — ${product.name} (${product.price} GHS, stock: ${product.opening_stock})`);
    }

    // Reset product ID sequence to the next available ID
    const sequenceQuery = 'SELECT setval(pg_get_serial_sequence(\'products\', \'id\'), (SELECT MAX(id) FROM products) + 1)';
    await client.query(sequenceQuery);

    console.log('\n✅ Test products inserted successfully!\n');

    // Commit transaction
    await client.query('COMMIT');

    console.log('📊 Summary:');
    console.log(`   • Inserted 12 test products`);
    console.log(`   • Total test inventory value: GHS ${testProducts.reduce((sum, p) => sum + (p.price * p.opening_stock), 0).toFixed(2)}`);
    console.log('\n✨ Database reset complete! Ready for testing.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during clear and seed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearAndSeed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
