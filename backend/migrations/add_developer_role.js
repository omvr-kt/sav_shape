#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function addDeveloperRole() {
  console.log('🔧 Ajout du rôle developer...');
  
  try {
    // Il faut recréer la table users avec la nouvelle contrainte
    // D'abord, créer une nouvelle table temporaire
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE users_temp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'client', 'team', 'developer')) DEFAULT 'client',
          first_name TEXT,
          last_name TEXT,
          company TEXT,
          phone TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          confidential_file TEXT,
          address TEXT,
          city TEXT,
          country TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Copier les données existantes (en spécifiant les colonnes exactes)
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users_temp (id, email, password_hash, role, first_name, last_name, company, phone, is_active, created_at, updated_at, confidential_file, address, city, country)
        SELECT id, email, password_hash, role, first_name, last_name, company, phone, is_active, created_at, updated_at,
               confidential_file,
               COALESCE(address, '') as address, 
               COALESCE(city, '') as city, 
               COALESCE(country, '') as country
        FROM users
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Supprimer l'ancienne table
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Renommer la nouvelle table
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE users_temp RENAME TO users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Maintenant mettre à jour l'utilisateur développeur
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET role = ? WHERE email = ?', ['developer', 'dev@agency.local'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Rôle developer ajouté et utilisateur mis à jour !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du rôle developer:', error.message);
  } finally {
    db.close();
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  addDeveloperRole();
}

module.exports = { addDeveloperRole };