#!/bin/bash

################################################################################
# KEEP-ALIVE ULTRA-ROBUSTE - Garantit que le backend reste TOUJOURS actif
#
# Ce script vérifie PM2 et redémarre tout le système si nécessaire.
# À exécuter via cron toutes les 5 minutes ou plus fréquemment.
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
LOG_FILE="$BACKEND_DIR/logs/keep-alive.log"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Créer le dossier de logs
mkdir -p "$BACKEND_DIR/logs"

log "🔍 Keep-alive check..."

# Vérifier si le backend répond
HEALTH_CHECK=$(curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
    log "✅ Backend OK"
    exit 0
fi

log "⚠️  Backend ne répond pas (HTTP $HEALTH_CHECK), vérification PM2..."

# Vérifier si PM2 daemon tourne
if ! pm2 ping &>/dev/null; then
    log "❌ PM2 daemon non actif, redémarrage complet..."
    cd "$BACKEND_DIR"
    bash "$BACKEND_DIR/start-persistent.sh" >> "$LOG_FILE" 2>&1
    exit $?
fi

# Vérifier si le processus backend existe dans PM2
if ! pm2 describe sav-backend &>/dev/null; then
    log "❌ Processus sav-backend manquant, redémarrage..."
    cd "$BACKEND_DIR"
    pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
    pm2 save --force >> "$LOG_FILE" 2>&1
fi

# Vérifier si le watchdog existe dans PM2
if ! pm2 describe sav-watchdog &>/dev/null; then
    log "⚠️  Watchdog manquant, redémarrage..."
    pm2 start "$BACKEND_DIR/watchdog.js" --name "sav-watchdog" >> "$LOG_FILE" 2>&1
    pm2 save --force >> "$LOG_FILE" 2>&1
fi

# Attendre 5 secondes et re-vérifier
sleep 5
HEALTH_CHECK_AFTER=$(curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK_AFTER" == "200" ]; then
    log "✅ Backend redémarré avec succès"
else
    log "❌ Backend toujours down après redémarrage (HTTP $HEALTH_CHECK_AFTER)"
fi

# Nettoyer les vieux logs (garder 7 derniers jours)
find "$BACKEND_DIR/logs" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true

exit 0
