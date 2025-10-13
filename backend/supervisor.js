#!/usr/bin/env node

/**
 * SUPERVISEUR - Surveille et redémarre le backend automatiquement
 *
 * Ce superviseur tourne en permanence et :
 * - Vérifie que le backend répond toutes les 30 secondes
 * - Redémarre le backend s'il ne répond plus
 * - Se détache complètement de SSH
 * - Survit aux déconnexions
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BACKEND_DIR: __dirname,
  SERVER_SCRIPT: path.join(__dirname, 'src', 'server.js'),
  PID_FILE: path.join(__dirname, '.backend.pid'),
  SUPERVISOR_PID_FILE: path.join(__dirname, '.supervisor.pid'),
  LOG_DIR: path.join(__dirname, 'logs'),
  OUT_LOG: path.join(__dirname, 'logs', 'supervisor-out.log'),
  ERR_LOG: path.join(__dirname, 'logs', 'supervisor-error.log'),
  BACKEND_OUT_LOG: path.join(__dirname, 'logs', 'backend-out.log'),
  BACKEND_ERR_LOG: path.join(__dirname, 'logs', 'backend-error.log'),
  HEALTH_URL: 'http://localhost:5000/api/health',
  CHECK_INTERVAL: 30000,  // 30 secondes
  STARTUP_CHECK_INTERVAL: 5000,  // 5 secondes au démarrage
  MAX_STARTUP_CHECKS: 6,  // 30 secondes de checks rapides
  MAX_FAILURES: 3,
  RESTART_COOLDOWN: 60000  // 1 minute
};

let backendProcess = null;
let consecutiveFailures = 0;
let startupChecks = 0;
let lastRestartTime = 0;

// Créer le dossier de logs
if (!fs.existsSync(CONFIG.LOG_DIR)) {
  fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);

  try {
    fs.appendFileSync(CONFIG.OUT_LOG, logMessage + '\n');
  } catch (err) {
    console.error('Erreur écriture log:', err.message);
  }
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(CONFIG.HEALTH_URL, { timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackend() {
  const now = Date.now();
  const timeSinceLastRestart = now - lastRestartTime;

  if (timeSinceLastRestart < CONFIG.RESTART_COOLDOWN) {
    const waitTime = Math.ceil((CONFIG.RESTART_COOLDOWN - timeSinceLastRestart) / 1000);
    log('WARN', `Cooldown actif, attente de ${waitTime}s...`);
    return false;
  }

  log('INFO', '🚀 Démarrage du backend...');
  lastRestartTime = now;

  try {
    // Tuer l'ancien processus s'il existe
    if (backendProcess) {
      try {
        backendProcess.kill('SIGTERM');
        log('INFO', 'Ancien processus terminé');
      } catch (e) {
        // Ignore
      }
    }

    // Ouvrir les fichiers de log
    const out = fs.openSync(CONFIG.BACKEND_OUT_LOG, 'a');
    const err = fs.openSync(CONFIG.BACKEND_ERR_LOG, 'a');

    // Lancer le backend
    backendProcess = spawn('node', [CONFIG.SERVER_SCRIPT], {
      detached: false,  // Le superviseur gère le processus
      stdio: ['ignore', out, err],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SERVER_PORT: 5000,
        TZ: 'Europe/Paris'
      },
      cwd: CONFIG.BACKEND_DIR
    });

    const pid = backendProcess.pid;
    fs.writeFileSync(CONFIG.PID_FILE, pid.toString());
    log('INFO', `✅ Backend démarré avec PID: ${pid}`);

    // Gérer la fermeture du backend
    backendProcess.on('exit', (code, signal) => {
      log('WARN', `Backend arrêté (code: ${code}, signal: ${signal})`);
      backendProcess = null;

      // Redémarrer après un court délai
      setTimeout(() => {
        log('INFO', 'Redémarrage automatique du backend...');
        startBackend();
      }, 5000);
    });

    backendProcess.on('error', (err) => {
      log('ERROR', `Erreur backend: ${err.message}`);
    });

    // Reset des échecs après un démarrage
    consecutiveFailures = 0;
    startupChecks = 0;

    return true;
  } catch (err) {
    log('ERROR', `Erreur lors du démarrage: ${err.message}`);
    return false;
  }
}

async function performHealthCheck() {
  log('INFO', 'Vérification du backend...');

  const isHealthy = await checkBackendHealth();

  if (isHealthy) {
    log('INFO', '✅ Backend OK');
    consecutiveFailures = 0;

    // Passer en mode normal après les checks de démarrage
    if (startupChecks < CONFIG.MAX_STARTUP_CHECKS) {
      startupChecks++;
      if (startupChecks === CONFIG.MAX_STARTUP_CHECKS) {
        log('INFO', '🎯 Phase de démarrage terminée, mode surveillance normal');
      }
    }
  } else {
    consecutiveFailures++;
    log('WARN', `⚠️  Backend ne répond pas (${consecutiveFailures}/${CONFIG.MAX_FAILURES})`);

    if (consecutiveFailures >= CONFIG.MAX_FAILURES) {
      log('ERROR', '❌ Backend down, redémarrage...');
      startBackend();
      consecutiveFailures = 0;
    }
  }
}

async function mainLoop() {
  await performHealthCheck();

  const interval = startupChecks < CONFIG.MAX_STARTUP_CHECKS
    ? CONFIG.STARTUP_CHECK_INTERVAL
    : CONFIG.CHECK_INTERVAL;

  setTimeout(mainLoop, interval);
}

function setupSignalHandlers() {
  ['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
      log('INFO', `Signal ${signal} reçu, arrêt du superviseur...`);

      if (backendProcess) {
        backendProcess.kill('SIGTERM');
      }

      // Nettoyer les PID files
      try {
        fs.unlinkSync(CONFIG.PID_FILE);
        fs.unlinkSync(CONFIG.SUPERVISOR_PID_FILE);
      } catch (e) {
        // Ignore
      }

      process.exit(0);
    });
  });

  process.on('uncaughtException', (err) => {
    log('ERROR', `Exception non gérée: ${err.message}`);
    log('ERROR', err.stack);
  });

  process.on('unhandledRejection', (reason) => {
    log('ERROR', `Promise rejetée: ${reason}`);
  });
}

function main() {
  log('INFO', '========================================');
  log('INFO', '🔧 SUPERVISEUR BACKEND SAV');
  log('INFO', '========================================');

  // Sauvegarder le PID du superviseur
  fs.writeFileSync(CONFIG.SUPERVISOR_PID_FILE, process.pid.toString());
  log('INFO', `Superviseur PID: ${process.pid}`);

  setupSignalHandlers();

  // Démarrer le backend immédiatement
  if (startBackend()) {
    // Attendre un peu puis commencer la surveillance
    setTimeout(() => {
      log('INFO', 'Démarrage de la surveillance...');
      mainLoop();
    }, 5000);
  } else {
    log('ERROR', 'Impossible de démarrer le backend');
    process.exit(1);
  }
}

main();
