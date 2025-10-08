const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function createAdmin() {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const db = new sqlite3.Database(dbPath);

  const adminPassword = 'Admin123!Shape';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  db.run(`
    INSERT OR REPLACE INTO users
    (email, password_hash, role, first_name, last_name, company, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `, ['admin@agency.local', hashedPassword, 'admin', 'Super', 'Admin', 'Agence'],
  function(err) {
    if (err) {
      console.error('Erreur:', err);
    } else {
      console.log('Admin créé avec succès!');
      console.log('Email: admin@agency.local');
      console.log('Mot de passe: Admin123!Shape');
    }
    db.close();
  });
}

createAdmin();
