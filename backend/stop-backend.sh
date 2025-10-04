#!/bin/bash

# Script d'arrêt du backend SAV
echo "⏹️  Arrêt du serveur backend SAV..."

# Se déplacer dans le répertoire backend
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé"
    exit 1
fi

# Arrêter le serveur
pm2 stop sav-backend

# Supprimer de PM2
pm2 delete sav-backend

# Sauvegarder la configuration PM2
pm2 save

echo "✅ Serveur backend arrêté avec succès!"
echo ""
echo "📊 État actuel:"
pm2 list
echo ""
echo "🚀 Pour redémarrer: ./start-backend.sh"