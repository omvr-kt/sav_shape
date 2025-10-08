const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config/config');

const DB_PATH = process.env.SQLITE_DB_PATH || config.db.sqlitePath;

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
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
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
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
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
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
        closed_at DATETIME,
        sla_notified_warning BOOLEAN DEFAULT 0,
        sla_notified_overdue BOOLEAN DEFAULT 0,
        sla_paused_at DATETIME,
        sla_time_spent INTEGER DEFAULT 0,
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
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
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
        uploaded_at DATETIME DEFAULT (datetime('now', 'localtime')),
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
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(user_id, project_id)
      )
    `);

    // Table de configuration pour remplacer les données en dur
    await db.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // ===== Kanban / Dev tables (idempotent) =====
    await db.run(`
      CREATE TABLE IF NOT EXISTS developer_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(user_id, project_id)
      )
    `);

    await db.run(`
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
    `);

    await db.run(`
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
    `);

    await db.run(`
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
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS comment_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        mentioned_user_id INTEGER NOT NULL,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
        FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS task_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        ticket_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        UNIQUE(task_id, ticket_id)
      )
    `);

    await db.run(`
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
    `);

    // Helpful indexes
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project_status_due ON tasks(project_id, status, due_at)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_developer_projects_user ON developer_projects(user_id, project_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(mentioned_user_id, read_at)`);

    // Backfill/ensure missing columns for legacy databases
    const ensureColumn = async (table, column, definition) => {
      const cols = await db.all(`PRAGMA table_info(${table})`);
      const exists = Array.isArray(cols) && cols.some(c => c.name === column);
      if (!exists) {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };

    // Ensure expected columns exist (legacy-safe)
    await ensureColumn('task_comments', 'author_id', 'INTEGER');
    await ensureColumn('task_comments', 'body', "TEXT DEFAULT ''");
    await ensureColumn('task_comments', 'created_at', "DATETIME DEFAULT (datetime('now','localtime'))");
    await ensureColumn('task_comments', 'updated_at', "DATETIME DEFAULT (datetime('now','localtime'))");
    await ensureColumn('task_comments', 'edited', 'BOOLEAN DEFAULT 0');

    await ensureColumn('task_attachments', 'filename', 'TEXT');
    await ensureColumn('task_attachments', 'path', 'TEXT');
    await ensureColumn('task_attachments', 'size', 'INTEGER');
    await ensureColumn('task_attachments', 'mime_type', 'TEXT');
    await ensureColumn('task_attachments', 'uploaded_by', 'INTEGER');
    await ensureColumn('task_attachments', 'uploaded_at', "DATETIME DEFAULT (datetime('now','localtime'))");
    await ensureColumn('task_attachments', 'created_at', "DATETIME DEFAULT (datetime('now','localtime'))");

    await db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        revoked_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await createIndexes();
    await runMigrations();
    await createDefaultAdmin();
    
    console.log('Database tables created successfully');
    
  } catch (error) {
    console.error('Database initialization error:', error);
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
    'CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)'
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
      console.log('Added sla_notified_warning column');
    }
    
    if (!hasOverdueCol) {
      await db.run('ALTER TABLE tickets ADD COLUMN sla_notified_overdue BOOLEAN DEFAULT 0');
      console.log('Added sla_notified_overdue column');
    }

    // Check if confidential_file column exists in users table
    const usersTableInfo = await db.all("PRAGMA table_info(users)");
    const hasConfidentialCol = usersTableInfo.some(col => col.name === 'confidential_file');
    
    if (!hasConfidentialCol) {
      await db.run('ALTER TABLE users ADD COLUMN confidential_file TEXT');
      console.log('Added confidential_file column to users table');
    }

    // Check if invoices table exists, create if not
    const invoicesTableInfo = await db.all("PRAGMA table_info(invoices)").catch(() => []);
    if (invoicesTableInfo.length === 0) {
      await db.run(`
        CREATE TABLE invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_number TEXT UNIQUE NOT NULL,
          client_id INTEGER NOT NULL,
          amount_ht DECIMAL(10,2) NOT NULL,
          tva_rate DECIMAL(5,2) DEFAULT 20.00,
          amount_tva DECIMAL(10,2) NOT NULL,
          amount_ttc DECIMAL(10,2) NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'paid', 'overdue', 'cancelled')),
          due_date DATE,
          paid_date DATETIME,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Created invoices table');
    } else {
      // Check if new columns exist in invoices table
      const hasAmountHT = invoicesTableInfo.some(col => col.name === 'amount_ht');
      const hasTVARate = invoicesTableInfo.some(col => col.name === 'tva_rate');
      const hasAmountTVA = invoicesTableInfo.some(col => col.name === 'amount_tva');
      const hasAmountTTC = invoicesTableInfo.some(col => col.name === 'amount_ttc');
      
      if (!hasAmountHT) {
        await db.run('ALTER TABLE invoices ADD COLUMN amount_ht DECIMAL(10,2) DEFAULT 0');
        console.log('Added amount_ht column to invoices table');
      }
      
      if (!hasTVARate) {
        await db.run('ALTER TABLE invoices ADD COLUMN tva_rate DECIMAL(5,2) DEFAULT 20.00');
        console.log('Added tva_rate column to invoices table');
      }
      
      if (!hasAmountTVA) {
        await db.run('ALTER TABLE invoices ADD COLUMN amount_tva DECIMAL(10,2) DEFAULT 0');
        console.log('Added amount_tva column to invoices table');
      }
      
      if (!hasAmountTTC) {
        await db.run('ALTER TABLE invoices ADD COLUMN amount_ttc DECIMAL(10,2) DEFAULT 0');
        console.log('Added amount_ttc column to invoices table');
      }

      // Check if client billing info columns exist
      const hasClientName = invoicesTableInfo.some(col => col.name === 'client_first_name');
      const hasClientLastName = invoicesTableInfo.some(col => col.name === 'client_last_name');
      const hasClientEmail = invoicesTableInfo.some(col => col.name === 'client_email');
      const hasClientCompany = invoicesTableInfo.some(col => col.name === 'client_company');

      if (!hasClientName) {
        await db.run('ALTER TABLE invoices ADD COLUMN client_first_name TEXT');
        console.log('Added client_first_name column to invoices table');
      }
      
      if (!hasClientLastName) {
        await db.run('ALTER TABLE invoices ADD COLUMN client_last_name TEXT');
        console.log('Added client_last_name column to invoices table');
      }
      
      if (!hasClientEmail) {
        await db.run('ALTER TABLE invoices ADD COLUMN client_email TEXT');
        console.log('Added client_email column to invoices table');
      }
      
      if (!hasClientCompany) {
        await db.run('ALTER TABLE invoices ADD COLUMN client_company TEXT');
        console.log('Added client_company column to invoices table');
      }
    }

    // Insérer les données de configuration par défaut
    await insertDefaultSettings();
  } catch (error) {
    console.error('Migration error:', error);
  }
};

const insertDefaultSettings = async () => {
  try {
    const settings = [
      // Horaires de travail
      { key: 'business_hours_start', value: '9', description: 'Heure de début (format 24h)', category: 'business_hours' },
      { key: 'business_hours_end', value: '18', description: 'Heure de fin (format 24h)', category: 'business_hours' },
      { key: 'business_days', value: '[1,2,3,4,5]', description: 'Jours ouvrés (0=dimanche, 1=lundi...)', category: 'business_hours' },
      
      // Labels de statut
      { key: 'status_open_label', value: 'Ouvert', description: 'Label pour statut ouvert', category: 'labels' },
      { key: 'status_in_progress_label', value: 'En cours', description: 'Label pour statut en cours', category: 'labels' },
      { key: 'status_waiting_client_label', value: 'En attente', description: 'Label pour statut en attente client', category: 'labels' },
      { key: 'status_resolved_label', value: 'Résolu', description: 'Label pour statut résolu', category: 'labels' },
      { key: 'status_closed_label', value: 'Fermé', description: 'Label pour statut fermé', category: 'labels' },
      
      // Labels de priorité
      { key: 'priority_low_label', value: 'Faible', description: 'Label pour priorité faible', category: 'labels' },
      { key: 'priority_normal_label', value: 'Normal', description: 'Label pour priorité normale', category: 'labels' },
      { key: 'priority_high_label', value: 'Élevé', description: 'Label pour priorité élevée', category: 'labels' },
      { key: 'priority_urgent_label', value: 'Urgent', description: 'Label pour priorité urgente', category: 'labels' },
      
      // Configuration des factures
      { key: 'invoice_prefix', value: 'SHAPE', description: 'Préfixe des numéros de facture', category: 'invoicing' },
      { key: 'default_tva_rate', value: '20.00', description: 'Taux de TVA par défaut (%)', category: 'invoicing' },
      
      // Configuration générale
      { key: 'app_name', value: 'SAV Shape', description: 'Nom de l\'application', category: 'general' },
      { key: 'company_name', value: 'Shape Agency', description: 'Nom de l\'entreprise', category: 'general' }
    ];

    for (const setting of settings) {
      await db.run(
        'INSERT OR IGNORE INTO app_settings (key, value, description, category) VALUES (?, ?, ?, ?)',
        [setting.key, setting.value, setting.description, setting.category]
      );
    }
    
    console.log('Default settings inserted');
  } catch (error) {
    console.error('Error inserting default settings:', error);
  }
};

module.exports = {
  db,
  initDatabase
};
