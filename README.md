# Plateforme de Gestion des Retours Clients

Une plateforme complète de gestion de tickets et de suivi de projet développée avec Node.js, SQLite et JavaScript vanilla.

## Fonctionnalités

- **Interface Agence** : Gestion complète des clients, projets et tickets
- **Interface Client** : Suivi des projets et création de tickets
- **Système de Tickets** : Création, suivi et gestion avec upload de fichiers
- **Notifications Automatiques** : Emails transactionnels pour tous les événements
- **Gestion SLA** : Surveillance et alertes automatiques des délais
- **Authentification JWT** : Sécurité avec gestion des rôles
- **Upload de Fichiers** : Support des images, PDF, vidéos et documents

## Installation et Démarrage

### Prérequis
- Node.js (version 14 ou supérieure)
- npm

### Installation

1. **Installation des dépendances**
   ```bash
   cd backend
   npm install
   ```

2. **Configuration des variables d'environnement**
   ```bash
   cp .env.example .env
   ```
   
   Editez le fichier `.env` avec vos paramètres SMTP :
   ```
   JWT_SECRET=votre_clé_secrète_jwt
   SMTP_HOST=smtp.gmail.com
   SMTP_USER=votre_email@gmail.com
   SMTP_PASS=votre_mot_de_passe_app
   ```

3. **Démarrage du serveur**
   ```bash
   npm start
   ```

4. **Accès à l'application**
   - Interface d'accueil : http://localhost:3000
   - Espace Client : http://localhost:3000/client
   - Espace Agence : http://localhost:3000/admin

## Comptes par Défaut

### Administrateur
- **Email** : admin@agency.local
- **Mot de passe** : admin123

## Structure du Projet

```
sav_shape/
├── backend/
│   ├── src/
│   │   ├── models/          # Modèles de données (User, Ticket, etc.)
│   │   ├── routes/          # Routes API REST
│   │   ├── middleware/      # Middleware (auth, validation, upload)
│   │   ├── services/        # Services (email, SLA)
│   │   ├── utils/           # Utilitaires (database)
│   │   └── server.js        # Serveur principal
│   ├── uploads/             # Fichiers uploadés
│   ├── database.sqlite      # Base de données SQLite
│   └── package.json
├── frontend/
│   ├── admin/               # Interface agence
│   ├── client/              # Interface client
│   ├── assets/              # CSS/JS partagés
│   └── connexion.html       # Page de connexion unifiée
├── scripts/
│   ├── create_admin.js      # Script création admin
│   └── create_test_clients.js # Script création clients test
└── cahier_des_charges.md    # Spécifications complètes
```

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur
- `POST /api/auth/change-password` - Changer mot de passe

### Utilisateurs
- `GET /api/users` - Liste des utilisateurs (admin)
- `POST /api/users` - Créer un utilisateur (admin)
- `PUT /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur (admin)

### Projets
- `GET /api/projects` - Liste des projets
- `POST /api/projects` - Créer un projet
- `PUT /api/projects/:id` - Modifier un projet
- `GET /api/projects/:id/stats` - Statistiques du projet

### Tickets
- `GET /api/tickets` - Liste des tickets
- `POST /api/tickets` - Créer un ticket
- `PUT /api/tickets/:id` - Modifier un ticket
- `GET /api/tickets/stats` - Statistiques globales
- `GET /api/tickets/overdue` - Tickets en retard

### Commentaires
- `GET /api/comments/ticket/:id` - Commentaires d'un ticket
- `POST /api/comments/ticket/:id` - Ajouter un commentaire

### Pièces Jointes
- `GET /api/attachments/ticket/:id` - Liste des pièces jointes
- `POST /api/attachments/ticket/:id` - Upload de fichiers
- `GET /api/attachments/download/:id` - Télécharger un fichier

### SLA
- `GET /api/sla` - Règles SLA
- `POST /api/sla` - Créer une règle SLA
- `PUT /api/sla/:id` - Modifier une règle SLA

## Guide d'Utilisation

### Pour l'Agence

1. **Connexion**
   - Accédez à http://localhost:3000/admin
   - Connectez-vous avec admin@agency.local / admin123

2. **Gestion des Clients**
   - Créer de nouveaux comptes clients
   - Configurer les règles SLA personnalisées
   - Voir les statistiques par client

3. **Gestion des Projets**
   - Créer des projets pour chaque client
   - Associer les tickets aux projets
   - Suivre l'avancement

4. **Traitement des Tickets**
   - Voir tous les tickets par priorité/statut
   - Assigner les tickets aux équipes
   - Répondre avec commentaires internes/publics
   - Gérer les statuts et priorités

### Pour les Clients

1. **Connexion**
   - Accédez à http://localhost:3000/client
   - Utilisez les identifiants fournis par l'agence

2. **Suivi des Projets**
   - Vue d'ensemble de tous vos projets
   - Statistiques des tickets par projet

3. **Gestion des Tickets**
   - Créer de nouveaux tickets de support
   - Joindre des fichiers (images, PDF, etc.)
   - Suivre l'évolution des demandes
   - Recevoir des notifications par email

4. **Communication**
   - Échanger avec l'équipe via les commentaires
   - Recevoir des mises à jour automatiques
   - Voir l'historique complet

## Configuration Email

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre_email@gmail.com
SMTP_PASS=mot_de_passe_application
```

### Autres Fournisseurs
- **Outlook** : smtp-mail.outlook.com:587
- **SendGrid** : smtp.sendgrid.net:587
- **Mailgun** : smtp.mailgun.org:587

## Système SLA

Le système surveille automatiquement les délais de traitement :

- **Vérifications toutes les 15 minutes**
- **Alertes 2h avant l'échéance**
- **Notifications client et équipe**
- **Tableau de bord des retards**

### Configuration SLA par Priorité

- **Urgent** : 2h de réponse / 8h de résolution
- **Élevée** : 8h de réponse / 24h de résolution  
- **Normale** : 24h de réponse / 72h de résolution
- **Faible** : 72h de réponse / 168h de résolution

## Sécurité

- **Authentification JWT** avec expiration
- **Validation des entrées** sur tous les endpoints
- **Protection contre le rate limiting**
- **Séparation des espaces clients**
- **Upload sécurisé** avec validation des types de fichiers
- **Chiffrement des mots de passe** avec bcrypt

## Personnalisation

### Styles
- Modifiez `/frontend/assets/css/main.css` pour les styles généraux
- `/frontend/assets/css/admin.css` pour l'interface agence
- `/frontend/assets/css/client.css` pour l'interface client

### Templates Email
- Modifiez `/backend/src/services/email.js`
- Templates HTML responsive inclus

## Dépannage

### Base de Données
```bash
# Réinitialiser la base de données
rm backend/database.sqlite
npm start
```

### Logs
```bash
# Voir les logs en temps réel
npm start | tail -f
```

### Permissions Fichiers
```bash
# Vérifier les permissions du dossier uploads
chmod 755 backend/uploads
```

## Monitoring

- **Health Check** : GET /api/health
- **Logs SLA** : Affichés dans la console
- **Statistiques** : Disponibles via l'interface admin

## Déploiement

Pour un déploiement en production :

1. **Variables d'environnement**
   ```env
   NODE_ENV=production
   JWT_SECRET=clé_très_sécurisée
   ```

2. **Base de données**
   - Sauvegardez `database.sqlite` régulièrement
   - Considérez PostgreSQL pour la production

3. **Reverse Proxy**
   - Utilisez Nginx pour servir les fichiers statiques
   - Configuration SSL/TLS

4. **Process Manager**
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name sav-platform
   ```

## Support

Pour toute question ou problème :
- Consultez les logs de l'application
- Vérifiez la configuration des variables d'environnement
- Assurez-vous que les ports sont disponibles

---

**Version** : 1.0.0  
**Développé avec** : Node.js, SQLite, JavaScript ES6+  
**Licence** : ISC