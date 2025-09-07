# Configuration de Production - Shape SAV

Guide de déploiement pour la production.

## 🚀 Installation Rapide

```bash
# 1. Cloner le repository
git clone <repository-url>
cd sav_shape

# 2. Installer les dépendances
cd backend
npm install

# 3. Configuration automatique pour la production
npm run setup-prod
```

## ⚙️ Ce que fait `npm run setup-prod`

1. **Génère automatiquement le fichier `.env`** avec :
   - Clés JWT sécurisées générées aléatoirement
   - Clés de chiffrement sécurisées
   - Configuration de base pour la production

2. **Initialise la base de données SQLite**
   - Crée toutes les tables nécessaires
   - Configure les paramètres par défaut

3. **Crée un compte administrateur unique** :
   - Email: `admin@shape-conseil.fr`
   - Mot de passe temporaire (affiché dans la console)

## 📧 Configuration Email (SMTP)

Après l'installation, modifiez le fichier `.env` généré avec vos paramètres SMTP :

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application
SMTP_FROM=noreply@shape-conseil.fr
```

## 🔐 Sécurité Post-Installation

1. **Changez immédiatement le mot de passe administrateur**
2. Vérifiez les permissions du fichier `.env`
3. Configurez HTTPS en production
4. Configurez un proxy reverse (nginx/apache)

## 🚦 Démarrage

```bash
# Mode production
npm start

# Vérifier que le serveur fonctionne
curl http://localhost:3000/health
```

## 📁 Structure des Fichiers

```
sav_shape/
├── backend/
│   ├── database/              # Base de données SQLite
│   ├── scripts/
│   │   ├── setup-production.js  # Script de config prod
│   │   └── populate-test-data.js # Données test (dev uniquement)
│   └── .env                   # Configuration (généré automatiquement)
├── frontend/                  # Interface utilisateur
└── PRODUCTION-SETUP.md        # Ce fichier
```

## 🛠️ Fonctionnalités

### ✅ Système de Gestion
- **Clients** : Gestion complète des clients
- **Projets** : Suivi de projets par client
- **Tickets** : Système de support avec SLA
- **Factures** : Facturation avec échéances à 7 jours
- **Automatisation** : Vérification automatique des factures en retard

### ✅ Interface Utilisateur
- **Admin** : Interface complète de gestion
- **Client** : Espace client sécurisé
- **Responsive** : Compatible mobile et desktop
- **PDF** : Génération de factures PDF

### ✅ Sécurité
- Authentification JWT
- Hachage des mots de passe
- Chiffrement des données sensibles
- Protection CORS et Helmet

## 🐛 Support

En cas de problème lors de l'installation :

1. Vérifiez les logs de la console
2. Assurez-vous que Node.js >= 16 est installé
3. Vérifiez les permissions d'écriture dans le dossier
4. Consultez les logs du serveur avec `npm start`

## 📝 Notes de Version

- **Échéances factures** : 7 jours (modifiable dans le code)
- **Scheduler automatique** : Vérification des factures en retard toutes les heures
- **Base de données** : SQLite (prête pour PostgreSQL/MySQL si besoin)
- **Email** : Configuration SMTP requise pour les notifications