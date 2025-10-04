#!/bin/bash

# Script pour démarrer le monitoring en arrière-plan

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
MONITOR_SCRIPT="$BACKEND_DIR/auto-monitor.sh"
MONITOR_LOG="$BACKEND_DIR/logs/auto-monitor.log"

# Créer le répertoire de logs si nécessaire
mkdir -p "$BACKEND_DIR/logs"

# Démarrer le monitoring en arrière-plan
nohup "$MONITOR_SCRIPT" >> "$MONITOR_LOG" 2>&1 &

echo "✅ Monitoring automatique démarré en arrière-plan"
echo "   PID: $!"
echo "   Logs: $MONITOR_LOG"
echo ""
echo "Pour vérifier le statut:"
echo "  ps aux | grep auto-monitor"
echo ""
echo "Pour arrêter le monitoring:"
echo "  kill $(cat $BACKEND_DIR/.monitor_pid 2>/dev/null || echo 'PID_NOT_FOUND')"