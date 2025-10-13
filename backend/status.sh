#!/bin/bash

################################################################################
# SCRIPT DE STATUT COMPLET DU BACKEND
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
SUPERVISOR_PID_FILE="$BACKEND_DIR/.supervisor.pid"
BACKEND_PID_FILE="$BACKEND_DIR/.backend.pid"

echo "=========================================="
echo "📊 STATUT DU BACKEND SAV"
echo "=========================================="
echo ""

# Vérifier le superviseur
echo "🔧 Superviseur:"
if [ -f "$SUPERVISOR_PID_FILE" ]; then
    SUPERVISOR_PID=$(cat "$SUPERVISOR_PID_FILE")
    if ps -p "$SUPERVISOR_PID" > /dev/null 2>&1; then
        UPTIME=$(ps -p "$SUPERVISOR_PID" -o etime= | xargs)
        MEM=$(ps -p "$SUPERVISOR_PID" -o rss= | xargs)
        MEM_MB=$((MEM / 1024))
        echo "   ✅ Actif (PID: $SUPERVISOR_PID)"
        echo "   ⏱️  Uptime: $UPTIME"
        echo "   💾 Mémoire: ${MEM_MB}MB"
    else
        echo "   ❌ Arrêté (PID obsolète: $SUPERVISOR_PID)"
    fi
else
    echo "   ❌ Pas de fichier PID"
fi

echo ""

# Vérifier le backend
echo "🚀 Backend:"
if [ -f "$BACKEND_PID_FILE" ]; then
    BACKEND_PID=$(cat "$BACKEND_PID_FILE")
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        UPTIME=$(ps -p "$BACKEND_PID" -o etime= | xargs)
        MEM=$(ps -p "$BACKEND_PID" -o rss= | xargs)
        MEM_MB=$((MEM / 1024))
        echo "   ✅ Actif (PID: $BACKEND_PID)"
        echo "   ⏱️  Uptime: $UPTIME"
        echo "   💾 Mémoire: ${MEM_MB}MB"
    else
        echo "   ❌ Arrêté (PID obsolète: $BACKEND_PID)"
    fi
else
    echo "   ❌ Pas de fichier PID"
fi

echo ""

# Tester le health endpoint
echo "🏥 Health Check:"
HTTP_CODE=$(curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    HEALTH=$(curl -s http://localhost:5000/api/health 2>/dev/null)
    echo "   ✅ Backend répond (HTTP $HTTP_CODE)"
    echo "   📄 $HEALTH"
else
    echo "   ❌ Backend ne répond pas (HTTP $HTTP_CODE)"
fi

echo ""
echo "=========================================="
echo "📝 Dernières Activités:"
echo "=========================================="

# Dernières lignes des logs du superviseur
if [ -f "$BACKEND_DIR/logs/supervisor-out.log" ]; then
    echo ""
    echo "🔧 Superviseur (5 dernières lignes):"
    tail -5 "$BACKEND_DIR/logs/supervisor-out.log"
fi

# Dernières lignes des logs du backend
if [ -f "$BACKEND_DIR/logs/backend-out.log" ]; then
    echo ""
    echo "🚀 Backend (5 dernières lignes):"
    tail -5 "$BACKEND_DIR/logs/backend-out.log" | grep -v "^$"
fi

echo ""
echo "=========================================="
echo "🛠️  Commandes:"
echo "=========================================="
echo "  Démarrer:   bash $BACKEND_DIR/start.sh"
echo "  Arrêter:    bash $BACKEND_DIR/stop.sh"
echo "  Redémarrer: bash $BACKEND_DIR/restart.sh"
echo "  Logs:       tail -f $BACKEND_DIR/logs/supervisor-out.log"
echo "=========================================="
