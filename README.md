# POS System — Setup & Operations Guide

A production-ready web-based Point of Sale system for small retail shops.

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18, Vite, Axios, React Router v6 |
| Backend   | Node.js, Express 4 |
| Database  | PostgreSQL 14+ |
| Auth      | JWT (access + refresh tokens), bcrypt |
| PDF       | PDFKit |
| Excel     | ExcelJS |
| Logging   | Winston |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

---

## 1. Database Setup

```sql
-- Connect to PostgreSQL as superuser
CREATE USER pos_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE pos_db OWNER pos_user;
GRANT ALL PRIVILEGES ON DATABASE pos_db TO pos_user;
```

---

## 2. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your DB credentials and JWT secrets

# Run database migration (creates all tables)
npm run db:migrate

# Seed with default users and sample products
npm run db:seed

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables (server/.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | pos_db |
| `DB_USER` | Database user | pos_user |
| `DB_PASSWORD` | Database password | — |
| `JWT_SECRET` | JWT signing secret (32+ chars) | — |
| `JWT_EXPIRES_IN` | Access token TTL | 15m |
| `JWT_REFRESH_SECRET` | Refresh token secret | — |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | 7d |
| `BCRYPT_ROUNDS` | bcrypt cost factor | 12 |
| `CLIENT_URL` | Allowed CORS origin | http://localhost:5173 |

---

## 3. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start development server (proxies /api to localhost:5000)
npm run dev

# Build for production
npm run build
```

---

## 4. Default Credentials

> **Change these immediately in production!**

| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | admin    | admin123    |
| Cashier | cashier  | cashier123  |

---

## 5. Receipt Printing

The system uses the browser's `window.print()` API:

1. After a sale is confirmed, the receipt renders in a hidden div
2. `window.print()` is triggered automatically after 250ms
3. The `@media print` CSS hides all UI except the receipt

**Thermal Printer Setup:**
- Install your thermal printer driver and set it as the **system default**
- In your browser, go to Print Settings and:
  - Set paper size to 80mm or 58mm (match your printer)
  - Disable headers/footers
  - Disable margins (set all to 0)
- For enterprise deployments, configure the browser to print without dialog

**If auto-print fails:**
- A "Reprint" button appears below the cart
- The last sale data is kept in state until the next sale
- The cashier can click Reprint to trigger printing again

---

## 6. API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/refresh` | Public | Refresh tokens |
| POST | `/api/auth/logout` | Auth | Logout |
| POST | `/api/auth/change-password` | Auth | Change password |
| GET  | `/api/auth/me` | Auth | Current user |

### Products
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/products` | Auth | List products |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| PATCH | `/api/products/:id/deactivate` | Admin | Deactivate |
| PATCH | `/api/products/:id/activate` | Admin | Activate |

### Sales
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/sales` | Auth | Create sale |
| GET | `/api/sales` | Admin | List all sales |
| GET | `/api/sales/:id` | Auth | Get sale detail |
| PUT | `/api/sales/:id` | Admin | Edit sale |
| PATCH | `/api/sales/:id/void` | Admin | Void sale |

### Stock
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/stock/current` | Auth | Current stock levels |
| POST | `/api/stock/in` | Admin | Record stock-in |
| GET | `/api/stock/in` | Admin | Stock-in history |

### Reports
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/reports/dashboard` | Admin | Dashboard stats |
| GET | `/api/reports/sales/json` | Admin | Sales report (JSON) |
| GET | `/api/reports/sales/pdf` | Admin | Sales report (PDF) |
| GET | `/api/reports/sales/excel` | Admin | Sales report (Excel) |
| GET | `/api/reports/inventory/json` | Admin | Inventory report |
| GET | `/api/reports/today` | Auth | Today's summary |

### Settings
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/settings` | Auth | Get settings |
| PUT | `/api/settings` | Admin | Update settings |

---

## 7. Security Features

- **bcrypt** password hashing (12 rounds)
- **JWT** access + refresh token rotation
- **RBAC** — admin vs cashier role enforcement on every endpoint
- **Joi** input validation and sanitization
- **Parameterized queries** — no SQL injection possible
- **Helmet.js** security headers
- **CORS** restricted to configured origins
- **Rate limiting** — 100 req/15min general, 20 req/15min for login
- **Activity logging** — all significant actions logged to DB
- **Inactivity logout** — 15-minute timer on frontend

---

## 8. Stock Safety

- Every sale runs in a **PostgreSQL transaction**
- **SELECT FOR UPDATE** row-level locking prevents race conditions
- `stock.quantity CHECK >= 0` DB constraint blocks negative stock at DB level
- Sale edits reverse original movements before applying new ones

---

## 9. Production Deployment

### Nginx reverse proxy example

```nginx
server {
    listen 80;
    server_name yourpos.example.com;

    # Frontend (serve built React files)
    root /var/www/pos/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### PM2 process manager

```bash
npm install -g pm2
cd server
pm2 start server.js --name pos-api
pm2 startup
pm2 save
```

---

## 10. Database Backup

```bash
# Daily backup (add to cron)
pg_dump -U pos_user -h localhost pos_db | gzip > /backups/pos_$(date +%Y%m%d).sql.gz

# Cron job example (2 AM daily)
0 2 * * * pg_dump -U pos_user pos_db | gzip > /backups/pos_$(date +\%Y\%m\%d).sql.gz

# Restore from backup
gunzip -c /backups/pos_20240101.sql.gz | psql -U pos_user pos_db
```

---

## 11. Folder Structure

```
POS/
├── server/
│   ├── config/          # DB pool, constants
│   ├── controllers/     # Request handlers
│   ├── database/        # schema.sql, migrate.js, seed.js
│   ├── middleware/       # auth, rbac, rate limiter, error handler
│   ├── routes/          # Express routers
│   ├── services/        # Business logic layer
│   ├── utils/           # logger, receipt number, PDF, Excel
│   ├── validators/      # Joi schemas
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
└── client/
    ├── src/
    │   ├── components/  # Reusable UI components
    │   ├── context/     # AuthContext, SettingsContext
    │   ├── layouts/     # AdminLayout, CashierLayout
    │   ├── pages/
    │   │   ├── admin/   # Dashboard, Products, StockIn, Sales, Reports, Settings
    │   │   └── cashier/ # POS, DailySummary
    │   ├── print/       # ReceiptPrinter component
    │   ├── services/    # Axios API calls
    │   ├── styles/      # global.css
    │   └── utils/       # formatters
    ├── index.html
    └── vite.config.js
```
