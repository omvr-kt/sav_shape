#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function fixMissingColumns() {
  console.log('🔧 Correction des colonnes manquantes...');
  
  try {
    // 1. Ajouter ticket_number à la table tickets
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE tickets ADD COLUMN ticket_number INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          console.log('✅ Colonne ticket_number ajoutée aux tickets');
          resolve();
        }
      });
    });

    // 2. Ajouter les colonnes d'adresse manquantes aux users
    const userColumns = ['address', 'city', 'country'];
    for (const column of userColumns) {
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE users ADD COLUMN ${column} TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            console.log(`✅ Colonne ${column} ajoutée aux users`);
            resolve();
          }
        });
      });
    }

    // 3. Ajouter les colonnes d'adresse manquantes aux invoices
    const invoiceColumns = ['client_address', 'client_city', 'client_country'];
    for (const column of invoiceColumns) {
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE invoices ADD COLUMN ${column} TEXT`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            console.log(`✅ Colonne ${column} ajoutée aux invoices`);
            resolve();
          }
        });
      });
    }

    // 4. Créer la table counters si elle n'existe pas
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS counters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          counter_type TEXT NOT NULL,
          counter_key TEXT NOT NULL,
          counter_value INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(counter_type, counter_key)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Table counters créée');
          resolve();
        }
      });
    });

    // 5. Mettre à jour les tickets existants avec des numéros séquentiels
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE tickets 
        SET ticket_number = id 
        WHERE ticket_number IS NULL
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Numéros de tickets mis à jour');
          resolve();
        }
      });
    });

    // 6. Initialiser les compteurs pour les tickets par projet
    await new Promise((resolve, reject) => {
      db.all(`SELECT DISTINCT project_id FROM tickets`, [], (err, projects) => {
        if (err) {
          reject(err);
          return;
        }

        const promises = projects.map(project => {
          return new Promise((resolveInner, rejectInner) => {
            // Obtenir le nombre max de tickets pour ce projet
            db.get(`SELECT MAX(ticket_number) as max_num FROM tickets WHERE project_id = ?`, [project.project_id], (err, result) => {
              if (err) {
                rejectInner(err);
                return;
              }

              const maxNum = result.max_num || 0;
              const counterKey = `project_${project.project_id}`;

              // Insérer ou mettre à jour le compteur
              db.run(`
                INSERT OR REPLACE INTO counters (counter_type, counter_key, counter_value)
                VALUES ('ticket', ?, ?)
              `, [counterKey, maxNum], (err) => {
                if (err) rejectInner(err);
                else resolveInner();
              });
            });
          });
        });

        Promise.all(promises).then(() => {
          console.log('✅ Compteurs de tickets initialisés');
          resolve();
        }).catch(reject);
      });
    });

    // 7. Initialiser le compteur global des factures
    await new Promise((resolve, reject) => {
      db.get(`SELECT MAX(invoice_number) as max_num FROM invoices`, [], (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        const maxNum = result.max_num || 0;
        
        db.run(`
          INSERT OR REPLACE INTO counters (counter_type, counter_key, counter_value)
          VALUES ('invoice', 'global', ?)
        `, [maxNum], (err) => {
          if (err) reject(err);
          else {
            console.log('✅ Compteur de factures initialisé');
            resolve();
          }
        });
      });
    });

    console.log('🎉 Toutes les corrections appliquées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors des corrections:', error.message);
  } finally {
    db.close();
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  fixMissingColumns();
}

module.exports = { fixMissingColumns };