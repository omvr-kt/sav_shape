#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper pour exécuter les requêtes
const run = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const get = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

async function populateDatabase() {
  console.log('🚀 Création des données de démonstration...\n');

  try {
    // 1. Créer des clients
    console.log('📥 Création des clients...');
    const clientPassHash = await bcrypt.hash('Client123!', 12);
    
    const clients = [
      { email: 'pierre.martin@techcorp.fr', first_name: 'Pierre', last_name: 'Martin', company: 'TechCorp', phone: '0612345678' },
      { email: 'marie.dupont@innovate.fr', first_name: 'Marie', last_name: 'Dupont', company: 'Innovate SAS', phone: '0698765432' },
      { email: 'thomas.bernard@startup.io', first_name: 'Thomas', last_name: 'Bernard', company: 'Startup.io', phone: '0654321098' },
      { email: 'sophie.rousseau@ecommerce.fr', first_name: 'Sophie', last_name: 'Rousseau', company: 'E-Commerce Plus', phone: '0611223344' },
      { email: 'lucas.moreau@finance.fr', first_name: 'Lucas', last_name: 'Moreau', company: 'Finance Solutions', phone: '0655443322' }
    ];

    const clientIds = [];
    for (const client of clients) {
      const result = await run(`
        INSERT OR IGNORE INTO users (email, password_hash, role, first_name, last_name, company, phone, is_active)
        VALUES (?, ?, 'client', ?, ?, ?, ?, 1)
      `, [client.email, clientPassHash, client.first_name, client.last_name, client.company, client.phone]);
      
      let id = result.lastID;
      if (!id) {
        const existing = await get('SELECT id FROM users WHERE email = ?', [client.email]);
        id = existing.id;
      }
      clientIds.push(id);
    }
    console.log('✅ Clients créés\n');

    // 2. Créer des développeurs/support
    console.log('👥 Création de l\'équipe support...');
    const devPassHash = await bcrypt.hash('Dev123!', 12);
    
    const devs = [
      { email: 'jean.developer@shape-conseil.fr', first_name: 'Jean', last_name: 'Developer', company: 'Shape Conseil' },
      { email: 'alice.support@shape-conseil.fr', first_name: 'Alice', last_name: 'Support', company: 'Shape Conseil' }
    ];

    const devIds = [];
    for (const dev of devs) {
      const result = await run(`
        INSERT OR IGNORE INTO users (email, password_hash, role, first_name, last_name, company, is_active)
        VALUES (?, ?, 'dev', ?, ?, ?, 1)
      `, [dev.email, devPassHash, dev.first_name, dev.last_name, dev.company]);
      
      let id = result.lastID;
      if (!id) {
        const existing = await get('SELECT id FROM users WHERE email = ?', [dev.email]);
        id = existing.id;
      }
      devIds.push(id);
    }
    console.log('✅ Équipe support créée\n');

    // 3. Créer des projets
    console.log('📁 Création des projets...');
    const projects = [
      { 
        name: 'Site E-commerce TechCorp', 
        description: 'Refonte complète du site e-commerce avec nouvelle interface utilisateur',
        client_id: clientIds[0],
        status: 'active'
      },
      { 
        name: 'App Mobile Innovate', 
        description: 'Développement application mobile iOS/Android pour gestion des stocks',
        client_id: clientIds[1],
        status: 'active'
      },
      { 
        name: 'Dashboard Analytics', 
        description: 'Tableau de bord temps réel pour analyse des données business',
        client_id: clientIds[2],
        status: 'active'
      },
      { 
        name: 'Migration Cloud AWS', 
        description: 'Migration infrastructure complète vers AWS avec optimisation des coûts',
        client_id: clientIds[3],
        status: 'completed'
      },
      { 
        name: 'API Banking', 
        description: 'Développement API sécurisée pour services bancaires',
        client_id: clientIds[4],
        status: 'active'
      }
    ];

    const projectIds = [];
    for (const project of projects) {
      const result = await run(`
        INSERT OR IGNORE INTO projects (name, description, client_id, status)
        VALUES (?, ?, ?, ?)
      `, [project.name, project.description, project.client_id, project.status]);
      
      let id = result.lastID;
      if (!id) {
        const existing = await get('SELECT id FROM projects WHERE name = ?', [project.name]);
        id = existing.id;
      }
      projectIds.push(id);
    }
    console.log('✅ Projets créés\n');

    // 4. Créer des tickets
    console.log('🎫 Création des tickets...');
    const tickets = [
      {
        title: 'Erreur de connexion à la page de paiement',
        description: 'Les utilisateurs reçoivent une erreur 500 lors de la tentative de paiement par carte bancaire. Le problème semble survenir uniquement avec les cartes Visa.',
        priority: 'critical',
        status: 'open',
        client_id: clientIds[0],
        project_id: projectIds[0],
        assigned_to: devIds[0],
        ticket_number: 'TCK-2025001'
      },
      {
        title: 'Optimisation des performances de chargement',
        description: 'Les pages produits mettent plus de 5 secondes à charger. Besoin d\'optimiser les images et la mise en cache.',
        priority: 'high',
        status: 'in_progress',
        client_id: clientIds[0],
        project_id: projectIds[0],
        assigned_to: devIds[1],
        ticket_number: 'TCK-2025002'
      },
      {
        title: 'Bug synchronisation données offline',
        description: 'L\'application ne synchronise pas correctement les données lorsqu\'elle repasse en mode online. Des données sont perdues.',
        priority: 'high',
        status: 'open',
        client_id: clientIds[1],
        project_id: projectIds[1],
        assigned_to: devIds[0],
        ticket_number: 'TCK-2025003'
      },
      {
        title: 'Ajout fonction export PDF',
        description: 'Demande d\'ajout d\'une fonctionnalité pour exporter les rapports au format PDF avec graphiques.',
        priority: 'normal',
        status: 'resolved',
        client_id: clientIds[2],
        project_id: projectIds[2],
        ticket_number: 'TCK-2025004'
      },
      {
        title: 'Mise à jour documentation API',
        description: 'La documentation API n\'est pas à jour avec les derniers endpoints ajoutés. Besoin de mettre à jour Swagger.',
        priority: 'low',
        status: 'open',
        client_id: clientIds[4],
        project_id: projectIds[4],
        ticket_number: 'TCK-2025005'
      },
      {
        title: 'Problème authentification 2FA',
        description: 'Certains utilisateurs ne reçoivent pas le code SMS pour l\'authentification à deux facteurs.',
        priority: 'critical',
        status: 'in_progress',
        client_id: clientIds[4],
        project_id: projectIds[4],
        assigned_to: devIds[1],
        ticket_number: 'TCK-2025006'
      },
      {
        title: 'Amélioration UX formulaire inscription',
        description: 'Le taux d\'abandon sur le formulaire d\'inscription est élevé. Proposition de simplification du processus.',
        priority: 'normal',
        status: 'open',
        client_id: clientIds[3],
        project_id: projectIds[3],
        ticket_number: 'TCK-2025007'
      },
      {
        title: 'Bug affichage graphiques mobile',
        description: 'Les graphiques du dashboard ne s\'affichent pas correctement sur les appareils mobiles (iPhone notamment).',
        priority: 'high',
        status: 'resolved',
        client_id: clientIds[2],
        project_id: projectIds[2],
        assigned_to: devIds[0],
        ticket_number: 'TCK-2025008'
      }
    ];

    const ticketIds = [];
    for (const ticket of tickets) {
      // Calculer la deadline SLA (24h pour critical, 48h pour high, 72h pour normal/low)
      let slaHours = 72;
      if (ticket.priority === 'critical') slaHours = 24;
      else if (ticket.priority === 'high') slaHours = 48;
      
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + slaHours);
      
      const result = await run(`
        INSERT OR IGNORE INTO tickets (
          title, description, priority, status, client_id, project_id, 
          assigned_to, ticket_number, sla_deadline, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now'))
      `, [
        ticket.title, ticket.description, ticket.priority, ticket.status,
        ticket.client_id, ticket.project_id, ticket.assigned_to, ticket.ticket_number,
        slaDeadline.toISOString(), Math.floor(Math.random() * 48) // Créé dans les 48h passées
      ]);
      
      ticketIds.push(result.lastID);
    }
    console.log('✅ Tickets créés\n');

    // 5. Ajouter des commentaires sur certains tickets
    console.log('💬 Ajout de commentaires...');
    const comments = [
      {
        ticket_id: ticketIds[0],
        user_id: clientIds[0],
        content: 'Le problème semble se produire uniquement sur la version desktop du site.',
        is_internal: false
      },
      {
        ticket_id: ticketIds[0],
        user_id: devIds[0],
        content: 'Je reproduis le bug. Investigation en cours sur le module de paiement.',
        is_internal: false
      },
      {
        ticket_id: ticketIds[0],
        user_id: devIds[0],
        content: 'Problème identifié : certificat SSL expiré sur le serveur de paiement. Contact du fournisseur en cours.',
        is_internal: true
      },
      {
        ticket_id: ticketIds[1],
        user_id: devIds[1],
        content: 'J\'ai optimisé les images et mis en place un CDN. Les temps de chargement sont passés de 5s à 2s.',
        is_internal: false
      },
      {
        ticket_id: ticketIds[2],
        user_id: clientIds[1],
        content: 'C\'est urgent, nos commerciaux perdent des commandes à cause de ce bug!',
        is_internal: false
      },
      {
        ticket_id: ticketIds[3],
        user_id: devIds[0],
        content: 'Fonctionnalité développée et déployée. Vous pouvez maintenant exporter vos rapports en PDF depuis le menu Actions.',
        is_internal: false
      },
      {
        ticket_id: ticketIds[5],
        user_id: devIds[1],
        content: 'Problème avec le fournisseur SMS identifié. Bascule vers un nouveau provider en cours.',
        is_internal: false
      }
    ];

    for (const comment of comments) {
      await run(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
        VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
      `, [comment.ticket_id, comment.user_id, comment.content, comment.is_internal, Math.floor(Math.random() * 24)]);
    }
    console.log('✅ Commentaires ajoutés\n');

    // 6. Créer des tâches kanban
    console.log('📋 Création des tâches kanban...');
    const tasks = [
      {
        title: 'Refactoring module authentification',
        description: 'Moderniser le système d\'authentification avec JWT et refresh tokens',
        status: 'todo',
        assigned_to: devIds[0],
        priority: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        title: 'Tests unitaires API',
        description: 'Augmenter la couverture de tests à 80% minimum',
        status: 'in_progress',
        assigned_to: devIds[1],
        priority: 'normal',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        title: 'Documentation technique',
        description: 'Mettre à jour la documentation développeur avec les nouvelles API',
        status: 'in_progress',
        assigned_to: devIds[0],
        priority: 'low',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        title: 'Audit sécurité Q4',
        description: 'Réaliser l\'audit de sécurité trimestriel et corriger les vulnérabilités',
        status: 'done',
        assigned_to: devIds[1],
        priority: 'critical'
      },
      {
        title: 'Migration base de données',
        description: 'Migrer de SQLite vers PostgreSQL pour la production',
        status: 'todo',
        priority: 'high',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        title: 'Intégration Stripe',
        description: 'Implémenter le nouveau système de paiement avec Stripe',
        status: 'in_progress',
        assigned_to: devIds[0],
        priority: 'critical',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const task of tasks) {
      await run(`
        INSERT INTO tasks (title, description, status, assigned_to, priority, due_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [task.title, task.description, task.status, task.assigned_to, task.priority, task.due_date]);
    }
    console.log('✅ Tâches kanban créées\n');

    // 7. Créer des factures
    console.log('💰 Création des factures...');
    const invoices = [
      {
        invoice_number: 'FAC-2025-001',
        client_id: clientIds[0],
        project_id: projectIds[0],
        amount: 15000,
        status: 'paid',
        due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        invoice_number: 'FAC-2025-002',
        client_id: clientIds[1],
        project_id: projectIds[1],
        amount: 25000,
        status: 'pending',
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        invoice_number: 'FAC-2025-003',
        client_id: clientIds[2],
        project_id: projectIds[2],
        amount: 8500,
        status: 'overdue',
        due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        invoice_number: 'FAC-2025-004',
        client_id: clientIds[3],
        project_id: projectIds[3],
        amount: 45000,
        status: 'paid',
        due_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        invoice_number: 'FAC-2025-005',
        client_id: clientIds[4],
        project_id: projectIds[4],
        amount: 32000,
        status: 'pending',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const invoice of invoices) {
      const client = await get('SELECT * FROM users WHERE id = ?', [invoice.client_id]);
      if (client) {
        await run(`
          INSERT INTO invoices (
            invoice_number, client_id, project_id, amount, status, due_date, paid_at,
            client_first_name, client_last_name, client_email, client_company,
            created_at, issued_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
          invoice.invoice_number, invoice.client_id, invoice.project_id, invoice.amount,
          invoice.status, invoice.due_date, invoice.paid_at,
          client.first_name, client.last_name, client.email, client.company
        ]);
      }
    }
    console.log('✅ Factures créées\n');

    // 8. Configurer les SLA par défaut si pas déjà fait
    console.log('⏱️ Configuration des SLA...');
    await run(`
      INSERT OR REPLACE INTO settings (key, value, description, updated_at)
      VALUES 
        ('sla_critical_hours', '24', 'Heures pour résoudre un ticket critique', datetime('now')),
        ('sla_high_hours', '48', 'Heures pour résoudre un ticket haute priorité', datetime('now')),
        ('sla_normal_hours', '72', 'Heures pour résoudre un ticket normale priorité', datetime('now')),
        ('sla_low_hours', '120', 'Heures pour résoudre un ticket basse priorité', datetime('now')),
        ('business_hours_start', '09:00', 'Heure de début des heures ouvrables', datetime('now')),
        ('business_hours_end', '18:00', 'Heure de fin des heures ouvrables', datetime('now')),
        ('working_days', 'lundi,mardi,mercredi,jeudi,vendredi', 'Jours ouvrables', datetime('now'))
    `);
    console.log('✅ SLA configurés\n');

    console.log('🎉 Base de données peuplée avec succès!\n');
    console.log('📋 Résumé:');
    console.log('   - 5 clients créés');
    console.log('   - 2 développeurs/support créés');
    console.log('   - 5 projets créés');
    console.log('   - 8 tickets créés');
    console.log('   - 7 commentaires ajoutés');
    console.log('   - 6 tâches kanban créées');
    console.log('   - 5 factures créées');
    console.log('   - Configuration SLA mise à jour\n');
    
    console.log('🔐 Identifiants de connexion:');
    console.log('   Admin: admin@shape-conseil.fr / Admin123!Shape');
    console.log('   Client: pierre.martin@techcorp.fr / Client123!');
    console.log('   Dev: jean.developer@shape-conseil.fr / Dev123!');
    console.log('   Support: alice.support@shape-conseil.fr / Dev123!\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    db.close();
  }
}

populateDatabase();