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

const slaService = require('./services/sla');

const app = express();
const PORT = config.server.port;

// Rate limiter - Activé automatiquement en production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Plus strict en production
  message: 'Trop de requêtes, réessayez dans 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
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
