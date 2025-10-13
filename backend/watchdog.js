#!/usr/bin/env node

/**
 * WATCHDOG INDÉPENDANT POUR LE BACKEND SAV
 *
 * Ce watchdog tourne en continu et surveille la santé du backend.
 * Il redémarre automatiquement le backend s'il ne répond plus.
 *
 * Fonctionnalités:
 * - Vérifie le endpoint /api/health toutes les 30 secondes
 * - Redémarre automatiquement le backend s'il est down
 * - Logs détaillés de toutes les actions
 * - Gère les erreurs de réseau et timeouts
 * - Évite les restart loops avec un backoff exponentiel
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================
// Configuration
// ============================================
const CONFIG = {
  BACKEND_URL: 'http://localhost:5000/api/health',
  CHECK_INTERVAL_NORMAL: 30000,        // 30 secondes en mode normal
  CHECK_INTERVAL_STARTUP: 5000,        // 5 secondes pendant le démarrage
  STARTUP_CHECKS: 6,                   // Nombre de vérifications rapides au démarrage (30s total)
  RESTART_TIMEOUT: 30000,              // Timeout pour le redémarrage
  MAX_CONSECUTIVE_FAILURES: 3,         // Nombre d'échecs avant redémarrage
  BACKOFF_DELAY: 60000,                // Délai supplémentaire après échec de restart (1 min)
  LOG_FILE: path.join(__dirname, 'logs', 'watchdog.log'),
  PM2_APP_NAME: 'sav-backend'
};

// ============================================
// État du watchdog
// ============================================
let consecutiveFailures = 0;
let checkCount = 0;
let lastRestartTime = 0;
let isStartupPhase = true;

// ============================================
// Utilitaires
// ============================================

/**
 * Logger avec timestamp et sauvegarde dans fichier
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  console.log(logMessage);

  try {
    // S'assurer que le dossier logs existe
    const logDir = path.dirname(CONFIG.LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error('Erreur écriture log:', err.message);
  }
}

/**
 * Vérifier si le backend répond
 */
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(CONFIG.BACKEND_URL, { timeout: 5000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            resolve({
              success: true,
              status: res.statusCode,
              data: health
            });
          } catch (e) {
            resolve({
              success: true,
              status: res.statusCode
            });
          }
        } else {
          resolve({
            success: false,
            status: res.statusCode,
            error: `HTTP ${res.statusCode}`
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout'
      });
    });
  });
}

/**
 * Redémarrer le backend via PM2
 */
async function restartBackend() {
  const now = Date.now();
  const timeSinceLastRestart = now - lastRestartTime;

  // Éviter les redémarrages trop fréquents
  if (timeSinceLastRestart < CONFIG.BACKOFF_DELAY) {
    const waitTime = Math.ceil((CONFIG.BACKOFF_DELAY - timeSinceLastRestart) / 1000);
    log('WARN', `Attente de ${waitTime}s avant le prochain redémarrage (cooldown)...`);
    return false;
  }

  log('INFO', `🔄 Tentative de redémarrage du backend...`);
  lastRestartTime = now;

  try {
    // Vérifier si le processus PM2 existe
    try {
      execSync(`pm2 describe ${CONFIG.PM2_APP_NAME}`, {
        stdio: 'pipe',
        timeout: 5000
      });

      // Le processus existe, on le restart
      log('INFO', 'Redémarrage du processus existant...');
      execSync(`pm2 restart ${CONFIG.PM2_APP_NAME}`, {
        stdio: 'pipe',
        timeout: CONFIG.RESTART_TIMEOUT
      });

    } catch (describeErr) {
      // Le processus n'existe pas, on le démarre
      log('INFO', 'Processus non trouvé, démarrage depuis ecosystem.config.js...');
      const backendDir = path.resolve(__dirname);
      execSync(`cd ${backendDir} && pm2 start ecosystem.config.js`, {
        stdio: 'pipe',
        timeout: CONFIG.RESTART_TIMEOUT
      });
    }

    // Sauvegarder la config PM2
    execSync('pm2 save --force', {
      stdio: 'pipe',
      timeout: 5000
    });

    log('INFO', '✅ Commande de redémarrage exécutée avec succès');

    // Attendre un peu pour que le backend démarre
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Vérifier que le backend est bien up
    const health = await checkBackendHealth();

    if (health.success) {
      log('INFO', '✅ Backend redémarré et opérationnel');
      consecutiveFailures = 0;
      isStartupPhase = true; // Repasser en phase de démarrage
      checkCount = 0;
      return true;
    } else {
      log('ERROR', `❌ Backend redémarré mais ne répond pas: ${health.error}`);
      return false;
    }

  } catch (err) {
    log('ERROR', `❌ Erreur lors du redémarrage: ${err.message}`);
    return false;
  }
}

/**
 * Vérification principale
 */
async function performHealthCheck() {
  log('INFO', 'Vérification du statut du backend...');

  const health = await checkBackendHealth();

  if (health.success) {
    log('INFO', `✅ Backend actif et sain`);
    consecutiveFailures = 0;

    // Transition vers le mode normal après la phase de démarrage
    if (isStartupPhase) {
      checkCount++;
      if (checkCount >= CONFIG.STARTUP_CHECKS) {
        isStartupPhase = false;
        log('INFO', '🎯 Phase de démarrage terminée, passage au mode surveillance normal');
      }
    }

  } else {
    consecutiveFailures++;
    log('WARN', `⚠️  Backend ne répond pas (${consecutiveFailures}/${CONFIG.MAX_CONSECUTIVE_FAILURES}): ${health.error || 'Erreur inconnue'}`);

    // Redémarrer après plusieurs échecs consécutifs
    if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
      log('ERROR', `❌ Backend down après ${consecutiveFailures} échecs consécutifs`);

      const restarted = await restartBackend();

      if (!restarted) {
        log('ERROR', '❌ ÉCHEC DU REDÉMARRAGE - alerte critique nécessaire');
      }

      consecutiveFailures = 0; // Reset pour éviter les restart loops
    }
  }
}

/**
 * Boucle principale du watchdog
 */
async function mainLoop() {
  await performHealthCheck();

  // Déterminer l'intervalle de la prochaine vérification
  const nextInterval = isStartupPhase
    ? CONFIG.CHECK_INTERVAL_STARTUP
    : CONFIG.CHECK_INTERVAL_NORMAL;

  const nextCheckIn = Math.ceil(nextInterval / 1000);
  log('INFO', `Prochaine vérification dans ${nextCheckIn}s`);

  setTimeout(mainLoop, nextInterval);
}

/**
 * Gestion des signaux pour arrêt propre
 */
function setupSignalHandlers() {
  const signals = ['SIGTERM', 'SIGINT'];

  signals.forEach(signal => {
    process.on(signal, () => {
      log('INFO', `Signal ${signal} reçu, arrêt du watchdog...`);
      process.exit(0);
    });
  });

  process.on('uncaughtException', (err) => {
    log('ERROR', `Exception non gérée: ${err.message}`);
    log('ERROR', err.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log('ERROR', `Promise rejetée non gérée: ${reason}`);
  });
}

/**
 * Démarrage du watchdog
 */
function start() {
  log('INFO', '========================================');
  log('INFO', '🚀 DÉMARRAGE DU WATCHDOG BACKEND SAV');
  log('INFO', '========================================');
  log('INFO', `URL surveillée: ${CONFIG.BACKEND_URL}`);
  log('INFO', `Intervalle startup: ${CONFIG.CHECK_INTERVAL_STARTUP / 1000}s`);
  log('INFO', `Intervalle normal: ${CONFIG.CHECK_INTERVAL_NORMAL / 1000}s`);
  log('INFO', `Seuil d'échecs: ${CONFIG.MAX_CONSECUTIVE_FAILURES}`);
  log('INFO', '========================================');

  setupSignalHandlers();
  mainLoop();
}

// Démarrer le watchdog
start();
