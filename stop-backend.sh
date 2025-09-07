#!/bin/bash

# Script d'arrêt pour Shape SAV Backend
# Usage: ./stop-backend.sh

echo "🛑 Arrêt du backend Shape SAV..."

cd backend

if [ -f ".server_pid" ]; then
    PID=$(cat .server_pid)
    if kill -0 $PID 2>/dev/null; then
        echo "🔄 Arrêt du serveur (PID: $PID)..."
        kill $PID
        
        # Attendre que le processus se termine
        sleep 2
        
        # Forcer l'arrêt si nécessaire
        if kill -0 $PID 2>/dev/null; then
            echo "⚠️  Force l'arrêt du serveur..."
            kill -9 $PID 2>/dev/null
        fi
        
        rm .server_pid
        echo "✅ Serveur arrêté avec succès"
    else
        echo "⚠️  Le serveur n'est pas en cours d'exécution (PID introuvable)"
        rm .server_pid
    fi
else
    # Chercher les processus Node.js qui correspondent à notre serveur
    PIDS=$(pgrep -f "node src/server.js")
    if [ -n "$PIDS" ]; then
        echo "🔍 Processus trouvés sans fichier PID: $PIDS"
        for PID in $PIDS; do
            echo "🔄 Arrêt du processus $PID..."
            kill $PID
        done
        sleep 2
        
        # Vérifier s'il reste des processus
        REMAINING=$(pgrep -f "node src/server.js")
        if [ -n "$REMAINING" ]; then
            echo "⚠️  Force l'arrêt des processus restants..."
            pkill -9 -f "node src/server.js"
        fi
        echo "✅ Tous les processus serveur ont été arrêtés"
    else
        echo "❌ Aucun serveur en cours d'exécution trouvé"
    fi
fi