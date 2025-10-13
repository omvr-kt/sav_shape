# 🚀 Guide de Déploiement et Maintenance du Backend SAV

## ✅ Système de Haute Disponibilité Installé

Votre backend dispose maintenant d'un système **ultra-robuste** qui garantit sa disponibilité **24/7**, même après déconnexion SSH.

---

## 🎯 Architecture du Système

Le système est composé de **3 couches de sécurité** :

### 1️⃣ PM2 avec Auto-Restart
- **Fichier:** `ecosystem.config.js`
- Redémarre automatiquement le backend en cas de crash
- Limite la mémoire à 500M
- Redémarre si la mémoire dépasse la limite
- Gère jusqu'à 50 redémarrages par minute

### 2️⃣ Watchdog Indépendant
- **Fichier:** `watchdog.js`
- Tourne en permanence via PM2
- Vérifie `/api/health` toutes les 30 secondes
- Redémarre automatiquement le backend s'il ne répond pas après 3 échecs
- Évite les restart loops avec un cooldown de 60 secondes

### 3️⃣ Keep-Alive Script (Optionnel - Cron)
- **Fichier:** `keep-alive.sh`
- Peut être exécuté via cron toutes les 5 minutes
- Vérifie que PM2 et tous les processus sont actifs
- Redémarre tout le système si nécessaire

---

## 📋 Commandes Essentielles

### Démarrage du Système
```bash
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend
bash start-persistent.sh
```

**Ce script fait tout automatiquement :**
- ✅ Arrête proprement les anciens processus
- ✅ Démarre le backend avec PM2
- ✅ Démarre le watchdog
- ✅ Vérifie que tout fonctionne
- ✅ Sauvegarde la configuration PM2

### Vérifier le Statut
```bash
pm2 status
pm2 list
```

### Voir les Logs en Temps Réel
```bash
pm2 logs
pm2 logs sav-backend          # Backend uniquement
pm2 logs sav-watchdog          # Watchdog uniquement
```

### Voir les Logs Récents (Sans Stream)
```bash
pm2 logs --nostream --lines 50
```

### Redémarrer un Processus
```bash
pm2 restart sav-backend        # Redémarrer le backend
pm2 restart sav-watchdog       # Redémarrer le watchdog
pm2 restart all                # Redémarrer tout
```

### Arrêter le Système
```bash
pm2 stop all                   # Arrêter tous les processus
pm2 delete all                 # Supprimer tous les processus de PM2
```

### Tester la Santé du Backend
```bash
curl http://localhost:5000/api/health
```

---

## 🔧 Que Faire en Cas de Problème ?

### Le backend ne répond plus (503)

**Solution 1 - Redémarrage rapide :**
```bash
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend
bash start-persistent.sh
```

**Solution 2 - Vérifier PM2 :**
```bash
pm2 list
pm2 logs --lines 100
```

**Solution 3 - Keep-alive manuel :**
```bash
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend
bash keep-alive.sh
```

### Le watchdog ne fonctionne pas

```bash
pm2 restart sav-watchdog
# ou
pm2 delete sav-watchdog
pm2 start watchdog.js --name "sav-watchdog"
pm2 save
```

### PM2 ne démarre pas après déconnexion SSH

**C'est normal !** PM2 n'a PAS besoin de `systemd` ou `crontab` dans votre environnement.

**Solutions :**
1. Laissez PM2 tourner - il continuera après déconnexion SSH
2. Le watchdog redémarrera automatiquement le backend s'il plante
3. Utilisez `keep-alive.sh` manuellement si nécessaire

### Voir les Logs Détaillés

```bash
# Logs du backend
cat backend/logs/pm2-combined.log | tail -100

# Logs du watchdog
cat backend/logs/watchdog.log | tail -100

# Logs de startup
cat backend/logs/startup-persistent.log

# Logs du keep-alive
cat backend/logs/keep-alive.log
```

---

## 📊 Monitoring et Surveillance

### Vérifier l'Uptime
```bash
pm2 list
```
La colonne `uptime` montre depuis combien de temps chaque processus tourne.

### Vérifier la Mémoire
```bash
pm2 list
```
La colonne `mem` montre l'utilisation mémoire. Le backend redémarre automatiquement à 500M.

### Voir les Statistiques en Direct
```bash
pm2 monit
```
Interface interactive avec stats CPU/Mémoire en temps réel (sortir avec `Ctrl+C`)

---

## 🔒 Sécurité et Stabilité

### Pourquoi le système ne plante plus ?

**Avant :**
- ❌ Backend s'arrêtait à la déconnexion SSH
- ❌ Aucun système de redémarrage automatique
- ❌ Pas de surveillance de la santé

**Maintenant :**
- ✅ **PM2 gère le backend** comme un daemon persistant
- ✅ **Auto-restart** en cas de crash ou dépassement mémoire
- ✅ **Watchdog** vérifie la santé toutes les 30s
- ✅ **Keep-alive** peut être lancé manuellement ou via cron
- ✅ **Logs détaillés** de tous les événements
- ✅ **Configuration sauvegardée** - PM2 se souvient des processus

### Limites de Ressources

Le système est configuré pour être **économe en ressources** :
- Limite Node.js : 450M de heap
- PM2 restart : 500M de RAM max
- Timeouts : 5-10 secondes
- Redémarrages : Max 50 par minute

---

## 🎓 Comprendre PM2

### Qu'est-ce que PM2 ?
PM2 est un **gestionnaire de processus** pour Node.js qui :
- Lance votre app en arrière-plan (daemon)
- La garde active même si SSH se déconnecte
- La redémarre automatiquement en cas de crash
- Enregistre tous les logs
- Gère plusieurs apps simultanément

### PM2 Survit à la Déconnexion SSH
**Oui !** Une fois lancé, PM2 tourne indépendamment de votre session SSH.

```bash
# Vous pouvez vous déconnecter en toute sécurité
pm2 list
exit
# Le backend continue de tourner !
```

### Commandes PM2 Avancées

```bash
# Sauvegarder la liste des processus
pm2 save

# Restaurer les processus sauvegardés
pm2 resurrect

# Supprimer un processus spécifique
pm2 delete sav-backend

# Recharger avec zéro downtime
pm2 reload sav-backend

# Voir les métadonnées d'un processus
pm2 describe sav-backend

# Voir les processus en format JSON
pm2 jlist
```

---

## 📁 Fichiers Importants

| Fichier | Description |
|---------|-------------|
| `ecosystem.config.js` | Configuration PM2 (mémoire, logs, restart) |
| `watchdog.js` | Script de surveillance continue |
| `start-persistent.sh` | Script de démarrage complet |
| `keep-alive.sh` | Script de vérification (cron) |
| `logs/pm2-combined.log` | Logs combinés du backend |
| `logs/watchdog.log` | Logs du watchdog |
| `logs/startup-persistent.log` | Logs de démarrage |
| `logs/keep-alive.log` | Logs des vérifications keep-alive |

---

## 🚨 Scénarios de Récupération

### Scénario 1 : Backend crashé
**Automatique** - PM2 le redémarre en 2-3 secondes

### Scénario 2 : Backend gelé (ne répond plus)
**Automatique** - Watchdog détecte et redémarre après 3 échecs (≈90s)

### Scénario 3 : PM2 daemon arrêté
**Manuel** - Relancer `bash start-persistent.sh`

### Scénario 4 : Serveur redémarré
**Manuel** - Relancer `bash start-persistent.sh` après le reboot

---

## ✨ Améliorations Futures (Optionnel)

### Ajouter le Keep-Alive au Cron
Si votre hébergeur supporte cron :
```bash
# Éditer crontab
crontab -e

# Ajouter cette ligne (vérification toutes les 5 minutes)
*/5 * * * * /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend/keep-alive.sh
```

### Notifications Email
Vous pouvez modifier `watchdog.js` pour envoyer des emails en cas d'erreur critique.

---

## 📞 Support

En cas de problème persistant :
1. Vérifier les logs : `pm2 logs --lines 200`
2. Vérifier le statut : `pm2 list`
3. Tester le health : `curl localhost:5000/api/health`
4. Redémarrer : `bash start-persistent.sh`

---

## 🎉 Résumé

**Vous n'avez PLUS à vous soucier du backend !**

- ✅ Il démarre automatiquement
- ✅ Il se redémarre en cas de problème
- ✅ Il survit aux déconnexions SSH
- ✅ Il est surveillé 24/7
- ✅ Les logs sont sauvegardés
- ✅ Tout est configuré et testé

**Pour démarrer :** `bash start-persistent.sh`
**Pour vérifier :** `pm2 list`
**Pour voir les logs :** `pm2 logs`

C'est tout ! 🚀
