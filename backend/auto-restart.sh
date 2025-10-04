#!/bin/bash

# Script de démarrage automatique - à ajouter au crontab
# Vérifie si PM2 tourne et démarre les processus si nécessaire

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"
cd "$BACKEND_DIR"

# Vérifier si PM2 est en cours d'exécution
pm2 ping &>/dev/null

if [ $? -ne 0 ]; then
    echo "$(date): PM2 daemon not running, starting..." >> "$BACKEND_DIR/logs/auto-restart.log"
    pm2 resurrect &>/dev/null
fi

# Vérifier si sav-backend tourne
if ! pm2 list | grep -q "sav-backend.*online"; then
    echo "$(date): sav-backend not running, starting..." >> "$BACKEND_DIR/logs/auto-restart.log"
    pm2 start "$BACKEND_DIR/ecosystem.config.js" &>/dev/null
fi

# Vérifier si watchdog tourne
if ! pm2 list | grep -q "watchdog.*online"; then
    echo "$(date): watchdog not running, starting..." >> "$BACKEND_DIR/logs/auto-restart.log"
    pm2 start "$BACKEND_DIR/watchdog.js" --name watchdog &>/dev/null
fi

# Sauvegarder l'état
pm2 save &>/dev/null

echo "$(date): Auto-restart check completed" >> "$BACKEND_DIR/logs/auto-restart.log"
