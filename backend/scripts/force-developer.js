#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function run() {
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new sqlite3.Database(dbPath);

  const email = process.env.DEV_EMAIL || 'dev@agency.local';
  const password = process.env.DEV_PASSWORD || 'Dev123!Shape';

  try {
    const hash = await bcrypt.hash(password, 12);

    // Helper to upgrade users table to support 'developer' role
    const upgradeUsersTable = () => new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS users_temp', (e1) => {
          if (e1) console.warn('DROP users_temp warning:', e1.message);
          db.run(`
            CREATE TABLE users_temp (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('admin','client','team','developer')) DEFAULT 'client',
              first_name TEXT,
              last_name TEXT,
              company TEXT,
              phone TEXT,
              is_active BOOLEAN DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (e2) => {
            if (e2) return reject(e2);
            db.run(`
              INSERT INTO users_temp (id, email, password_hash, role, first_name, last_name, company, phone, is_active, created_at, updated_at)
              SELECT id, email, password_hash, role, first_name, last_name, company, phone, is_active, created_at, updated_at
              FROM users
            `, (e3) => {
              if (e3) return reject(e3);
              db.run('DROP TABLE users', (e4) => {
                if (e4) return reject(e4);
                db.run('ALTER TABLE users_temp RENAME TO users', (e5) => {
                  if (e5) return reject(e5);
                  resolve();
                });
              });
            });
          });
        });
      });
    });

    // Upsert user as developer (with fallback upgrade if CHECK constraint blocks)
    const upsertDev = () => new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (email, password_hash, role, first_name, last_name, company, is_active, created_at, updated_at)
        VALUES (?, ?, 'developer', 'Developer', 'User', 'Agence', 1, datetime('now'), datetime('now'))
        ON CONFLICT(email) DO UPDATE SET 
          password_hash=excluded.password_hash,
          role='developer',
          is_active=1,
          updated_at=datetime('now')
      `, [email, hash], (err) => err ? reject(err) : resolve());
    });

    try {
      await upsertDev();
    } catch (e) {
      if (/CHECK constraint failed/.test(e.message) || /constraint failed: role/.test(e.message)) {
        console.log('ℹ Upgrading users table to allow developer role...');
        await upgradeUsersTable();
        await upsertDev();
      } else {
        throw e;
      }
    }

    // Fetch user id
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, role FROM users WHERE email = ?', [email], (err, row) => err ? reject(err) : resolve(row));
    });

    console.log(`✔ Developer user ensured: ${email} (role=${user.role}, id=${user.id})`);
    console.log(`   Password reset to: ${password}`);

    // Optionally assign to first 3 projects if none assigned
    const assignedCount = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as c FROM developer_projects WHERE user_id = ?', [user.id], (err, row) => resolve((row && row.c) || 0));
    });

    if (assignedCount === 0) {
      const projects = await new Promise((resolve) => {
        db.all('SELECT id FROM projects LIMIT 3', [], (err, rows) => resolve(rows || []));
      });
      for (const p of projects) {
        await new Promise((resolve) => {
          db.run('INSERT OR IGNORE INTO developer_projects (user_id, project_id) VALUES (?, ?)', [user.id, p.id], () => resolve());
        });
      }
      if (projects.length > 0) console.log(`✔ Assigned to ${projects.length} project(s)`);
    }

  } catch (err) {
    console.error('✖ Error ensuring developer user:', err.message || err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

run();
