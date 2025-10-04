#!/bin/bash

# Script de redémarrage du backend SAV
echo "🔄 Redémarrage du serveur backend SAV..."

# Se déplacer dans le répertoire backend
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé"
    exit 1
fi

# Redémarrer le serveur
pm2 restart sav-backend

# Si le processus n'existe pas, le démarrer
if [ $? -ne 0 ]; then
    echo "⚠️  Le processus n'existe pas, démarrage..."
    pm2 start ecosystem.config.js
fi

# Sauvegarder la configuration PM2
pm2 save

echo "✅ Serveur backend redémarré avec succès!"
echo ""
echo "📊 État actuel:"
pm2 status sav-backend
echo ""
echo "📝 Pour voir les logs: pm2 logs sav-backend"
echo "⏹️  Pour arrêter: ./stop-backend.sh"