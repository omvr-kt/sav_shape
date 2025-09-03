const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Créer ou ouvrir la base de données
const db = new sqlite3.Database('sav_shape.db');

console.log('🗄️ Initialisation de la base de données...');

// Utiliser serialize pour exécuter les requêtes en séquence
db.serialize(() => {
  // Créer les tables
  console.log('📋 Création des tables...');

  // Table users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      company TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      confidential_file TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table users:', err);
    } else {
      console.log('✅ Table users créée');
    }
  });

  // Table projects
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      client_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table projects:', err);
    } else {
      console.log('✅ Table projects créée');
    }
  });

  // Table tickets
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      assigned_to INTEGER,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      category TEXT DEFAULT 'support',
      sla_hours INTEGER DEFAULT 24,
      sla_deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (client_id) REFERENCES users (id),
      FOREIGN KEY (assigned_to) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table tickets:', err);
    } else {
      console.log('✅ Table tickets créée');
    }
  });

  // Table comments
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets (id),
      FOREIGN KEY (author_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table comments:', err);
    } else {
      console.log('✅ Table comments créée');
    }
  });

  // Table invoices (factures)
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      quote_file TEXT,
      specifications_file TEXT,
      amount DECIMAL(10,2),
      description TEXT,
      status TEXT DEFAULT 'pending',
      due_date DATETIME,
      paid_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users (id)
    )
  `, (err) => {
    if (err) {
      console.error('Erreur création table invoices:', err);
    } else {
      console.log('✅ Table invoices créée');
    }
  });

  // Créer des utilisateurs de test
  console.log('👤 Création des utilisateurs de test...');

  const hashedPassword = bcrypt.hashSync('password123', 10);

  // Admin
  db.run(`
    INSERT OR IGNORE INTO users (first_name, last_name, email, password_hash, role) 
    VALUES (?, ?, ?, ?, ?)
  `, ['Admin', 'System', 'admin@sav.com', hashedPassword, 'admin'], function(err) {
    if (err) {
      console.error('Erreur création admin:', err);
    } else {
      console.log('✅ Admin créé');
    }
  });

  // Jean Dupont (client)
  db.run(`
    INSERT OR IGNORE INTO users (first_name, last_name, email, password_hash, role) 
    VALUES (?, ?, ?, ?, ?)
  `, ['Jean', 'Dupont', 'jean.dupont@email.com', hashedPassword, 'client'], function(err) {
    if (err) {
      console.error('Erreur création Jean Dupont:', err);
    } else {
      console.log('✅ Jean Dupont créé');
      
      // Créer des projets pour Jean Dupont
      console.log('📁 Création des projets pour Jean Dupont...');
      
      // Récupérer l'ID de Jean Dupont
      db.get("SELECT id FROM users WHERE email = 'jean.dupont@email.com'", (err, user) => {
        if (err || !user) {
          console.error('Erreur récupération Jean Dupont:', err);
          return;
        }

        const clientId = user.id;

        // Projet 1: Site E-commerce
        db.run(`
          INSERT INTO projects (name, description, client_id, status) 
          VALUES (?, ?, ?, ?)
        `, [
          'Site Web E-commerce', 
          'Développement d\'un site de vente en ligne avec système de paiement et gestion des stocks', 
          clientId, 
          'active'
        ], function(err) {
          if (err) {
            console.error('Erreur création projet 1:', err);
          } else {
            console.log('✅ Projet E-commerce créé');
            
            // Créer des tickets pour ce projet
            const projetId = this.lastID;
            
            // Ticket 1
            db.run(`
              INSERT INTO tickets (title, description, project_id, client_id, status, priority, category) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              'Problème de connexion au paiement',
              'Les utilisateurs n\'arrivent pas à finaliser leurs commandes. Le module de paiement semble ne pas répondre.',
              projetId,
              clientId,
              'open',
              'urgent',
              'technical'
            ], (err) => {
              if (err) {
                console.error('Erreur création ticket 1:', err);
              } else {
                console.log('✅ Ticket urgent créé');
              }
            });

            // Ticket 2
            db.run(`
              INSERT INTO tickets (title, description, project_id, client_id, status, priority, category) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              'Amélioration de l\'interface panier',
              'Demande d\'ajout d\'un bouton "Sauvegarder pour plus tard" dans le panier d\'achat.',
              projetId,
              clientId,
              'in_progress',
              'normal',
              'feature'
            ], (err) => {
              if (err) {
                console.error('Erreur création ticket 2:', err);
              } else {
                console.log('✅ Ticket fonctionnalité créé');
              }
            });
          }
        });

        // Projet 2: Application Mobile
        db.run(`
          INSERT INTO projects (name, description, client_id, status) 
          VALUES (?, ?, ?, ?)
        `, [
          'Application Mobile', 
          'Application mobile iOS et Android pour la gestion des commandes', 
          clientId, 
          'active'
        ], function(err) {
          if (err) {
            console.error('Erreur création projet 2:', err);
          } else {
            console.log('✅ Projet Application Mobile créé');
            
            const projetId = this.lastID;
            
            // Ticket pour app mobile
            db.run(`
              INSERT INTO tickets (title, description, project_id, client_id, status, priority, category) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              'Notification push ne fonctionne pas',
              'Les notifications push ne sont pas reçues sur iOS. Elles fonctionnent correctement sur Android.',
              projetId,
              clientId,
              'waiting_client',
              'high',
              'technical'
            ], (err) => {
              if (err) {
                console.error('Erreur création ticket mobile:', err);
              } else {
                console.log('✅ Ticket mobile créé');
              }
            });
          }
        });

        // Projet 3: Dashboard (terminé)
        db.run(`
          INSERT INTO projects (name, description, client_id, status) 
          VALUES (?, ?, ?, ?)
        `, [
          'Dashboard Analytics', 
          'Tableau de bord pour analyser les performances des ventes', 
          clientId, 
          'completed'
        ], function(err) {
          if (err) {
            console.error('Erreur création projet 3:', err);
          } else {
            console.log('✅ Projet Dashboard créé');
            
            const projetId = this.lastID;
            
            // Ticket résolu
            db.run(`
              INSERT INTO tickets (title, description, project_id, client_id, status, priority, category) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              'Demande de formation',
              'Demande de formation pour l\'équipe sur l\'utilisation du dashboard analytics.',
              projetId,
              clientId,
              'resolved',
              'low',
              'support'
            ], (err) => {
              if (err) {
                console.error('Erreur création ticket formation:', err);
              } else {
                console.log('✅ Ticket formation créé');
              }
            });
          }
        });
      });
    }
  });

  // Marie Martin (autre client pour test)
  db.run(`
    INSERT OR IGNORE INTO users (first_name, last_name, email, password_hash, role) 
    VALUES (?, ?, ?, ?, ?)
  `, ['Marie', 'Martin', 'marie.martin@email.com', hashedPassword, 'client'], function(err) {
    if (err) {
      console.error('Erreur création Marie Martin:', err);
    } else {
      console.log('✅ Marie Martin créée');
    }
  });

  // Afficher le résumé après un délai pour laisser le temps aux insertions
  setTimeout(() => {
    db.get("SELECT COUNT(*) as count FROM users", (err, userCount) => {
      if (!err) {
        db.get("SELECT COUNT(*) as count FROM projects", (err2, projectCount) => {
          if (!err2) {
            db.get("SELECT COUNT(*) as count FROM tickets", (err3, ticketCount) => {
              if (!err3) {
                console.log('\n📊 Résumé de la base de données:');
                console.log(`👥 Utilisateurs: ${userCount.count}`);
                console.log(`📁 Projets: ${projectCount.count}`);
                console.log(`🎫 Tickets: ${ticketCount.count}`);
                
                console.log('\n🔑 Informations de connexion:');
                console.log('Admin: admin@sav.com / password123');
                console.log('Client: jean.dupont@email.com / password123');
                console.log('Client: marie.martin@email.com / password123');
                
                console.log('\n✅ Base de données initialisée avec succès!');
                
                // Fermer la base de données
                db.close((err) => {
                  if (err) {
                    console.error('Erreur fermeture base:', err);
                  } else {
                    console.log('🔒 Base de données fermée');
                    process.exit(0);
                  }
                });
              }
            });
          }
        });
      }
    });
  }, 2000); // Attendre 2 secondes pour que toutes les insertions soient terminées
});