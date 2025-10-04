#!/bin/bash

# Script de vérification et redémarrage automatique du backend SAV
# Ce script vérifie que le serveur backend est actif et le redémarre si nécessaire

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
LOG_FILE="$BACKEND_DIR/logs/monitor.log"
HEALTH_URL="http://localhost:5000/api/health"
MAX_RETRIES=3
RETRY_DELAY=5

# Fonction de logging
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Créer le fichier de log s'il n'existe pas
mkdir -p "$BACKEND_DIR/logs"
touch "$LOG_FILE"

# Fonction de vérification du serveur
check_server() {
    curl -f -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null
}

# Fonction de redémarrage du serveur
restart_server() {
    log_message "Tentative de redémarrage du serveur..."
    cd "$BACKEND_DIR"

    # Arrêter l'instance existante si elle existe
    pm2 delete sav-backend 2>/dev/null

    # Démarrer le serveur avec PM2
    pm2 start ecosystem.config.js

    # Sauvegarder la configuration PM2
    pm2 save

    # Attendre que le serveur démarre
    sleep 5

    # Vérifier si le serveur a démarré correctement
    if [ "$(check_server)" == "200" ]; then
        log_message "✅ Serveur redémarré avec succès"
        return 0
    else
        log_message "❌ Échec du redémarrage du serveur"
        return 1
    fi
}

# Vérification principale
log_message "Vérification du statut du serveur backend..."

# Vérifier si le serveur répond
http_code=$(check_server)

if [ "$http_code" == "200" ]; then
    log_message "✅ Serveur actif et répond correctement (HTTP $http_code)"

    # Vérifier également que PM2 gère bien le processus
    if pm2 list | grep -q "sav-backend.*online"; then
        log_message "✅ PM2 gère correctement le processus"
    else
        log_message "⚠️ PM2 ne gère pas le processus, redémarrage..."
        restart_server
    fi
else
    log_message "⚠️ Serveur ne répond pas ou erreur (HTTP $http_code)"

    # Tentatives de redémarrage
    for i in $(seq 1 $MAX_RETRIES); do
        log_message "Tentative de redémarrage $i/$MAX_RETRIES..."

        if restart_server; then
            log_message "✅ Serveur redémarré avec succès après $i tentative(s)"

            # Envoyer une notification (optionnel - à configurer selon vos besoins)
            # echo "Le serveur SAV a été redémarré automatiquement" | mail -s "SAV Backend Redémarré" admin@shape-conseil.fr

            exit 0
        fi

        if [ $i -lt $MAX_RETRIES ]; then
            log_message "Attente de $RETRY_DELAY secondes avant la prochaine tentative..."
            sleep $RETRY_DELAY
        fi
    done

    # Si toutes les tentatives ont échoué
    log_message "❌ ERREUR CRITIQUE: Impossible de redémarrer le serveur après $MAX_RETRIES tentatives"

    # Envoyer une alerte critique (optionnel - à configurer selon vos besoins)
    # echo "ALERTE: Le serveur SAV ne peut pas être redémarré automatiquement" | mail -s "ALERTE CRITIQUE SAV Backend" admin@shape-conseil.fr

    exit 1
fi

# Nettoyer les logs anciens (garder seulement les 7 derniers jours)
if [ -f "$LOG_FILE" ]; then
    # Créer un fichier temporaire avec les lignes des 7 derniers jours
    seven_days_ago=$(date -d "7 days ago" '+%Y-%m-%d')
    grep -E "^\[$(date '+%Y-%m-%d')" "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null || true
    for i in {1..6}; do
        day=$(date -d "$i days ago" '+%Y-%m-%d')
        grep -E "^\[$day" "$LOG_FILE" >> "$LOG_FILE.tmp" 2>/dev/null || true
    done

    # Remplacer le fichier de log si le nouveau est valide
    if [ -s "$LOG_FILE.tmp" ]; then
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    else
        rm -f "$LOG_FILE.tmp"
    fi
fi

exit 0