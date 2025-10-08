#!/usr/bin/env node

const { initDatabase } = require('./src/utils/database');
const Task = require('./src/models/Task');

async function createTestTasks() {
  console.log('🧪 Création de tâches de test...');
  
  try {
    await initDatabase();
    const { db } = require('./src/utils/database');
    
    // Récupérer l'ID du développeur et des projets assignés
    const dev = await db.get('SELECT id FROM users WHERE email = ?', ['dev@agency.local']);
    if (!dev) {
      console.log('❌ Utilisateur développeur non trouvé');
      return;
    }
    
    const projects = await db.all(`
      SELECT p.id, p.name 
      FROM projects p
      INNER JOIN developer_projects dp ON p.id = dp.project_id
      WHERE dp.user_id = ?
    `, [dev.id]);
    
    if (projects.length === 0) {
      console.log('❌ Aucun projet assigné au développeur');
      return;
    }
    
    const project = projects[0]; // Prendre le premier projet
    console.log(`✅ Création de tâches pour le projet: ${project.name}`);
    
    // Tâches de test
    const testTasks = [
      {
        title: 'Corriger le bug d\'authentification',
        description: 'Le token JWT expire trop rapidement et cause des déconnexions inattendues',
        urgency: 'urgent',
        status: 'todo_back'
      },
      {
        title: 'Optimiser les requêtes de la page dashboard',
        description: 'Les requêtes SQL sont lentes et causent des timeouts',
        urgency: 'high',
        status: 'todo_back'
      },
      {
        title: 'Implémenter le système de notifications',
        description: 'Ajouter les notifications push pour les nouvelles tâches',
        urgency: 'medium',
        status: 'todo_front'
      },
      {
        title: 'Refactoriser le composant Kanban',
        description: 'Le code est devenu difficile à maintenir, besoin de refactoring',
        urgency: 'medium',
        status: 'in_progress'
      },
      {
        title: 'Ajouter les tests unitaires pour l\'API auth',
        description: 'Améliorer la couverture de tests pour l\'authentification',
        urgency: 'low',
        status: 'ready_for_review'
      },
      {
        title: 'Mise à jour de la documentation technique',
        description: 'Mettre à jour la documentation suite aux dernières modifications',
        urgency: 'low',
        status: 'done'
      }
    ];
    
    for (const taskData of testTasks) {
      const task = await Task.create({
        project_id: project.id,
        title: taskData.title,
        description: taskData.description,
        urgency: taskData.urgency,
        status: taskData.status,
        created_by: dev.id
      });
      
      console.log(`✅ Tâche créée: ${task.title} (${task.status})`);
    }
    
    console.log('🎉 Tâches de test créées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des tâches:', error);
  }
}

createTestTasks();