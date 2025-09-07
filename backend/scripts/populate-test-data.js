const { db, initDatabase } = require('../src/utils/database');
const bcrypt = require('bcryptjs');

/**
 * Script pour peupler la base de données avec des données de test réalistes
 * ⚠️  UNIQUEMENT POUR LE DÉVELOPPEMENT - Ne pas utiliser en production
 */

async function populateTestData() {
  // Vérifier qu'on n'est pas en production
  if (process.env.NODE_ENV === 'production') {
    console.log('❌ Ce script ne peut pas être exécuté en production');
    console.log('   Utilisez setup-production.js pour configurer la production');
    process.exit(1);
  }
  
  console.log('🧪 Début du peuplement de la base avec des données de test...');
  console.log('   ⚠️  Mode développement uniquement');
  
  try {
    // S'assurer que la base est initialisée
    await initDatabase();
    console.log('✅ Base de données initialisée');
    
    // Nettoyer les données existantes (sauf admin)
    await cleanExistingData();
    
    // Créer des clients de test
    const clients = await createTestClients();
    console.log(`✅ ${clients.length} clients créés`);
    
    // Créer des projets pour chaque client
    const projects = await createTestProjects(clients);
    console.log(`✅ ${projects.length} projets créés`);
    
    // Créer des tickets pour chaque projet
    const tickets = await createTestTickets(projects, clients);
    console.log(`✅ ${tickets.length} tickets créés`);
    
    // Créer des commentaires pour les tickets
    const comments = await createTestComments(tickets, clients);
    console.log(`✅ ${comments.length} commentaires créés`);
    
    // Créer des factures pour les clients
    const invoices = await createTestInvoices(clients);
    console.log(`✅ ${invoices.length} factures créées`);
    
    console.log('🎉 Peuplement terminé avec succès !');
    
    // Afficher un résumé
    await displaySummary();
    
  } catch (error) {
    console.error('❌ Erreur lors du peuplement:', error);
    throw error;
  } finally {
    await db.close();
  }
}

async function cleanExistingData() {
  console.log('🧹 Nettoyage des données existantes...');
  
  // Ne pas supprimer les admins, seulement les clients et leurs données associées
  await db.run('DELETE FROM ticket_comments WHERE user_id IN (SELECT id FROM users WHERE role = "client")');
  await db.run('DELETE FROM tickets WHERE client_id IN (SELECT id FROM users WHERE role = "client")');
  await db.run('DELETE FROM projects WHERE client_id IN (SELECT id FROM users WHERE role = "client")');
  await db.run('DELETE FROM invoices WHERE client_id IN (SELECT id FROM users WHERE role = "client")');
  await db.run('DELETE FROM users WHERE role = "client"');
  
  console.log('✅ Données nettoyées');
}

async function createTestClients() {
  const hashedPassword = await bcrypt.hash('client123', 10);
  
  const clientsData = [
    {
      first_name: 'Jean',
      last_name: 'Dupont', 
      email: 'jean.dupont@entreprise.com',
      company: 'Tech Solutions SARL',
      phone: '01 23 45 67 89'
    },
    {
      first_name: 'Marie',
      last_name: 'Martin',
      email: 'marie.martin@innovcorp.fr', 
      company: 'InnovCorp SA',
      phone: '01 98 76 54 32'
    },
    {
      first_name: 'Pierre',
      last_name: 'Bernard',
      email: 'p.bernard@digitalex.com',
      company: 'Digital Express',
      phone: '01 45 67 89 12'
    },
    {
      first_name: 'Sophie',
      last_name: 'Moreau',
      email: 'sophie.moreau@webcraft.fr',
      company: 'WebCraft Studio',
      phone: '01 34 56 78 90'
    }
  ];

  const clients = [];
  
  for (const clientData of clientsData) {
    const result = await db.run(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, company, phone, is_active)
       VALUES (?, ?, ?, ?, 'client', ?, ?, 1)`,
      [clientData.first_name, clientData.last_name, clientData.email, hashedPassword, clientData.company, clientData.phone]
    );
    
    clients.push({
      id: result.id,
      ...clientData
    });
  }
  
  return clients;
}

async function createTestProjects(clients) {
  const projectTemplates = [
    ['Site Web E-commerce', 'Développement d\'un site de vente en ligne avec système de paiement'],
    ['Application Mobile', 'Application iOS et Android pour la gestion des commandes'],
    ['Dashboard Analytics', 'Tableau de bord pour analyser les performances'],
    ['API REST', 'Développement d\'une API pour l\'intégration avec les systèmes tiers'],
    ['Refonte UI/UX', 'Modernisation de l\'interface utilisateur'],
    ['Module CRM', 'Système de gestion de la relation client'],
    ['Plateforme B2B', 'Portail destiné aux partenaires commerciaux'],
    ['App de Gestion', 'Application interne de gestion des ressources']
  ];
  
  const projects = [];
  const statuses = ['active', 'paused', 'completed'];
  
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const projectCount = Math.floor(Math.random() * 3) + 2; // 2-4 projets par client
    
    for (let j = 0; j < projectCount; j++) {
      const template = projectTemplates[Math.floor(Math.random() * projectTemplates.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const result = await db.run(
        `INSERT INTO projects (name, description, client_id, status)
         VALUES (?, ?, ?, ?)`,
        [template[0], template[1], client.id, status]
      );
      
      projects.push({
        id: result.id,
        name: template[0],
        description: template[1],
        client_id: client.id,
        status: status
      });
    }
  }
  
  return projects;
}

async function createTestTickets(projects, clients) {
  const ticketTemplates = [
    {
      title: 'Problème de connexion à l\'espace admin',
      description: 'Impossible de me connecter à l\'espace d\'administration depuis hier soir. Le système indique "identifiants incorrects" même avec les bons paramètres.',
      priority: 'urgent',
      category: 'technical'
    },
    {
      title: 'Amélioration de l\'interface panier',
      description: 'Demande d\'ajout d\'un bouton "Sauvegarder pour plus tard" dans le panier d\'achat pour améliorer l\'expérience utilisateur.',
      priority: 'normal', 
      category: 'feature'
    },
    {
      title: 'Lenteur du site en fin de journée',
      description: 'Le site devient très lent entre 17h et 19h. Les pages mettent plus de 10 secondes à se charger.',
      priority: 'high',
      category: 'performance'
    },
    {
      title: 'Demande de formation équipe',
      description: 'Nous aurions besoin d\'une formation pour notre équipe sur l\'utilisation du nouveau dashboard.',
      priority: 'low',
      category: 'support'
    },
    {
      title: 'Bug affichage mobile',
      description: 'Sur iPhone, le menu ne s\'affiche pas correctement en mode portrait. Les boutons sont coupés.',
      priority: 'high',
      category: 'bug'
    },
    {
      title: 'Notification push défaillante',
      description: 'Les notifications push ne sont pas reçues sur iOS. Elles fonctionnent correctement sur Android.',
      priority: 'high',
      category: 'technical'
    },
    {
      title: 'Demande d\'export données',
      description: 'Possibilité d\'exporter les données clients au format Excel pour nos analyses internes.',
      priority: 'normal',
      category: 'feature'
    },
    {
      title: 'Erreur 500 sur le checkout',
      description: 'Les utilisateurs reçoivent une erreur 500 lors de la finalisation de commande. Le problème est intermittent.',
      priority: 'urgent',
      category: 'bug'
    }
  ];
  
  const tickets = [];
  const statuses = ['open', 'in_progress', 'waiting_client', 'resolved', 'closed'];
  
  for (const project of projects) {
    const ticketCount = Math.floor(Math.random() * 4) + 1; // 1-4 tickets par projet
    
    for (let i = 0; i < ticketCount; i++) {
      const template = ticketTemplates[Math.floor(Math.random() * ticketTemplates.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Créer des dates réalistes
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 30)); // 0-30 jours dans le passé
      
      const result = await db.run(
        `INSERT INTO tickets (title, description, project_id, client_id, status, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [template.title, template.description, project.id, project.client_id, status, template.priority, createdDate.toISOString()]
      );
      
      tickets.push({
        id: result.id,
        title: template.title,
        description: template.description,
        project_id: project.id,
        client_id: project.client_id,
        status: status,
        priority: template.priority,
        created_at: createdDate
      });
    }
  }
  
  return tickets;
}

async function createTestComments(tickets, clients) {
  const commentTemplates = [
    {
      content: "Bonjour, j'ai bien reçu votre signalement. Nous allons examiner le problème dans les plus brefs délais.",
      role: 'admin',
      is_internal: false
    },
    {
      content: "Le problème semble venir de la configuration du serveur. Investigation en cours.",
      role: 'admin', 
      is_internal: true
    },
    {
      content: "Merci pour votre retour. Pouvez-vous nous préciser sur quels navigateurs vous avez testé ?",
      role: 'admin',
      is_internal: false
    },
    {
      content: "J'ai testé sur Chrome et Firefox, même problème sur les deux.",
      role: 'client',
      is_internal: false
    },
    {
      content: "Le correctif a été déployé en production. Pouvez-vous confirmer que le problème est résolu ?",
      role: 'admin',
      is_internal: false
    },
    {
      content: "Parfait, tout fonctionne maintenant. Merci beaucoup !",
      role: 'client', 
      is_internal: false
    }
  ];
  
  const comments = [];
  
  // Créer un admin de référence
  const admin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  
  for (const ticket of tickets) {
    const commentCount = Math.floor(Math.random() * 4) + 1; // 1-4 commentaires par ticket
    
    for (let i = 0; i < commentCount; i++) {
      const template = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
      
      // Déterminer l'auteur selon le rôle
      const user_id = template.role === 'admin' ? admin.id : ticket.client_id;
      
      // Créer des dates réalistes après la création du ticket
      const commentDate = new Date(ticket.created_at);
      commentDate.setHours(commentDate.getHours() + Math.floor(Math.random() * 48)); // 0-48h après création
      
      const result = await db.run(
        `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [ticket.id, user_id, template.content, template.is_internal ? 1 : 0, commentDate.toISOString()]
      );
      
      comments.push({
        id: result.id,
        ticket_id: ticket.id,
        user_id: user_id,
        content: template.content,
        is_internal: template.is_internal,
        created_at: commentDate
      });
    }
  }
  
  return comments;
}

async function createTestInvoices(clients) {
  const invoices = [];
  
  for (const client of clients) {
    const invoiceCount = Math.floor(Math.random() * 3) + 1; // 1-3 factures par client
    
    for (let i = 0; i < invoiceCount; i++) {
      const amounts = [1500, 2500, 3200, 4800, 5500, 7200, 9800];
      const amountHT = amounts[Math.floor(Math.random() * amounts.length)];
      const tvaRate = 20.00;
      const amountTVA = Math.round(amountHT * (tvaRate / 100) * 100) / 100;
      const amountTTC = Math.round((amountHT + amountTVA) * 100) / 100;
      
      const descriptions = [
        'Développement site web e-commerce',
        'Maintenance et support technique',
        'Formation équipe utilisateurs', 
        'Développement application mobile',
        'Refonte interface utilisateur',
        'Intégration API tierce'
      ];
      
      const statuses = ['sent', 'paid', 'overdue'];
      
      // Numéro de facture
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90)); // 0-90 jours dans le passé
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const timestamp = Date.now().toString().slice(-6);
      const invoiceNumber = `SHAPE-${year}${month}-${timestamp}-${i}`;
      
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + 7);
      
      const result = await db.run(
        `INSERT INTO invoices (
          invoice_number, client_id, amount_ht, tva_rate, amount_tva, amount_ttc,
          description, status, due_date, client_first_name, client_last_name,
          client_email, client_company, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber, client.id, amountHT, tvaRate, amountTVA, amountTTC,
          descriptions[Math.floor(Math.random() * descriptions.length)],
          statuses[Math.floor(Math.random() * statuses.length)],
          dueDate.toISOString(),
          client.first_name, client.last_name, client.email, client.company,
          date.toISOString()
        ]
      );
      
      invoices.push({
        id: result.id,
        invoice_number: invoiceNumber,
        client_id: client.id,
        amount_ht: amountHT,
        amount_ttc: amountTTC
      });
    }
  }
  
  return invoices;
}

async function displaySummary() {
  console.log('\n📊 RÉSUMÉ DES DONNÉES CRÉÉES:');
  console.log('=' * 40);
  
  const userCount = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'client'");
  const projectCount = await db.get("SELECT COUNT(*) as count FROM projects");
  const ticketCount = await db.get("SELECT COUNT(*) as count FROM tickets");  
  const commentCount = await db.get("SELECT COUNT(*) as count FROM ticket_comments");
  const invoiceCount = await db.get("SELECT COUNT(*) as count FROM invoices");
  
  console.log(`👥 Clients: ${userCount.count}`);
  console.log(`📂 Projets: ${projectCount.count}`);
  console.log(`🎫 Tickets: ${ticketCount.count}`);
  console.log(`💬 Commentaires: ${commentCount.count}`);
  console.log(`🧾 Factures: ${invoiceCount.count}`);
  
  console.log('\n🔑 ACCÈS TEST:');
  console.log('Admin: admin@agency.local / [mot de passe configuré]');
  console.log('Clients: jean.dupont@entreprise.com / client123');
  console.log('         marie.martin@innovcorp.fr / client123');
  console.log('         p.bernard@digitalex.com / client123');
  console.log('         sophie.moreau@webcraft.fr / client123');
}

// Exécuter le script
if (require.main === module) {
  populateTestData().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { populateTestData };