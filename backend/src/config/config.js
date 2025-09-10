const path = require('path');

// Environment helpers
const env = (key, fallback) => (process.env[key] !== undefined ? process.env[key] : fallback);

// Server
const NODE_ENV = env('NODE_ENV', 'development');
const SERVER_PORT = parseInt(env('SERVER_PORT', '3000'), 10);

// CORS
const ALLOWED_ORIGINS = env('ALLOWED_ORIGINS', '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Security
const USE_CSP = NODE_ENV === 'production';

// Frontend base URL (used in emails/links)
const FRONTEND_BASE_URL = env('FRONTEND_BASE_URL', `http://localhost:${SERVER_PORT}`);

// SMTP
const SMTP_PORT = parseInt(env('SMTP_PORT', '587'), 10);
const SMTP_SECURE = SMTP_PORT === 465 || env('SMTP_SECURE', 'false') === 'true';
const SMTP_CONFIG = {
  host: env('SMTP_HOST', 'smtp.ethereal.email'),
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: env('SMTP_USER', 'demo@ethereal.email'),
    pass: env('SMTP_PASS', 'demo_password')
  },
  tls: { rejectUnauthorized: false },
  from: env('SMTP_FROM', '"Équipe Support" <support@agency.local>')
};

// SLA
const SLA_CHECK_INTERVAL_MS = parseInt(env('SLA_CHECK_INTERVAL_MS', String(15 * 60 * 1000)), 10);
const SLA_WARNING_THRESHOLD_MS = parseInt(env('SLA_WARNING_THRESHOLD_MS', String(2 * 60 * 60 * 1000)), 10);

// Database
const SQLITE_DB_PATH = env('SQLITE_DB_PATH', path.join(__dirname, '../../database.sqlite'));

module.exports = {
  env: NODE_ENV,
  server: { port: SERVER_PORT },
  cors: { origins: ALLOWED_ORIGINS },
  security: { useCsp: USE_CSP },
  frontend: { baseUrl: FRONTEND_BASE_URL },
  smtp: SMTP_CONFIG,
  sla: {
    checkIntervalMs: SLA_CHECK_INTERVAL_MS,
    warningThresholdMs: SLA_WARNING_THRESHOLD_MS
  },
  db: { sqlitePath: SQLITE_DB_PATH }
};

