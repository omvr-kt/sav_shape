#!/bin/bash

################################################################################
# SCRIPT D'ARRÊT PROPRE DU BACKEND
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
SUPERVISOR_PID_FILE="$BACKEND_DIR/.supervisor.pid"
BACKEND_PID_FILE="$BACKEND_DIR/.backend.pid"
LOG_FILE="$BACKEND_DIR/logs/startup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

mkdir -p "$BACKEND_DIR/logs"

log "🛑 Arrêt du backend SAV..."

# Arrêter le superviseur
if [ -f "$SUPERVISOR_PID_FILE" ]; then
    SUPERVISOR_PID=$(cat "$SUPERVISOR_PID_FILE")

    if ps -p "$SUPERVISOR_PID" > /dev/null 2>&1; then
        log "Arrêt du superviseur (PID: $SUPERVISOR_PID)..."
        kill -TERM "$SUPERVISOR_PID" 2>/dev/null || kill -9 "$SUPERVISOR_PID" 2>/dev/null
        sleep 2
        log "✅ Superviseur arrêté"
    fi

    rm -f "$SUPERVISOR_PID_FILE"
fi

# Arrêter le backend directement si nécessaire
if [ -f "$BACKEND_PID_FILE" ]; then
    BACKEND_PID=$(cat "$BACKEND_PID_FILE")

    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        log "Arrêt du backend (PID: $BACKEND_PID)..."
        kill -TERM "$BACKEND_PID" 2>/dev/null || kill -9 "$BACKEND_PID" 2>/dev/null
        sleep 2
        log "✅ Backend arrêté"
    fi

    rm -f "$BACKEND_PID_FILE"
fi

# Vérifier s'il reste des processus
REMAINING=$(ps aux | grep -E "node.*(server|supervisor)" | grep -v grep | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    log "⚠️  Il reste des processus Node.js, nettoyage..."
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "node.*supervisor.js" 2>/dev/null || true
    sleep 2
fi

log "✅ Arrêt terminé"

exit 0
