#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function addKanbanTables() {
  console.log('Creating Kanban management tables...');
  
  try {
    // Table developer_projects pour ACL d'accès développeur
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS developer_projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(user_id, project_id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table tasks pour les tâches Kanban
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
          status TEXT NOT NULL CHECK (status IN ('todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done')) DEFAULT 'todo_back',
          start_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          due_at DATETIME NOT NULL,
          order_index INTEGER DEFAULT 0,
          created_by INTEGER NOT NULL,
          updated_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table task_attachments pour les pièces jointes
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS task_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          path TEXT NOT NULL,
          size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
          uploaded_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table task_comments pour les commentaires
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS task_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          author_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          edited BOOLEAN DEFAULT FALSE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (author_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table comment_mentions pour les mentions @utilisateur
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS comment_mentions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comment_id INTEGER NOT NULL,
          mentioned_user_id INTEGER NOT NULL,
          read_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
          FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table task_tickets pour la liaison tâches ↔ tickets (N:N)
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS task_tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          ticket_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
          UNIQUE(task_id, ticket_id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Table activity_logs pour l'historique
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          payload_json TEXT,
          actor_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (actor_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Index pour optimiser les performances
    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project_status_due ON tasks(project_id, status, due_at)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_developer_projects_user ON developer_projects(user_id, project_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(`CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(mentioned_user_id, read_at)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Kanban tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating Kanban tables:', error.message);
  } finally {
    db.close();
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  addKanbanTables();
}

module.exports = { addKanbanTables };