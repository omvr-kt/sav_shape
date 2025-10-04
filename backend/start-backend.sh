#!/bin/bash

# Script de démarrage du backend SAV
echo "🚀 Démarrage du serveur backend SAV..."

# Se déplacer dans le répertoire backend
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé"
    exit 1
fi

# Arrêter l'instance existante si elle existe
pm2 delete sav-backend 2>/dev/null

# Démarrer le serveur avec PM2
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

echo "✅ Serveur backend démarré avec succès!"
echo ""
echo "📊 État actuel:"
pm2 status sav-backend
echo ""
echo "📝 Pour voir les logs: pm2 logs sav-backend"
echo "🔄 Pour redémarrer: ./restart-backend.sh"
echo "⏹️  Pour arrêter: ./stop-backend.sh"