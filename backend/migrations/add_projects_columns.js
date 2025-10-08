#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function addProjectsColumns() {
  console.log('Ajout des colonnes manquantes à la table projects...');

  try {
    // Vérifier si les colonnes existent déjà
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(projects)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const columnNames = tableInfo.map(col => col.name);

    // Ajouter la colonne 'code' si elle n'existe pas
    if (!columnNames.includes('code')) {
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE projects ADD COLUMN code TEXT`, (err) => {
          if (err) {
            console.warn('Avertissement colonne code:', err.message);
            resolve(); // Continue même si erreur (colonne existe peut-être déjà)
          } else {
            console.log('✅ Colonne "code" ajoutée');
            resolve();
          }
        });
      });
    } else {
      console.log('ℹ️  Colonne "code" existe déjà');
    }

    // Ajouter la colonne 'archived_at' si elle n'existe pas
    if (!columnNames.includes('archived_at')) {
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE projects ADD COLUMN archived_at DATETIME`, (err) => {
          if (err) {
            console.warn('Avertissement colonne archived_at:', err.message);
            resolve(); // Continue même si erreur
          } else {
            console.log('✅ Colonne "archived_at" ajoutée');
            resolve();
          }
        });
      });
    } else {
      console.log('ℹ️  Colonne "archived_at" existe déjà');
    }

    // Générer des codes pour les projets existants qui n'en ont pas
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE projects
        SET code = UPPER(SUBSTR(name, 1, 3) || '-' || id)
        WHERE code IS NULL OR code = ''
      `, (err) => {
        if (err) {
          console.warn('Avertissement génération codes:', err.message);
          resolve();
        } else {
          console.log('✅ Codes générés pour les projets existants');
          resolve();
        }
      });
    });

    console.log('✅ Migration des colonnes projects terminée!');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
  } finally {
    db.close();
  }
}

// Exécuter la migration si ce script est appelé directement
if (require.main === module) {
  addProjectsColumns();
}

module.exports = { addProjectsColumns };
