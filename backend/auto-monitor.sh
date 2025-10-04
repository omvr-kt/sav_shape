#!/bin/bash

# Script d'auto-monitoring du backend SAV
# À exécuter en boucle infinie pour surveiller le serveur

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
CHECK_SCRIPT="$BACKEND_DIR/check-backend.sh"
INTERVAL=300  # Vérification toutes les 5 minutes (300 secondes)
PID_FILE="$BACKEND_DIR/.monitor_pid"

# Vérifier si un autre processus de monitoring est déjà en cours
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Un processus de monitoring est déjà en cours (PID: $OLD_PID)"
        exit 1
    fi
fi

# Enregistrer le PID du processus actuel
echo $$ > "$PID_FILE"

echo "🔄 Démarrage du monitoring automatique du backend SAV"
echo "   Vérification toutes les 5 minutes"
echo "   PID: $$"
echo "   Pour arrêter: kill $$"
echo ""

# Fonction de nettoyage à la fermeture
cleanup() {
    echo ""
    echo "⏹️ Arrêt du monitoring automatique"
    rm -f "$PID_FILE"
    exit 0
}

# Intercepter les signaux pour nettoyer proprement
trap cleanup SIGINT SIGTERM

# Boucle infinie de monitoring
while true; do
    # Exécuter le script de vérification
    "$CHECK_SCRIPT"

    # Afficher le statut
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Vérification effectuée"

    # Attendre avant la prochaine vérification
    sleep "$INTERVAL"
done