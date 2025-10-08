#!/bin/bash

# Script de démarrage pour Shape SAV Backend
# Usage: ./start-backend.sh

echo "🚀 Démarrage du backend Shape SAV..."

# Aller dans le dossier backend
cd backend

# Vérifier si Node.js est disponible
if ! command -v node &> /dev/null; then
    echo "❌ Erreur: Node.js n'est pas installé"
    exit 1
fi

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Vérifier si la configuration existe
if [ ! -f ".env" ]; then
    echo "⚙️ Configuration initiale..."
    npm run setup-prod
fi

# Vérifier si le serveur est déjà en cours d'exécution
if pgrep -f "node src/server.js" > /dev/null; then
    echo "⚠️  Le serveur est déjà en cours d'exécution"
    echo "PID: $(pgrep -f 'node src/server.js')"
    exit 1
fi

# Démarrer le serveur
echo "🌟 Lancement du serveur sur le port 3000..."
echo "📊 Logs disponibles dans server.log"

# Assurer les migrations/structures DB à jour (idempotent)
echo "🗂  Vérification/ajout des tables Kanban (idempotent)..."
node migrations/add_kanban_tables.js >/dev/null 2>&1 || true

# Démarrer en arrière-plan avec nohup pour persister après déconnexion SSH
nohup npm start > server.log 2>&1 &
SERVER_PID=$!

# Détacher le processus de la session SSH
disown $SERVER_PID

echo "✅ Serveur démarré avec succès (PID: $SERVER_PID)"
echo "🔗 Application accessible via: http://localhost:3000"
echo "🔒 Le serveur restera actif même après déconnexion SSH"
echo "📋 Pour arrêter le serveur: kill $SERVER_PID"

# Sauvegarder le PID pour pouvoir arrêter le serveur plus tard
echo $SERVER_PID > .server_pid

echo ""
echo "📝 Commandes utiles:"
echo "   Voir les logs: tail -f backend/server.log"
echo "   Arrêter: kill \$(cat backend/.server_pid)"
echo "   Status: ps aux | grep 'node src/server.js'"
echo "   Redémarrer: kill \$(cat backend/.server_pid) && ./start-backend.sh"
