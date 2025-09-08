#!/usr/bin/env node

/**
 * Script de test pour vérifier toutes les notifications
 * Usage: node test-notifications.js
 */

require('dotenv').config();
const emailService = require('./src/services/email');
const { templates } = require('./src/config/email-templates');

// Données de test simulées
const mockData = {
  client: {
    id: 1,
    first_name: 'Jean',
    last_name: 'Dupont',
    email: 'client@example.com',
    company: 'Entreprise ABC',
    phone: '01 23 45 67 89'
  },
  
  ticket: {
    id: 123,
    title: 'Problème de connexion à l\'application',
    description: 'Je ne parviens pas à me connecter à l\'application depuis ce matin.\nJ\'ai essayé de réinitialiser mon mot de passe mais cela ne fonctionne toujours pas.\nPouvez-vous m\'aider rapidement svp?',
    priority: 'urgent',
    status: 'open',
    created_at: new Date().toISOString(),
    sla_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    client_id: 1,
    project_id: 1
  },
  
  project: {
    id: 1,
    name: 'Application Web E-commerce',
    client_id: 1
  },
  
  comment: {
    id: 456,
    content: 'J\'ai toujours le même problème de connexion.\nVoici le message d\'erreur que j\'obtiens:\n"Invalid credentials - Error 401"\nMerci de votre aide.',
    created_at: new Date().toISOString(),
    user_id: 1,
    ticket_id: 123
  },
  
  teamMember: {
    id: 2,
    first_name: 'Marie',
    last_name: 'Martin',
    email: 'marie@shape-conseil.fr',
    role: 'team'
  },
  
  invoice: {
    id: 789,
    invoice_number: 'FAC-2025-001',
    issue_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    subtotal: 1500.00,
    tax_rate: 20,
    tax_amount: 300.00,
    total: 1800.00,
    status: 'sent',
    description: 'Développement de nouvelles fonctionnalités - Sprint 12'
  }
};

async function testAllNotifications() {
  console.log('===================================');
  console.log('Test de toutes les notifications');
  console.log('===================================\n');
  
  const tests = [
    {
      name: '1. Notification Omar - Nouveau ticket client',
      description: 'Email envoyé à Omar quand un client crée un ticket',
      recipient: process.env.ADMIN_NOTIFICATION_EMAIL || 'omar@shape-conseil.fr',
      subject: `[URGENT] Nouveau ticket #${mockData.ticket.id} - ${mockData.ticket.title}`,
      template: () => templates.newTicketForOmar(mockData.ticket, mockData.client, mockData.project)
    },
    {
      name: '2. Notification Omar - Nouveau commentaire client',
      description: 'Email envoyé à Omar quand un client ajoute un commentaire',
      recipient: process.env.ADMIN_NOTIFICATION_EMAIL || 'omar@shape-conseil.fr',
      subject: `Nouveau commentaire client - Ticket #${mockData.ticket.id}`,
      template: () => templates.newCommentForOmar(mockData.comment, mockData.ticket, mockData.client, mockData.project)
    },
    {
      name: '3. Notification Client - Changement de statut',
      description: 'Email envoyé au client quand le statut de son ticket change',
      recipient: mockData.client.email,
      subject: `Ticket #${mockData.ticket.id} - Changement de statut`,
      template: () => templates.statusChangeForClient(mockData.ticket, 'open', 'in_progress', mockData.client, mockData.project)
    },
    {
      name: '4. Notification Client - Nouveau commentaire team',
      description: 'Email envoyé au client quand la team ajoute un commentaire',
      recipient: mockData.client.email,
      subject: `Nouvelle réponse sur votre ticket #${mockData.ticket.id}`,
      template: () => {
        const teamComment = {
          ...mockData.comment,
          content: 'Bonjour,\n\nNous avons identifié le problème. Il s\'agit d\'un bug au niveau de l\'authentification.\nNous travaillons sur une correction qui sera déployée dans l\'heure.\n\nCordialement,\nL\'équipe support',
          user_id: mockData.teamMember.id
        };
        return templates.newCommentForClient(teamComment, mockData.ticket, mockData.teamMember, mockData.client, mockData.project);
      }
    },
    {
      name: '5. Notification Client - Nouvelle facture',
      description: 'Email envoyé au client quand une nouvelle facture est créée',
      recipient: mockData.client.email,
      subject: `Nouvelle facture ${mockData.invoice.invoice_number} - Shape Conseil`,
      template: () => templates.newInvoiceForClient(mockData.invoice, mockData.client)
    }
  ];
  
  // Demander confirmation avant d'envoyer
  console.log('📧 Notifications à tester:\n');
  tests.forEach((test, index) => {
    console.log(`${test.name}`);
    console.log(`   ${test.description}`);
    console.log(`   Destinataire: ${test.recipient}`);
    console.log(`   Sujet: ${test.subject}\n`);
  });
  
  console.log('⚠️  ATTENTION: Ce script va envoyer des emails RÉELS aux adresses ci-dessus.');
  console.log('Appuyez sur Ctrl+C pour annuler ou attendez 5 secondes pour continuer...\n');
  
  // Attendre 5 secondes
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Envoyer les notifications une par une
  for (const test of tests) {
    console.log(`\n📨 Envoi: ${test.name}`);
    console.log(`   Destinataire: ${test.recipient}`);
    
    try {
      const html = test.template();
      
      const result = await emailService.sendMail({
        from: process.env.SMTP_FROM || 'dev@shape-conseil.fr',
        to: test.recipient,
        subject: test.subject,
        html: html
      });
      
      console.log(`   ✅ Succès! Message ID: ${result.messageId}`);
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
    }
    
    // Attendre 2 secondes entre chaque envoi
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n===================================');
  console.log('Test terminé!');
  console.log('Vérifiez les boîtes de réception.');
  console.log('===================================\n');
}

// Mode aperçu - génère les HTML sans envoyer
async function previewTemplates() {
  console.log('===================================');
  console.log('Aperçu des templates (sans envoi)');
  console.log('===================================\n');
  
  const fs = require('fs');
  const path = require('path');
  const previewDir = path.join(__dirname, 'email-previews');
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir);
  }
  
  const previews = [
    {
      filename: '1-omar-nouveau-ticket.html',
      template: () => templates.newTicketForOmar(mockData.ticket, mockData.client, mockData.project)
    },
    {
      filename: '2-omar-nouveau-commentaire.html',
      template: () => templates.newCommentForOmar(mockData.comment, mockData.ticket, mockData.client, mockData.project)
    },
    {
      filename: '3-client-changement-statut.html',
      template: () => templates.statusChangeForClient(mockData.ticket, 'open', 'in_progress', mockData.client, mockData.project)
    },
    {
      filename: '4-client-commentaire-team.html',
      template: () => {
        const teamComment = {
          ...mockData.comment,
          content: 'Bonjour,\n\nNous avons identifié le problème. Il s\'agit d\'un bug au niveau de l\'authentification.\nNous travaillons sur une correction qui sera déployée dans l\'heure.\n\nCordialement,\nL\'équipe support',
          user_id: mockData.teamMember.id
        };
        return templates.newCommentForClient(teamComment, mockData.ticket, mockData.teamMember, mockData.client, mockData.project);
      }
    },
    {
      filename: '5-client-nouvelle-facture.html',
      template: () => templates.newInvoiceForClient(mockData.invoice, mockData.client)
    }
  ];
  
  previews.forEach(preview => {
    const filePath = path.join(previewDir, preview.filename);
    const html = preview.template();
    fs.writeFileSync(filePath, html);
    console.log(`✅ Généré: ${preview.filename}`);
  });
  
  console.log(`\n📁 Fichiers HTML générés dans: ${previewDir}`);
  console.log('Ouvrez ces fichiers dans un navigateur pour voir le rendu.\n');
}

// Lancer le script
const args = process.argv.slice(2);

if (args[0] === '--preview') {
  // Mode aperçu sans envoi
  previewTemplates().catch(console.error);
} else {
  // Mode envoi réel
  console.log('💡 Astuce: Utilisez "node test-notifications.js --preview" pour générer les HTML sans envoyer d\'emails\n');
  testAllNotifications().catch(console.error);
}