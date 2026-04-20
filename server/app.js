require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const compression = require('compression');
const path        = require('path');
const fs          = require('fs');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger     = require('./utils/logger');

const app = express();

// ── Trust proxy ───────────────────────────────────────────────
// Only enable when behind a known reverse proxy (nginx etc.).
// In development/direct exposure, disable so clients cannot spoof IP via X-Forwarded-For.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // kept off — needed for PDF blob URLs
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"], // inline styles used by React
      imgSrc:      ["'self'", 'data:', 'blob:'],
      fontSrc:     ["'self'"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
    },
  },
  // Prevent MIME-type sniffing
  noSniff: true,
  // Clickjacking protection
  frameguard: { action: 'deny' },
  // XSS filter (legacy browsers)
  xssFilter: true,
  // Hide Express fingerprint
  hidePoweredBy: true,
  // HSTS (uncomment in production with HTTPS)
  // hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      return cb(new Error('CORS: requests without an Origin header are not allowed in production.'));
    }
    // Allow exact matches from CLIENT_URL list
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow all Vercel deployments for this project
    if (origin.match(/^https:\/\/pos-system[-a-z0-9]*\.vercel\.app$/)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// ── Body parsing ─────────────────────────────────────────────
// Limit request body size to prevent large-payload DoS
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── HTTP logging ──────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip:   () => process.env.NODE_ENV === 'test',
}));

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Serve uploaded files (logo, etc.) ────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (process.env.VERCEL !== '1' && !fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
// Serve with nosniff and no-cache so browsers don't execute uploaded content
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(uploadsDir));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/stock',    require('./routes/stock'));
app.use('/api/sales',    require('./routes/sales'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/print',    require('./routes/print'));

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
