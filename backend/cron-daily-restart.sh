#!/bin/bash

################################################################################
# Script CRON - Redémarrage quotidien du backend SAV
# À configurer dans hPanel Hostinger pour s'exécuter toutes les 24h
#
# Commande cron recommandée (via hPanel):
# /bin/bash /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend/cron-daily-restart.sh
#
# Horaire recommandé: 4h du matin (faible trafic)
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
LOG_FILE="$BACKEND_DIR/logs/cron-daily.log"
HEALTH_URL="http://localhost:3000/api/health"

# Fonction de logging
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Créer le répertoire de logs si nécessaire
mkdir -p "$BACKEND_DIR/logs"

log_message "═══════════════════════════════════════════════════════════"
log_message "🔄 CRON QUOTIDIEN - Redémarrage du backend SAV"
log_message "═══════════════════════════════════════════════════════════"

# Se déplacer dans le répertoire backend
cd "$BACKEND_DIR" || {
    log_message "❌ ERREUR: Impossible d'accéder au répertoire $BACKEND_DIR"
    exit 1
}

# Vérifier si PM2 est disponible
if ! command -v pm2 &> /dev/null; then
    log_message "❌ ERREUR: PM2 n'est pas installé ou pas dans le PATH"
    log_message "   PATH actuel: $PATH"
    exit 1
fi

log_message "📊 État AVANT redémarrage:"
pm2 list 2>&1 | tee -a "$LOG_FILE"

# Arrêter toutes les applications PM2
log_message "⏸️  Arrêt de toutes les applications PM2..."
pm2 delete all 2>&1 | tee -a "$LOG_FILE"

# Attendre 2 secondes
sleep 2

# Redémarrer uniquement le backend (sans le watchdog qui cause des problèmes)
log_message "🚀 Redémarrage du backend..."
pm2 start "$BACKEND_DIR/src/server.js" \
    --name "sav-backend" \
    --cwd "$BACKEND_DIR" \
    --node-args="--max-old-space-size=450" \
    --max-memory-restart 500M \
    --time \
    --log-date-format "YYYY-MM-DD HH:mm:ss" \
    --output "$BACKEND_DIR/logs/pm2-out.log" \
    --error "$BACKEND_DIR/logs/pm2-error.log" \
    --merge-logs \
    2>&1 | tee -a "$LOG_FILE"

# Sauvegarder la configuration PM2
log_message "💾 Sauvegarde de la configuration PM2..."
pm2 save 2>&1 | tee -a "$LOG_FILE"

# Attendre que le serveur démarre
log_message "⏳ Attente du démarrage du serveur (10 secondes)..."
sleep 10

# Vérifier que le serveur répond
log_message "🔍 Vérification du health check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    log_message "✅ Backend démarré avec succès (HTTP $HTTP_CODE)"
else
    log_message "⚠️ Backend ne répond pas encore (HTTP $HTTP_CODE)"
    log_message "   Le serveur peut prendre quelques secondes supplémentaires"
fi

log_message "📊 État APRÈS redémarrage:"
pm2 list 2>&1 | tee -a "$LOG_FILE"

log_message "✅ Redémarrage quotidien terminé"
log_message "═══════════════════════════════════════════════════════════"
log_message ""

# Nettoyer les logs anciens (garder seulement les 30 derniers jours)
if [ -f "$LOG_FILE" ]; then
    LINES=$(wc -l < "$LOG_FILE")
    if [ "$LINES" -gt 10000 ]; then
        log_message "🧹 Nettoyage des logs (trop de lignes: $LINES)"
        tail -5000 "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
fi

exit 0
