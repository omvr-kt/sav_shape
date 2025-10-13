#!/bin/bash

################################################################################
# Script de démarrage ULTRA-ROBUSTE pour le backend SAV
# Ce script garantit que le backend démarre et reste actif en TOUTES circonstances
################################################################################

set -e  # Arrêter en cas d'erreur

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
LOG_DIR="$BACKEND_DIR/logs"
STARTUP_LOG="$LOG_DIR/startup-persistent.log"

# Fonction de logging avec timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$STARTUP_LOG"
}

# Créer le répertoire de logs
mkdir -p "$LOG_DIR"

log "=========================================="
log "🚀 DÉMARRAGE DU SYSTÈME BACKEND SAV"
log "=========================================="

# Se déplacer dans le répertoire backend
cd "$BACKEND_DIR"

# Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
    log "⚠️  node_modules manquant, installation des dépendances..."
    npm install --production
fi

# Arrêter proprement tous les processus PM2 existants
log "🛑 Arrêt des processus existants..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# Petit délai pour s'assurer que tout est bien arrêté
sleep 2

log "🔄 Redémarrage du daemon PM2..."
pm2 ping

# Démarrer le backend avec PM2
log "🚀 Démarrage du backend SAV..."
pm2 start ecosystem.config.js

# Attendre que le backend démarre
log "⏳ Attente du démarrage du backend..."
sleep 5

# Vérifier que le backend répond
MAX_CHECKS=10
CHECK_COUNT=0
BACKEND_OK=false

while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
    HTTP_CODE=$(curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" == "200" ]; then
        BACKEND_OK=true
        log "✅ Backend opérationnel (HTTP $HTTP_CODE)"
        break
    fi

    CHECK_COUNT=$((CHECK_COUNT + 1))
    log "⏳ Tentative $CHECK_COUNT/$MAX_CHECKS... (HTTP $HTTP_CODE)"
    sleep 2
done

if [ "$BACKEND_OK" = false ]; then
    log "❌ ERREUR: Le backend ne répond pas après $MAX_CHECKS tentatives"
    log "📋 Logs PM2:"
    pm2 logs sav-backend --lines 50 --nostream
    exit 1
fi

# Démarrer le watchdog
log "🔍 Démarrage du watchdog..."
pm2 start "$BACKEND_DIR/watchdog.js" --name "sav-watchdog"

# Attendre que le watchdog démarre
sleep 3

# Vérifier les statuts PM2
log "📊 Statut des processus PM2:"
pm2 list

# Sauvegarder la configuration PM2 pour résurrection automatique
log "💾 Sauvegarde de la configuration PM2..."
pm2 save --force

# Configurer PM2 pour démarrer automatiquement (tenter sans sudo)
log "🔐 Configuration du démarrage automatique PM2..."
pm2 startup 2>&1 | tee -a "$STARTUP_LOG" || log "⚠️  Note: pm2 startup nécessite des privilèges élevés (ignoré)"

log "=========================================="
log "✅ SYSTÈME BACKEND DÉMARRÉ AVEC SUCCÈS"
log "=========================================="
log ""
log "📊 Processus actifs:"
pm2 list
log ""
log "📝 Pour voir les logs en temps réel:"
log "   pm2 logs"
log ""
log "📝 Pour voir le statut:"
log "   pm2 status"
log ""
log "🔄 Pour redémarrer:"
log "   pm2 restart all"
log ""

exit 0
