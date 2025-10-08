const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function createDeveloper() {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const db = new sqlite3.Database(dbPath);

  const devPassword = 'Dev123!Shape';
  const hashedPassword = await bcrypt.hash(devPassword, 12);

  db.run(`
    INSERT OR REPLACE INTO users
    (email, password_hash, role, first_name, last_name, company, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `, ['dev@agency.local', hashedPassword, 'team', 'Developer', 'User', 'Agence'],
  function(err) {
    if (err) {
      console.error('Erreur:', err);
    } else {
      console.log('Développeur créé avec succès!');
      console.log('Email: dev@agency.local');
      console.log('Mot de passe: Dev123!Shape');
    }
    db.close();
  });
}

createDeveloper();
