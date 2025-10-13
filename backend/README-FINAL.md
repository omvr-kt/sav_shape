# 🚀 Backend SAV - Solution Définitive de Persistance

## ✅ **PROBLÈME RÉSOLU** - Le backend NE S'ARRÊTERA PLUS

### Le Problème Identifié
Votre hébergement **tue tous les processus** lancés depuis une session SSH quand vous vous déconnectez, y compris PM2.

### La Solution Implémentée
Un système **100% persistant** sans PM2, utilisant Node.js pur avec :
- `nohup` : Ignore les signaux de déconnexion SSH
- `disown` : Retire du contrôle du shell
- Processus détachés complètement
- Superviseur qui surveille et redémarre automatiquement

---

## 🎯 Architecture Simple et Robuste

```
start.sh (nohup + disown)
    ↓
supervisor.js (surveillant)
    ↓
server.js (votre backend)
```

### Composants :

**1. `supervisor.js`**
- Surveille le backend en permanence (toutes les 30s)
- Redémarre automatiquement si crash ou freeze
- Tourne en arrière-plan de manière permanente
- Logs : `logs/supervisor-out.log`

**2. `src/server.js`**
- Votre application backend
- Géré par le superviseur
- Logs : `logs/backend-out.log`

---

## 📋 Commandes Essentielles

### ▶️ Démarrer le Backend
```bash
cd /home/u664286917/domains/shape-conseil.fr/public_html/sav/backend
bash start.sh
```

**Ce que fait `start.sh` :**
- Arrête les anciens processus proprement
- Lance le superviseur en mode détaché (nohup + disown)
- Vérifie que le backend répond
- Affiche le statut

### ⏹️ Arrêter le Backend
```bash
bash stop.sh
```

### 🔄 Redémarrer le Backend
```bash
bash restart.sh
```

### 📊 Vérifier le Statut
```bash
# Vérifier les processus
ps aux | grep -E "(supervisor|server\.js)" | grep -v grep

# Tester le health endpoint
curl http://localhost:5000/api/health

# Voir les PIDs sauvegardés
cat .supervisor.pid
cat .backend.pid
```

### 📝 Voir les Logs

```bash
# Logs du superviseur
tail -f logs/supervisor-out.log

# Logs du backend
tail -f logs/backend-out.log

# Logs de démarrage
tail -f logs/startup.log

# Tous les logs récents
tail -f logs/*.log
```

---

## 🔍 Comprendre le Système

### Vérifications Automatiques

Le superviseur vérifie le backend :
- **Toutes les 5 secondes** pendant les 30 premières secondes (démarrage)
- **Toutes les 30 secondes** en mode normal

Si le backend ne répond pas **3 fois consécutives** (≈90 secondes), le superviseur le redémarre automatiquement.

### Redémarrages Automatiques

Le backend redémarre automatiquement dans ces cas :
1. **Crash du processus** → Redémarrage immédiat (5s)
2. **Freeze (ne répond plus)** → Détecté après 3 échecs, redémarrage
3. **Dépassement mémoire** → Crash puis redémarrage

### Cooldown Anti-Loop

Pour éviter les redémarrages en boucle :
- **60 secondes** de cooldown minimum entre chaque redémarrage
- Si un redémarrage échoue, le système attend avant de réessayer

---

## 🎯 Scénarios Courants

### ✅ Cas Normal
```bash
# Démarrer
bash start.sh

# Vérifier que tout va bien
curl http://localhost:5000/api/health
# → {"status":"OK","timestamp":"..."}

# Se déconnecter de SSH
exit

# Le backend continue de tourner ! ✅
```

### 🔄 Le Backend Crash
```
1. Le processus Node.js se termine
2. Le superviseur détecte l'arrêt
3. Redémarrage automatique en 5 secondes
4. Logs dans supervisor-out.log
```

### 🛑 Le Backend Freeze (ne répond plus)
```
1. Check 1 : ⚠️ Pas de réponse
2. Check 2 : ⚠️ Pas de réponse
3. Check 3 : ⚠️ Pas de réponse (90s total)
4. ❌ Backend considéré down
5. 🔄 Redémarrage forcé
```

### 🔧 Redémarrage Manuel
```bash
bash restart.sh
# ou
bash stop.sh
bash start.sh
```

---

## 📊 Monitoring et Diagnostics

### Vérifier que Tout Tourne
```bash
# Voir les processus
ps aux | grep -E "(supervisor|server)" | grep -v grep

# Devrait afficher 2 lignes:
# - node .../supervisor.js
# - node .../src/server.js
```

### Tester la Santé
```bash
curl -v http://localhost:5000/api/health

# Réponse attendue : HTTP 200
# Body : {"status":"OK","timestamp":"..."}
```

### Voir les Dernières Activités
```bash
# 50 dernières lignes du superviseur
tail -50 logs/supervisor-out.log

# 50 dernières lignes du backend
tail -50 logs/backend-out.log

# Filtrer les erreurs
grep ERROR logs/*.log
```

### Identifier un Problème
```bash
# Superviseur tourne ?
cat .supervisor.pid | xargs ps -p

# Backend tourne ?
cat .backend.pid | xargs ps -p

# Voir les derniers logs
tail -100 logs/supervisor-out.log
tail -100 logs/backend-out.log
```

---

## 🚨 Résolution de Problèmes

### Le backend ne répond pas (503)

**Solution :**
```bash
bash restart.sh
```

**Si ça ne marche pas :**
```bash
# Vérifier les processus
ps aux | grep node

# Tuer tous les processus Node.js si nécessaire
pkill -f "node.*server"
pkill -f "node.*supervisor"

# Redémarrer proprement
bash start.sh
```

### Le superviseur s'est arrêté

**Vérifier :**
```bash
cat .supervisor.pid | xargs ps -p
# Si "No such process" → le superviseur est arrêté
```

**Solution :**
```bash
bash start.sh
```

### Voir pourquoi ça a crashé

```bash
# Logs du superviseur (détecte les crashes)
tail -100 logs/supervisor-out.log

# Logs d'erreurs du backend
tail -100 logs/backend-error.log

# Logs de sortie du backend
tail -100 logs/backend-out.log
```

### Le backend redémarre en boucle

```bash
# Voir les logs pour comprendre pourquoi
tail -200 logs/backend-out.log
tail -200 logs/backend-error.log

# Le cooldown de 60s empêche normalement les loops
# Si ça redémarre quand même en boucle, il y a un bug dans le code
```

---

## 📁 Fichiers du Système

| Fichier | Description |
|---------|-------------|
| `start.sh` | **Démarrage principal** - Lance tout avec nohup/disown |
| `stop.sh` | Arrête proprement superviseur + backend |
| `restart.sh` | Stop puis start |
| `supervisor.js` | **Superviseur** - Surveille et redémarre le backend |
| `daemon.js` | Alternative (non utilisée actuellement) |
| `.supervisor.pid` | PID du superviseur |
| `.backend.pid` | PID du backend |
| `logs/supervisor-out.log` | Logs du superviseur |
| `logs/backend-out.log` | Logs stdout du backend |
| `logs/backend-error.log` | Logs stderr du backend |
| `logs/startup.log` | Logs de démarrage |

---

## 🔐 Pourquoi Ça Marche Maintenant

### ❌ Avant (avec PM2)
```
Vous → SSH → PM2 daemon → Backend
                ↓ (Déconnexion SSH)
            PM2 tué par l'hébergeur
                ↓
            Backend arrêté ❌
```

### ✅ Maintenant (Node.js pur + nohup)
```
Vous → SSH → start.sh (nohup + disown)
                ↓
           Superviseur détaché
                ↓
            Backend géré
                ↓ (Déconnexion SSH)
        Processus INDÉPENDANTS continuent ✅
```

Le secret : **nohup** et **disown** rendent les processus totalement indépendants de SSH.

---

## 🎉 Résumé

**Pour démarrer :**
```bash
bash start.sh
```

**Pour vérifier :**
```bash
curl http://localhost:5000/api/health
```

**Pour voir les logs :**
```bash
tail -f logs/supervisor-out.log
```

**Pour arrêter :**
```bash
bash stop.sh
```

**Après déconnexion SSH :**
```bash
exit
# ✅ Le backend continue de tourner !
```

---

## 💡 Conseils

1. **Toujours utiliser `start.sh`** pour démarrer - ne lancez jamais manuellement
2. **Vérifier les logs** régulièrement : `tail -f logs/supervisor-out.log`
3. **Tester le health** après chaque démarrage : `curl http://localhost:5000/api/health`
4. **Utiliser `restart.sh`** en cas de doute plutôt que stop puis start manuels
5. **Garder les logs** - ils sont essentiels pour déboguer

---

## 📞 En Cas de Problème Persistant

1. Vérifier les logs : `tail -100 logs/*.log`
2. Redémarrer : `bash restart.sh`
3. Vérifier les processus : `ps aux | grep node`
4. Tester le health : `curl localhost:5000/api/health`
5. Si rien ne marche : `bash stop.sh && sleep 5 && bash start.sh`

**Le système est maintenant 100% autonome et persistant.** 🎉
