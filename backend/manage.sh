#!/bin/bash

################################################################################
# Script de Gestion Simplifié du Backend SAV
# Usage: ./manage.sh [start|stop|restart|status|logs|health]
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"

case "$1" in
    start)
        echo "🚀 Démarrage du backend SAV..."
        cd "$BACKEND_DIR"
        bash start-persistent.sh
        ;;

    stop)
        echo "🛑 Arrêt du backend SAV..."
        pm2 stop all
        echo "✅ Backend arrêté"
        ;;

    restart)
        echo "🔄 Redémarrage du backend SAV..."
        pm2 restart all
        echo "✅ Backend redémarré"
        pm2 status
        ;;

    status)
        echo "📊 Statut du backend SAV:"
        pm2 status
        echo ""
        echo "🏥 Health check:"
        curl -s http://localhost:5000/api/health | head -3
        echo ""
        ;;

    logs)
        echo "📝 Logs du backend (Ctrl+C pour quitter):"
        pm2 logs
        ;;

    health)
        echo "🏥 Vérification de la santé du backend..."
        HEALTH=$(curl -s http://localhost:5000/api/health)
        if [ $? -eq 0 ]; then
            echo "✅ Backend opérationnel"
            echo "$HEALTH"
        else
            echo "❌ Backend ne répond pas"
            exit 1
        fi
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|logs|health}"
        echo ""
        echo "Commandes disponibles:"
        echo "  start   - Démarrer le backend complet"
        echo "  stop    - Arrêter tous les processus"
        echo "  restart - Redémarrer tous les processus"
        echo "  status  - Afficher le statut"
        echo "  logs    - Voir les logs en temps réel"
        echo "  health  - Vérifier la santé du backend"
        exit 1
        ;;
esac
