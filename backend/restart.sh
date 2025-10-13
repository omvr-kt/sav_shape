#!/bin/bash

################################################################################
# SCRIPT DE REDÉMARRAGE RAPIDE
################################################################################

BACKEND_DIR="/home/u664286917/domains/shape-conseil.fr/public_html/sav/backend"

echo "🔄 Redémarrage du backend SAV..."

bash "$BACKEND_DIR/stop.sh"
sleep 2
bash "$BACKEND_DIR/start.sh"
