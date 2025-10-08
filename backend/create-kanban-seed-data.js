const { db, initDatabase } = require('./src/utils/database');

async function createKanbanSeedData() {
  try {
    await initDatabase();
    
    console.log('Création des données de test Kanban...');
    
    // Créer quelques tâches de test pour le projet "Site Web E-commerce" (id: 1)
    const tasks = [
      {
        project_id: 1,
        title: 'Configurer l\'environnement de développement',
        description: 'Installer Node.js, MongoDB, et configurer les variables d\'environnement',
        urgency: 'high',
        status: 'done',
        created_by: 2
      },
      {
        project_id: 1,
        title: 'Créer l\'API des produits',
        description: 'Endpoints CRUD pour la gestion des produits avec validation',
        urgency: 'urgent',
        status: 'in_progress',
        created_by: 2
      },
      {
        project_id: 1,
        title: 'Interface d\'administration des commandes',
        description: 'Page admin pour visualiser et gérer les commandes clients',
        urgency: 'medium',
        status: 'todo_front',
        created_by: 2
      },
      {
        project_id: 1,
        title: 'Intégration paiement Stripe',
        description: 'Configurer Stripe pour les paiements en ligne sécurisés',
        urgency: 'high',
        status: 'ready_for_review',
        created_by: 2
      },
      {
        project_id: 1,
        title: 'Tests unitaires API',
        description: 'Couvrir les endpoints principaux avec des tests Jest',
        urgency: 'medium',
        status: 'todo_back',
        created_by: 2
      }
    ];
    
    // Tâches pour le projet "API REST" (id: 9)
    const apiTasks = [
      {
        project_id: 9,
        title: 'Documentation API avec Swagger',
        description: 'Documenter tous les endpoints avec Swagger/OpenAPI',
        urgency: 'medium',
        status: 'todo_back',
        created_by: 2
      },
      {
        project_id: 9,
        title: 'Authentification JWT',
        description: 'Implémenter un système d\'auth JWT sécurisé',
        urgency: 'urgent',
        status: 'in_progress',
        created_by: 2
      }
    ];
    
    const allTasks = [...tasks, ...apiTasks];
    
    for (const task of allTasks) {
      // Calculer due_at basé sur l'urgence
      const now = new Date();
      let hoursToAdd;
      switch (task.urgency) {
        case 'urgent': hoursToAdd = 24; break;
        case 'high': hoursToAdd = 48; break;
        case 'medium': hoursToAdd = 72; break;
        case 'low': hoursToAdd = 96; break;
        default: hoursToAdd = 72;
      }
      
      const dueAt = new Date(now.getTime() + (hoursToAdd * 60 * 60 * 1000));
      
      await db.run(`
        INSERT INTO tasks (project_id, title, description, urgency, status, start_at, due_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        task.project_id,
        task.title,
        task.description,
        task.urgency,
        task.status,
        now.toISOString(),
        dueAt.toISOString(),
        task.created_by,
        task.created_by
      ]);
    }
    
    console.log(`✅ ${allTasks.length} tâches créées avec succès!`);
    
    // Vérifier les tâches créées
    const createdTasks = await db.all(`
      SELECT t.id, t.title, t.status, t.urgency, p.name as project_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    
    console.log('\\nTâches créées:');
    createdTasks.forEach(task => {
      console.log(`- [${task.status}] ${task.title} (${task.urgency}) - ${task.project_name}`);
    });
    
    await db.close();
    
  } catch (error) {
    console.error('Erreur lors de la création des données de test:', error);
    process.exit(1);
  }
}

createKanbanSeedData();