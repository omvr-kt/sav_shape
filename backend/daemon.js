#!/usr/bin/env node

/**
 * DAEMON WRAPPER - Lance le backend en mode daemon véritable
 *
 * Ce script lance le serveur en tant que processus détaché complètement
 * indépendant de la session SSH parent.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = __dirname;
const PID_FILE = path.join(BACKEND_DIR, '.backend.pid');
const LOG_DIR = path.join(BACKEND_DIR, 'logs');
const OUT_LOG = path.join(LOG_DIR, 'daemon-out.log');
const ERR_LOG = path.join(LOG_DIR, 'daemon-error.log');
const SERVER_SCRIPT = path.join(BACKEND_DIR, 'src', 'server.js');

// Créer le dossier de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(OUT_LOG, logMessage);
}

function startServer() {
  log('🚀 Démarrage du backend en mode daemon...');

  // Ouvrir les fichiers de log
  const out = fs.openSync(OUT_LOG, 'a');
  const err = fs.openSync(ERR_LOG, 'a');

  // Lancer le serveur en mode détaché complet
  const child = spawn('node', [SERVER_SCRIPT], {
    detached: true,      // Détacher du processus parent
    stdio: ['ignore', out, err],  // Rediriger stdout/stderr vers fichiers
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SERVER_PORT: 5000,
      TZ: 'Europe/Paris'
    },
    cwd: BACKEND_DIR
  });

  // Détacher complètement le processus enfant
  child.unref();

  // Sauvegarder le PID
  fs.writeFileSync(PID_FILE, child.pid.toString());

  log(`✅ Backend démarré avec PID: ${child.pid}`);
  log(`📝 Logs: ${OUT_LOG}`);
  log(`📝 Errors: ${ERR_LOG}`);

  // Attendre un peu pour s'assurer que ça démarre
  setTimeout(() => {
    const http = require('http');
    const req = http.get('http://localhost:5000/api/health', (res) => {
      if (res.statusCode === 200) {
        log('✅ Backend opérationnel et répond aux requêtes');
        process.exit(0);
      } else {
        log(`⚠️  Backend répond mais status ${res.statusCode}`);
        process.exit(1);
      }
    });

    req.on('error', (err) => {
      log(`❌ Erreur de connexion au backend: ${err.message}`);
      process.exit(1);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      log('❌ Timeout lors de la vérification du backend');
      process.exit(1);
    });
  }, 3000);
}

// Vérifier si un processus tourne déjà
if (fs.existsSync(PID_FILE)) {
  const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));

  try {
    // Vérifier si le processus existe encore
    process.kill(oldPid, 0);
    log(`⚠️  Backend déjà actif avec PID: ${oldPid}`);
    process.exit(0);
  } catch (e) {
    // Le processus n'existe plus
    log(`🗑️  Nettoyage du PID obsolète: ${oldPid}`);
    fs.unlinkSync(PID_FILE);
  }
}

startServer();
