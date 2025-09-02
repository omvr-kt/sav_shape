const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function createAdmin() {
  const email = 'admin@test.com';
  const password = '123456';
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = `
    INSERT OR REPLACE INTO users (email, password, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `;

  db.run(sql, [email, password, hashedPassword, 'Admin', 'Test', 'admin', 1], function(err) {
    if (err) {
      console.error('Erreur:', err.message);
    } else {
      console.log('✅ Compte administrateur créé avec succès !');
      console.log('📧 Email: admin@test.com');
      console.log('🔑 Mot de passe: 123456');
      console.log('🌐 URL: http://localhost:3000/admin');
    }
    db.close();
  });
}

createAdmin();