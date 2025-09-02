# Cahier des charges – Plateforme de gestion des retours client et de suivi projet

## 1. Objectif

Notre agence est spécialisée dans le **développement d’applications web sur mesure** et dans **l’automatisation de processus sur des sites existants** pour des clients professionnels.

Dans ce cadre, nous souhaitons mettre en place une plateforme dédiée à la **gestion des retours clients et au suivi de projet**. Elle permettra à chaque client de :
- faire des retours clairs sur les livrables et les fonctionnalités mises en place,
- suivre l’évolution du traitement de ses demandes,
- échanger efficacement avec notre équipe projet via un système de tickets.

Cette plateforme vise à renforcer notre réactivité, améliorer la traçabilité des échanges et assurer un meilleur pilotage des livrables.

## 2. Utilisateurs

### 2.1 Rôles

- **Administrateur (agence)** :
  - Crée les comptes clients
  - Gère les équipes internes
  - Supervise l’utilisation de la plateforme

- **Client** :
  - Dispose d’un compte personnel (créé par un admin)
  - Peut ouvrir un ticket lié à un projet ou une fonctionnalité spécifique
  - Suit l’évolution des échanges
  - Reçoit une notification par mail à chaque mise à jour

- **Équipe projet (interne)** :
  - Gère les tickets clients
  - Peut répondre, commenter, faire évoluer les statuts
  - Classe les tickets par projet, type de demande, SLA, etc.

## 3. Fonctionnalités principales

### 3.1 Gestion des comptes utilisateurs

- Création des comptes clients uniquement par un administrateur
- Authentification sécurisée (login / mot de passe)
- Gestion des accès et projets associés

### 3.2 Système de tickets collaboratifs

- Création de tickets par le client (objet, description, fichiers joints)
- Liaison obligatoire avec un projet existant (application web, automatisation, site, etc.)
- Suivi des échanges sous forme de fil de discussion
- Possibilité d’ajouter des commentaires et pièces jointes (PDF, captures, vidéos…)

### 3.3 Statuts de ticket

- Ouvert
- En cours
- En attente client
- Résolu
- Fermé

### 3.4 Notifications automatiques

- Envoi d’un email automatique au client à chaque mise à jour du ticket
- Alerte interne pour les équipes à chaque nouveau message client

### 3.5 Suivi SLA (Service Level Agreement)

- Déclenchement automatique d’un **compte à rebours SLA** à l’ouverture d’un ticket
- SLA paramétrables selon la typologie du soucis que le client fixe (urgences, maintenance, évolutions)
- Alertes visuelles en cas de dépassement de délai
- Vue synthétique des tickets urgents ou critiques

## 4. Interface utilisateur

### 4.1 Espace client

- Tableau de bord avec :
  - Liste des projets actifs
  - Liste des tickets par projet
- Formulaire pour créer un retour (ticket)
- Accès au fil de discussion complet
- Historique des réponses, dates et pièces jointes

### 4.2 Espace interne (agence)

- Vue multi-projets
- Filtres : par client, projet, SLA, statut, date
- Accès rapide aux tickets en retard ou non lus
- Interface de réponse fluide (texte + fichiers)
- Commentaires internes non visibles par le client

## 5. Sécurité & confidentialité

- Accès sécurisé via HTTPS
- Données chiffrées
- Séparation stricte des espaces clients (un client ne peut voir que ses projets)
- Journalisation des actions et historique complet

## 6. Contraintes techniques

- Application web responsive (desktop + mobile)
- Interface fluide, UX pensée pour des profils non techniques
- Système d’e-mails transactionnels fiable et gratuit
- Sauvegardes automatiques régulières
- Base de données sécurisée
- Tout en locahlost, meme la db

## 8. Livraison attendue

- Prototype fonctionnel (MVP)
- Tests en situation réelle avec nos clients pilotes
- Déploiement en production
- Documentation claire pour :
  - les utilisateurs clients
  - les équipes internes
  - les administrateurs

