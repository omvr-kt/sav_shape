#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function addSLAFields() {
  console.log('Adding SLA fields to tickets table...');
  
  try {
    // Add sla_paused_at column
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE tickets ADD COLUMN sla_paused_at DATETIME`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    // Add sla_time_spent column
    await new Promise((resolve, reject) => {
      db.run(`ALTER TABLE tickets ADD COLUMN sla_time_spent INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    console.log('✅ SLA fields added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding SLA fields:', error.message);
  } finally {
    db.close();
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  addSLAFields();
}

module.exports = { addSLAFields };