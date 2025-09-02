const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const testClients = [
  {
    email: 'client1@test.com',
    password: '123456',
    first_name: 'Jean',
    last_name: 'Dupont',
    company: 'Entreprise Dupont',
    company_address: '123 rue de la Paix, 75001 Paris'
  },
  {
    email: 'client2@test.com', 
    password: '123456',
    first_name: 'Marie',
    last_name: 'Martin',
    company: 'Martin & Co',
    company_address: '456 avenue des Champs, 69001 Lyon'
  },
  {
    email: 'test@exemple.com',
    password: 'motdepasse',
    first_name: 'Pierre',
    last_name: 'Durand',
    company: 'Durand SARL',
    company_address: '789 boulevard Victor Hugo, 13001 Marseille'
  }
];

async function createTestClients() {
  console.log('🔧 Création des clients de test...\n');
  
  for (const client of testClients) {
    const hashedPassword = await bcrypt.hash(client.password, 10);
    
    const sql = `
      INSERT OR REPLACE INTO users 
      (email, password_hash, first_name, last_name, company, company_address, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    db.run(sql, [
      client.email, 
      hashedPassword, 
      client.first_name, 
      client.last_name, 
      client.company,
      client.company_address,
      'client', 
      1
    ], function(err) {
      if (err) {
        console.error(`❌ Erreur pour ${client.email}:`, err.message);
      } else {
        console.log(`✅ Client créé: ${client.email} | Mot de passe: ${client.password}`);
        console.log(`   👤 ${client.first_name} ${client.last_name} (${client.company})\n`);
      }
    });
  }
  
  // Fermer la DB après un délai pour laisser le temps aux insertions
  setTimeout(() => {
    db.close();
    console.log('📋 Récapitulatif des identifiants clients :');
    console.log('=====================================');
    testClients.forEach(client => {
      console.log(`📧 Email: ${client.email}`);
      console.log(`🔑 Mot de passe: ${client.password}`);
      console.log(`👤 Nom: ${client.first_name} ${client.last_name}`);
      console.log(`🏢 Entreprise: ${client.company}`);
      console.log(`🌐 URL: http://localhost:3000/client`);
      console.log('---');
    });
  }, 1000);
}

createTestClients();