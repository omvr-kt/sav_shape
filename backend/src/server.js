const fs = require('fs');
const path = require('path');

// Vérification obligatoire du setup
const setupFlagPath = path.join(__dirname, '../.setup-complete');
const envPath = path.join(__dirname, '../.env');

if (!fs.existsSync(setupFlagPath) || !fs.existsSync(envPath)) {
  console.error('ERREUR: Configuration initiale requise');
  console.error('Lancez: node setup.js');
  process.exit(1);
}

require('dotenv').config();

// Vérification des variables critiques
const criticalVars = ['JWT_SECRET', 'ADMIN_DEFAULT_PASSWORD'];
const missing = criticalVars.filter(v => !process.env[v] || process.env[v].includes('your_') || process.env[v].includes('change_this'));

if (missing.length > 0) {
  console.error('ERREUR: Variables critiques manquantes ou non configurées:', missing);
  console.error('Relancez: node setup.js');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');
const { initDatabase } = require('./utils/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const ticketRoutes = require('./routes/tickets');
const commentRoutes = require('./routes/comments');
const slaRoutes = require('./routes/sla');
const attachmentRoutes = require('./routes/attachments');
const { router: invoiceRoutes } = require('./routes/invoices');
const settingsRoutes = require('./routes/settings');
const devRoutes = require('./routes/dev');
const devCommentsRoutes = require('./routes/dev-comments');

const slaService = require('./services/sla');
const { addKanbanTables } = require('../migrations/add_kanban_tables');

const app = express();
const PORT = config.server.port;

// Configuration trust proxy pour Hostinger (IP spécifique pour sécurité)
app.set('trust proxy', 1);

// Rate limiter - Configuré pour le développement
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 2000, // Limites plus élevées
  message: 'Trop de requêtes, réessayez dans 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for local requests et admin
    return req.ip === '127.0.0.1' || req.ip === '::1' || req.headers.host?.includes('localhost');
  }
});

app.use(helmet({
  contentSecurityPolicy: config.security.useCsp ? undefined : false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (config.cors.origins.length ? config.cors.origins : false)
    : true
}));

if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
}
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes spécifiques AVANT le middleware statique
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/connexion.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/dev', devCommentsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware statique APRÈS les routes spécifiques
app.use(express.static(path.join(__dirname, '../../frontend')));

// Client routes
app.get('/connexion', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/connexion.html'));
});

app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('/admin/login', (req, res) => {
  res.redirect('/');
});

app.get('/client/login', (req, res) => {
  res.redirect('/');
});

app.get('/client/', (req, res) => {
  res.redirect('/');
});

app.get('/client', (req, res) => {
  res.redirect('/');
});

// Redirections vers la page tickets pour les anciennes routes
app.get('/client/overview', (req, res) => {
  res.redirect('/client/tickets.html');
});

app.get('/client/projects', (req, res) => {
  res.redirect('/client/tickets.html');
});

app.get('/client/tickets', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/client/tickets.html'));
});

app.get('/client/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/client/profile.html'));
});

app.get('/client/invoices', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/client/invoices.html'));
});

// Routes développeur
app.get('/dev/kanban', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dev/kanban.html'));
});

app.get('/dev', (req, res) => {
  res.redirect('/dev/kanban');
});

app.get('/test-navigation', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/test-navigation.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    // Ensure Kanban-related tables exist (idempotent)
    try {
      await addKanbanTables();
      console.log('Kanban tables ensured');
    } catch (migrateErr) {
      console.error('Failed to ensure Kanban tables:', migrateErr);
    }
    
    // Start SLA monitoring service
    slaService.start();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Uploads directory: ${path.join(__dirname, '../uploads')}`);
      console.log(`SLA monitoring service started`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  slaService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  slaService.stop();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

startServer();
