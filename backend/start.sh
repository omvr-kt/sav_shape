#!/bin/bash

################################################################################
# SCRIPT DE DÉMARRAGE ULTRA-PERSISTANT
#
# Ce script démarre le superviseur en mode complètement détaché :
# - nohup : Ignore les signaux HUP (déconnexion SSH)
# - disown : Retire le processus du job control du shell
# - & : Lance en arrière-plan
#
# Le processus survit à 100% aux déconnexions SSH
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
SUPERVISOR_SCRIPT="$BACKEND_DIR/supervisor.js"
SUPERVISOR_PID_FILE="$BACKEND_DIR/.supervisor.pid"
LOG_FILE="$BACKEND_DIR/logs/startup.log"

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Créer le dossier de logs
mkdir -p "$BACKEND_DIR/logs"

log "=========================================="
log "🚀 DÉMARRAGE DU BACKEND SAV"
log "=========================================="

# Vérifier si le superviseur tourne déjà
if [ -f "$SUPERVISOR_PID_FILE" ]; then
    OLD_PID=$(cat "$SUPERVISOR_PID_FILE")

    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log "⚠️  Superviseur déjà actif (PID: $OLD_PID)"
        log "   Pour redémarrer, utilisez: bash stop.sh puis bash start.sh"
        exit 0
    else
        log "🗑️  Nettoyage PID obsolète: $OLD_PID"
        rm -f "$SUPERVISOR_PID_FILE"
    fi
fi

# Arrêter tout processus backend existant proprement
log "🛑 Arrêt des processus existants..."
bash "$BACKEND_DIR/stop.sh" >> "$LOG_FILE" 2>&1 || true

# Petit délai
sleep 2

# Démarrer le superviseur en mode ultra-détaché
log "🚀 Démarrage du superviseur en mode persistant..."
cd "$BACKEND_DIR"

# Lancer avec nohup, redirection complète et disown
nohup node "$SUPERVISOR_SCRIPT" >> "$LOG_FILE" 2>&1 </dev/null &

# Récupérer le PID
SUPERVISOR_PID=$!

# Disown pour retirer complètement du job control
disown -h "$SUPERVISOR_PID" 2>/dev/null || true

log "✅ Superviseur démarré avec PID: $SUPERVISOR_PID"

# Attendre que le backend démarre
log "⏳ Attente du démarrage du backend..."
sleep 6

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
    log "❌ Le backend ne répond pas après $MAX_CHECKS tentatives"
    log "📋 Vérifiez les logs:"
    log "   tail -f $BACKEND_DIR/logs/supervisor-out.log"
    log "   tail -f $BACKEND_DIR/logs/backend-out.log"
    exit 1
fi

log "=========================================="
log "✅ BACKEND DÉMARRÉ AVEC SUCCÈS"
log "=========================================="
log ""
log "📊 Processus actifs:"
ps aux | grep -E "(supervisor|node.*server)" | grep -v grep
log ""
log "📝 Logs du superviseur:"
log "   tail -f $BACKEND_DIR/logs/supervisor-out.log"
log ""
log "📝 Logs du backend:"
log "   tail -f $BACKEND_DIR/logs/backend-out.log"
log ""
log "🔄 Pour arrêter:"
log "   bash $BACKEND_DIR/stop.sh"
log ""
log "🔄 Pour redémarrer:"
log "   bash $BACKEND_DIR/restart.sh"
log ""
log "✨ Le backend survivra aux déconnexions SSH"
log ""

exit 0
