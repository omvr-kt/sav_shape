const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database.sqlite');

class Database {
  constructor() {
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.db.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

const db = new Database();

const initDatabase = async () => {
  try {
    await db.connect();
    
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'client', 'team')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS sla_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        response_time_hours INTEGER NOT NULL,
        resolution_time_hours INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(client_id, priority)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
        client_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        assigned_to INTEGER,
        sla_deadline DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        sla_notified_warning BOOLEAN DEFAULT 0,
        sla_notified_overdue BOOLEAN DEFAULT 0,
        FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER,
        comment_id INTEGER,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
        CHECK ((ticket_id IS NOT NULL AND comment_id IS NULL) OR (ticket_id IS NULL AND comment_id IS NOT NULL))
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        can_view BOOLEAN DEFAULT 1,
        can_create_tickets BOOLEAN DEFAULT 0,
        can_edit_tickets BOOLEAN DEFAULT 0,
        can_assign_tickets BOOLEAN DEFAULT 0,
        can_close_tickets BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(user_id, project_id)
      )
    `);

    await createIndexes();
    await runMigrations();
    await createDefaultAdmin();
    
    console.log('✅ Database tables created successfully');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

const createIndexes = async () => {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_sla_deadline ON tickets(sla_deadline)',
    'CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id)',
    'CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id)'
  ];

  for (const index of indexes) {
    await db.run(index);
  }
};

const createDefaultAdmin = async () => {
  // Admin uniquement créé par setup.js maintenant
  // Cette fonction ne fait plus rien
};

const runMigrations = async () => {
  try {
    // Check if SLA notification columns exist
    const tableInfo = await db.all("PRAGMA table_info(tickets)");
    const hasWarningCol = tableInfo.some(col => col.name === 'sla_notified_warning');
    const hasOverdueCol = tableInfo.some(col => col.name === 'sla_notified_overdue');
    
    if (!hasWarningCol) {
      await db.run('ALTER TABLE tickets ADD COLUMN sla_notified_warning BOOLEAN DEFAULT 0');
      console.log('✅ Added sla_notified_warning column');
    }
    
    if (!hasOverdueCol) {
      await db.run('ALTER TABLE tickets ADD COLUMN sla_notified_overdue BOOLEAN DEFAULT 0');
      console.log('✅ Added sla_notified_overdue column');
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
};

module.exports = {
  db,
  initDatabase
};