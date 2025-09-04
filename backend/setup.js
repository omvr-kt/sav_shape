#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function setup() {
  console.log('Configuration initiale du projet sav Platform\n');

  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  // Vérifier si .env existe déjà
  if (fs.existsSync(envPath)) {
    const overwrite = await question('Le fichier .env existe déjà. Le remplacer ? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Configuration annulée.');
      rl.close();
      return;
    }
  }

  console.log('Génération du fichier .env...\n');

  // Générer JWT secret sécurisé
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  
  // Demander les informations critiques
  const adminPassword = await question('Mot de passe admin (minimum 8 caractères): ');
  if (adminPassword.length < 8) {
    console.log('Mot de passe trop court!');
    rl.close();
    return;
  }

  const smtpHost = await question('SMTP Host (ex: smtp.gmail.com): ') || 'smtp.gmail.com';
  const smtpUser = await question('SMTP User (votre email): ');
  const smtpPass = await question('SMTP Password (mot de passe app): ');

  // Créer le fichier .env
  const envContent = `# Configuration automatique - NE PAS MODIFIER MANUELLEMENT
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h

# Configuration SMTP
SMTP_HOST=${smtpHost}
SMTP_PORT=587
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}

# Configuration Admin
ADMIN_DEFAULT_PASSWORD=${adminPassword}

# Configuration Serveur
SERVER_PORT=3000
NODE_ENV=development

# Configuration Upload
UPLOAD_MAX_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,video/mp4,video/avi,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
`;

  fs.writeFileSync(envPath, envContent);
  fs.chmodSync(envPath, 0o600); // Permissions restrictives
  
  console.log('Fichier .env créé avec succès\n');

  // Initialiser la base de données
  console.log('Initialisation de la base de données...');
  
  try {
    const { initDatabase } = require('./src/utils/database');
    await initDatabase();
    console.log('Base de données initialisée\n');
    
    // Créer l'admin avec le bon mot de passe
    console.log('Création du compte administrateur...');
    const dbPath = path.join(__dirname, 'database.sqlite');
    const db = new sqlite3.Database(dbPath);
    
    const adminExists = await new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE email = ? AND role = ?', 
        ['admin@agency.local', 'admin'], (err, row) => resolve(row));
    });
    
    if (!adminExists) {
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
      
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO users (email, password_hash, role, first_name, last_name, company, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `, ['admin@agency.local', hashedAdminPassword, 'admin', 'Super', 'Admin', 'Agence'], 
        (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('Admin créé: admin@agency.local');
    } else {
      console.log('Admin déjà existant');
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la DB:', error.message);
    rl.close();
    return;
  }

  // Créer un client de test
  const createTestClient = await question('Créer un client de test ? (Y/n): ');
  if (createTestClient.toLowerCase() !== 'n') {
    console.log('Création du client de test...');
    
    try {
      const dbPath = path.join(__dirname, 'database.sqlite');
      const db = new sqlite3.Database(dbPath);
      
      // Générer un mot de passe aléatoire
      const clientPassword = 'client' + Math.random().toString(36).slice(-6);
      const clientEmail = 'client@test.com';
      
      const hashedPassword = await bcrypt.hash(clientPassword, 12);
      
      const clientId = await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR REPLACE INTO users 
          (email, password_hash, first_name, last_name, company, role, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'client', 1, datetime('now'), datetime('now'))
        `, [clientEmail, hashedPassword, 'Jean', 'Dupont', 'Entreprise Test'], 
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
      
      console.log(`Client créé:`);
      console.log(`   Email: ${clientEmail}`);
      console.log(`   Mot de passe: ${clientPassword}`);
      console.log(`   ID: ${clientId}`);
      
      db.close();
      
    } catch (error) {
      console.error('Erreur création clients:', error.message);
    }
  }

  // Créer le fichier de flag
  fs.writeFileSync(path.join(__dirname, '.setup-complete'), JSON.stringify({
    setupDate: new Date().toISOString(),
    version: '1.0.0'
  }));

  console.log('\nConfiguration terminée!');
  console.log('Vous pouvez maintenant lancer: npm start');
  console.log(`Admin: admin@agency.local / ${adminPassword}`);
  
  rl.close();
}

setup().catch(console.error);