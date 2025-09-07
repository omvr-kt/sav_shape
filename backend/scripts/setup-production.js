#!/usr/bin/env node

/**
 * Script de configuration automatique pour la production
 * Génère le fichier .env et crée un compte admin unique
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function generateSecureSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function generateEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  // Vérifier si .env existe déjà
  if (fs.existsSync(envPath)) {
    console.log('⚠️  Le fichier .env existe déjà. Sauvegarde en .env.backup');
    fs.copyFileSync(envPath, envPath + '.backup');
  }

  const envContent = `# Configuration Production - Shape SAV
# Généré automatiquement le ${new Date().toISOString()}

# Base de données
DATABASE_URL=./database/sav_shape.db
DATABASE_PATH=./database/sav_shape.db

# Sécurité JWT
JWT_SECRET=${generateSecureSecret()}
JWT_EXPIRES_IN=24h

# Serveur
NODE_ENV=production
PORT=3000

# Chiffrement
ENCRYPTION_KEY=${generateSecureSecret()}

# Configuration application
APP_NAME=Shape SAV
APP_VERSION=1.0.0

# SMTP (à configurer selon vos besoins)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-application
SMTP_FROM=noreply@shape-conseil.fr

# Limites
MAX_FILE_SIZE=10485760
MAX_UPLOADS_PER_TICKET=5
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Fichier .env créé avec succès');
}

async function createAdminAccount() {
  // Importer après la création du .env
  require('dotenv').config();
  const { db } = require('../src/utils/database');
  
  try {
    // Connecter à la base de données d'abord
    await db.connect();
    
    // Vérifier si un admin existe déjà
    const existingAdmin = await db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1');
    
    if (existingAdmin) {
      console.log('⚠️  Un compte administrateur existe déjà');
      return;
    }

    const adminEmail = 'admin@shape-conseil.fr';
    const adminPassword = 'Admin123!Shape';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const result = await db.run(`
      INSERT INTO users (
        email, password_hash, role, first_name, last_name, 
        company, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminEmail,
      hashedPassword,
      'admin',
      'Administrateur',
      'Shape',
      'Shape Conseil',
      1,
      new Date().toISOString()
    ]);

    console.log('✅ Compte administrateur créé :');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Mot de passe: ${adminPassword}`);
    console.log('   ⚠️  CHANGEZ CE MOT DE PASSE APRÈS LA PREMIÈRE CONNEXION !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du compte admin:', error.message);
    throw error;
  } finally {
    // Fermer la connexion à la base de données
    await db.close();
  }
}

async function main() {
  console.log('🚀 Configuration de Shape SAV pour la production...\n');
  
  try {
    // 1. Générer le .env
    console.log('📝 Génération du fichier .env...');
    generateEnvFile();
    
    // 2. Initialiser la base de données
    console.log('\n📊 Initialisation de la base de données...');
    
    // Import et utiliser le système de base de données moderne
    const { initDatabase } = require('../src/utils/database');
    await initDatabase();
    
    // 3. Créer le compte admin
    console.log('\n👤 Création du compte administrateur...');
    await createAdminAccount();
    
    console.log('\n🎉 Configuration terminée avec succès !');
    console.log('\n📋 Prochaines étapes :');
    console.log('   1. Vérifiez les paramètres SMTP dans le fichier .env');
    console.log('   2. Changez le mot de passe administrateur après la première connexion');
    console.log('   3. Démarrez le serveur avec: npm start');
    
  } catch (error) {
    console.error('\n❌ Erreur durant la configuration:', error.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = { generateEnvFile, createAdminAccount };