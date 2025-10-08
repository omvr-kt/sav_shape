#!/usr/bin/env node

const { initDatabase } = require('./src/utils/database');
const bcrypt = require('bcryptjs');

async function createDeveloperUser() {
  console.log('🧑‍💻 Création d\'un utilisateur développeur...');
  
  try {
    await initDatabase();
    
    // Importer db après initialisation
    const { db } = require('./src/utils/database');
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', ['dev@agency.local']);
    
    if (existingUser) {
      console.log('✅ Utilisateur développeur existe déjà');
      return;
    }

    // Créer l'utilisateur développeur
    const hashedPassword = await bcrypt.hash('dev123', 12);
    
    const result = await db.run(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, company, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'dev@agency.local',
      hashedPassword,
      'developer',
      'Développeur',
      'Test',
      'Agence Shape',
      1
    ]);

    const devUserId = result.id;
    console.log(`✅ Utilisateur développeur créé avec l'ID: ${devUserId}`);

    // Assigner le développeur à quelques projets existants
    const projects = await db.all('SELECT id FROM projects LIMIT 3');
    
    for (const project of projects) {
      await db.run(`
        INSERT INTO developer_projects (user_id, project_id)
        VALUES (?, ?)
      `, [devUserId, project.id]);
      console.log(`✅ Développeur assigné au projet ${project.id}`);
    }

    console.log('🎉 Utilisateur développeur créé et assigné aux projets !');
    console.log('🔑 Connexion: dev@agency.local / dev123');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du développeur:', error);
  }
}

createDeveloperUser();