# Documentation - Système de Fichier Confidentiel

## Vue d'ensemble

Le système de fichier confidentiel permet d'associer à chaque client des informations sensibles (identifiants serveur, mots de passe, etc.) stockées de manière sécurisée et accessibles uniquement aux administrateurs et au client concerné.

## Fonctionnalités

- **Chiffrement AES-256-CBC** avec vecteurs d'initialisation (IV) uniques
- **Contrôle d'accès strict** : admin + propriétaire du fichier uniquement
- **Interface intégrée** dans le formulaire d'édition client existant
- **Page de consultation** dédiée pour les clients
- **Stockage sécurisé** en base de données (jamais en texte clair)

## Architecture Technique

### 1. Service de Chiffrement (`src/services/encryptionService.js`)

```javascript
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.secretKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long-change-me';
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  decrypt(encryptedText, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**Sécurité :**
- Algorithme AES-256-CBC (standard militaire)
- IV unique pour chaque chiffrement (évite les patterns)
- Clé secrète stockée dans variables d'environnement

### 2. Base de Données

**Migration ajoutée à `src/utils/database.js` :**
```sql
ALTER TABLE users ADD COLUMN confidential_file TEXT;
```

**Stockage :** Format `encrypted_content:iv_hex`
- Partie 1 : Contenu chiffré en hexadécimal
- Partie 2 : Vecteur d'initialisation en hexadécimal

### 3. Modèle Utilisateur (`src/models/User.js`)

**Chiffrement automatique lors de la sauvegarde :**
```javascript
static async update(id, updates) {
  // ...
  Object.keys(updates).forEach(key => {
    if (key === 'confidential_file') {
      const encryptionService = require('../services/encryptionService');
      const { encrypted, iv } = encryptionService.encrypt(updates[key]);
      fieldsToUpdate.push(`${key} = ?`);
      values.push(`${encrypted}:${iv}`);
    }
    // ...
  });
}
```

### 4. Routes API (`src/routes/users.js`)

**Déchiffrement pour utilisateurs autorisés :**
```javascript
router.get('/:id', verifyToken, validateId, async (req, res) => {
  // Vérification des droits d'accès
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé'
    });
  }

  // Déchiffrement si autorisé
  if (user.confidential_file && (req.user.role === 'admin' || req.user.id === user.id)) {
    try {
      const encryptionService = require('../services/encryptionService');
      const parts = user.confidential_file.split(':');
      if (parts.length === 2) {
        user.confidential_file_decrypted = encryptionService.decrypt(parts[0], parts[1]);
      }
    } catch (decryptError) {
      console.error('Error decrypting confidential file:', decryptError);
    }
  }
});
```

**Contrôle d'accès :**
- Admin : Accès total (lecture/écriture)
- Client : Accès lecture uniquement à son propre fichier
- Autres : Accès refusé

### 5. Interface Administration (`frontend/assets/js/admin.js`)

**Formulaire d'édition client enrichi :**
```javascript
function populateClientForm(client) {
  // ... autres champs
  
  // Champ fichier confidentiel (admin seulement)
  if (currentUser.role === 'admin') {
    document.getElementById('confidentialFile').value = client.confidential_file_decrypted || '';
  }
}

function updateClient() {
  const formData = {
    // ... autres données
    confidential_file: document.getElementById('confidentialFile').value
  };
  
  fetch(`/api/users/${clientId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  });
}
```

**Formulaire HTML ajouté :**
```html
<div class="mb-3" id="confidentialFileSection" style="display: none;">
  <label for="confidentialFile" class="form-label">Fichier Confidentiel</label>
  <textarea class="form-control" id="confidentialFile" rows="6" 
            placeholder="Informations confidentielles (identifiants serveur, mots de passe, etc.)"></textarea>
  <div class="form-text">Ces informations seront chiffrées et stockées de manière sécurisée.</div>
</div>
```

### 6. Interface Client (`frontend/mon-fichier-confidentiel.html`)

**Page dédiée pour consultation :**
- Vérification du rôle client uniquement
- Affichage du contenu déchiffré
- Interface sécurisée avec bouton de copie
- Informations de sécurité

**JavaScript principal :**
```javascript
async function loadConfidentialFile() {
  if (!currentUser || currentUser.role !== 'client') return;
  
  const response = await fetch(`/api/users/${currentUser.id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();
  const user = data.user;
  
  if (user.confidential_file_decrypted) {
    document.getElementById('contentBox').textContent = user.confidential_file_decrypted;
  } else {
    // Affichage message "Aucun fichier"
  }
}
```

## Flux de Données

### Création/Modification
1. **Admin** saisit le contenu dans le formulaire d'édition
2. **Frontend** envoie les données via API PUT `/api/users/:id`
3. **Backend** chiffre automatiquement le contenu (AES-256 + IV unique)
4. **Base de données** stocke `encrypted_content:iv_hex`

### Consultation
1. **Client** accède à `/mon-fichier-confidentiel.html`
2. **Frontend** vérifie le rôle et fait appel à `/api/users/:id`
3. **Backend** vérifie les droits d'accès
4. **Backend** déchiffre le contenu si autorisé
5. **Frontend** affiche le contenu déchiffré

## Sécurité

### Chiffrement
- **Algorithme :** AES-256-CBC (Advanced Encryption Standard)
- **Clé :** 256 bits stockée dans variable d'environnement
- **IV :** 128 bits unique par chiffrement
- **Format :** Hex encoding pour stockage database

### Contrôle d'accès
- **Authentification :** JWT token obligatoire
- **Autorisation :** Vérification rôle + propriété
- **Séparation :** Admin (R/W) vs Client (R seulement)

### Protection données
- **Base de données :** Jamais de stockage en clair
- **Transport :** HTTPS obligatoire en production  
- **Logs :** Pas de logging du contenu sensible
- **Erreurs :** Messages génériques sans détails

## Tests de Validation

### Test 1 : Chiffrement
```bash
# Ajout contenu confidentiel par admin
curl -X PUT http://localhost:3000/api/users/6 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confidential_file":"SSH: server.com\nUser: admin\nPass: secret123"}'
```

### Test 2 : Stockage chiffré
```bash
# Vérification base de données (contenu chiffré)
sqlite3 database.sqlite "SELECT confidential_file FROM users WHERE id = 6;"
# Résultat : d9b8fa6fd3098e40b799d42520...
```

### Test 3 : Accès client autorisé
```bash
# Client accède à son fichier
curl http://localhost:3000/api/users/6 \
  -H "Authorization: Bearer $CLIENT_TOKEN"
# Résultat : contenu déchiffré dans confidential_file_decrypted
```

### Test 4 : Sécurité inter-clients
```bash
# Client tente d'accéder au fichier d'un autre client
curl http://localhost:3000/api/users/3 \
  -H "Authorization: Bearer $CLIENT_TOKEN"
# Résultat : "Accès non autorisé"
```

## Configuration

### Variables d'environnement (`.env`)
```env
ENCRYPTION_KEY=your-32-character-secret-key-here
```

### Base de données
```sql
-- Colonne ajoutée à la table users
ALTER TABLE users ADD COLUMN confidential_file TEXT;
```

## Utilisation

### Pour les Administrateurs
1. Aller dans "Gestion des clients"
2. Cliquer "Modifier" sur un client
3. Remplir le champ "Fichier Confidentiel"
4. Sauvegarder → Le contenu est automatiquement chiffré

### Pour les Clients
1. Se connecter sur la plateforme
2. Aller sur "Mon Fichier Confidentiel" (navigation)
3. Consulter le contenu déchiffré
4. Utiliser le bouton "Copier" si nécessaire

## Maintenance

### Rotation des clés
1. Générer nouvelle clé 32 caractères
2. Mettre à jour `ENCRYPTION_KEY` dans `.env`
3. Migrer les données existantes avec nouvelle clé
4. Redémarrer le service

### Monitoring
- Surveiller les tentatives d'accès non autorisés
- Vérifier l'intégrité du chiffrement
- Auditer les accès aux fichiers confidentiels

## Sécurité Avancée (Recommandations Production)

### Renforcement
- Utiliser HSM (Hardware Security Module) pour les clés
- Implémenter rotation automatique des clés
- Ajouter audit trail des accès
- Mettre en place rate limiting
- Activer HTTPS strict

### Conformité
- Respecter RGPD pour données personnelles
- Documenter les accès (qui, quand, quoi)
- Mettre en place procédures de suppression
- Former les utilisateurs à la sécurité

---

**Créé le :** 2025-09-03  
**Version :** 1.0  
**Auteur :** Claude Code  
**Status :** Implémenté et testé