#!/usr/bin/env node

/**
 * Watchdog - Surveillance continue du backend SAV
 * Ce script s'exécute en permanence et vérifie que le backend est actif
 * Si le backend ne répond pas, il le redémarre automatiquement
 */

const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  BACKEND_DIR: '/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend',
  HEALTH_URL: 'http://localhost:5000/api/health',
  CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  STARTUP_CHECK_INTERVAL: 30 * 1000, // 30 secondes pendant le démarrage
  MAX_STARTUP_CHECKS: 10, // 10 tentatives au démarrage = 5 minutes
  LOG_FILE: '/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend/logs/watchdog.log'
};

let startupChecks = 0;

// Fonction de logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;

  console.log(logMessage.trim());

  try {
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage);
  } catch (err) {
    console.error('Erreur lors de l\'écriture du log:', err.message);
  }
}

// Vérifier que le serveur répond
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(CONFIG.HEALTH_URL, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Vérifier si PM2 gère le processus
function checkPM2Process() {
  return new Promise((resolve) => {
    exec('pm2 jlist', (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }

      try {
        const processes = JSON.parse(stdout);
        const savBackend = processes.find(p => p.name === 'sav-backend');
        resolve(savBackend && savBackend.pm2_env.status === 'online');
      } catch (err) {
        resolve(false);
      }
    });
  });
}

// Redémarrer le backend
function restartBackend() {
  return new Promise((resolve) => {
    log('Tentative de redémarrage du backend...', 'WARN');

    // Vérifier d'abord si le processus existe dans PM2
    exec('pm2 jlist', (error, stdout) => {
      if (error) {
        log(`Erreur PM2: ${error.message}`, 'ERROR');
        resolve(false);
        return;
      }

      try {
        const processes = JSON.parse(stdout);
        const savBackend = processes.find(p => p.name === 'sav-backend');

        let restartCmd;
        if (savBackend) {
          // Le processus existe, utiliser restart
          restartCmd = 'pm2 restart sav-backend';
          log('Process PM2 trouvé, utilisation de restart', 'INFO');
        } else {
          // Le processus n'existe pas, utiliser start
          restartCmd = `cd ${CONFIG.BACKEND_DIR} && pm2 start ecosystem.config.js`;
          log('Process PM2 non trouvé, utilisation de start', 'INFO');
        }

        exec(restartCmd, (error, stdout, stderr) => {
          if (error) {
            log(`Erreur lors du redémarrage: ${error.message}`, 'ERROR');
            log(`stderr: ${stderr}`, 'ERROR');
            resolve(false);
            return;
          }

          log('Commande de redémarrage exécutée', 'INFO');

          // Attendre 10 secondes que le serveur démarre
          setTimeout(() => {
            resolve(true);
          }, 10000);
        });
      } catch (err) {
        log(`Erreur parsing PM2: ${err.message}`, 'ERROR');
        resolve(false);
      }
    });
  });
}

// Vérification principale
async function performCheck() {
  try {
    log('Vérification du statut du backend...', 'INFO');

    const isHealthy = await checkHealth();
    const isPM2Running = await checkPM2Process();

    if (isHealthy && isPM2Running) {
      log('✅ Backend actif et sain', 'INFO');

      // Après 10 checks réussis au démarrage, passer à l'intervalle normal
      if (startupChecks < CONFIG.MAX_STARTUP_CHECKS) {
        startupChecks++;
        if (startupChecks === CONFIG.MAX_STARTUP_CHECKS) {
          log('🎯 Phase de démarrage terminée, passage au mode surveillance normal', 'INFO');
        }
      }

      return true;
    }

    if (!isHealthy) {
      log('⚠️ Backend ne répond pas au health check', 'WARN');
    }

    if (!isPM2Running) {
      log('⚠️ PM2 ne gère pas le processus sav-backend', 'WARN');
    }

    // Tentative de redémarrage
    log('🔄 Lancement de la procédure de redémarrage...', 'WARN');
    const restarted = await restartBackend();

    if (restarted) {
      // Vérifier que le redémarrage a réussi
      await new Promise(resolve => setTimeout(resolve, 5000));
      const isHealthyAfter = await checkHealth();

      if (isHealthyAfter) {
        log('✅ Backend redémarré avec succès', 'INFO');
        return true;
      } else {
        log('❌ Backend redémarré mais ne répond toujours pas', 'ERROR');
        return false;
      }
    } else {
      log('❌ Échec du redémarrage du backend', 'ERROR');
      return false;
    }

  } catch (err) {
    log(`Erreur lors de la vérification: ${err.message}`, 'ERROR');
    return false;
  }
}

// Boucle de surveillance
async function watchLoop() {
  await performCheck();

  // Utiliser un intervalle plus court pendant les 10 premiers checks (phase de démarrage)
  const interval = startupChecks < CONFIG.MAX_STARTUP_CHECKS
    ? CONFIG.STARTUP_CHECK_INTERVAL
    : CONFIG.CHECK_INTERVAL;

  const minutes = Math.floor(interval / 60000);
  const seconds = Math.floor((interval % 60000) / 1000);
  const timeStr = minutes > 0 ? `${minutes}min` : `${seconds}s`;

  log(`Prochaine vérification dans ${timeStr}`, 'INFO');
  setTimeout(watchLoop, interval);
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  log('Arrêt du watchdog (SIGINT)', 'INFO');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Arrêt du watchdog (SIGTERM)', 'INFO');
  process.exit(0);
});

// Démarrage
log('═══════════════════════════════════════════════', 'INFO');
log('🐕 Watchdog du backend SAV démarré', 'INFO');
log(`Vérification toutes les ${CONFIG.CHECK_INTERVAL / 60000} minutes`, 'INFO');
log(`Checks rapides pendant ${CONFIG.MAX_STARTUP_CHECKS * CONFIG.STARTUP_CHECK_INTERVAL / 60000} minutes de démarrage`, 'INFO');
log('═══════════════════════════════════════════════', 'INFO');

// Lancer la première vérification immédiatement
watchLoop();
