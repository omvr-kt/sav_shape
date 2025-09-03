const nodemailer = require('nodemailer');
const { formatParisDate } = require('../utils/timezone');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'demo@ethereal.email',
        pass: process.env.SMTP_PASS || 'demo_password'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendMail(mailOptions) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email envoyé (mode dev):', {
          to: mailOptions.to,
          subject: mailOptions.subject
        });
        return { messageId: 'dev-mode-' + Date.now() };
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email envoyé:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

  async sendTicketNotification(ticket, user, type, extraData = {}) {
    const subject = this.getTicketSubject(ticket, type);
    const html = this.getTicketEmailTemplate(ticket, user, type, extraData);

    return this.sendMail({
      from: '"Équipe Support" <support@agency.local>',
      to: user.email,
      subject,
      html
    });
  }

  getTicketSubject(ticket, type) {
    const baseSubject = `[Ticket #${ticket.id}] ${ticket.title}`;
    
    switch (type) {
      case 'created':
        return `${baseSubject} - Nouveau ticket créé`;
      case 'updated':
        return `${baseSubject} - Ticket mis à jour`;
      case 'status_changed':
        return `${baseSubject} - Changement de statut`;
      case 'comment_added':
        return `${baseSubject} - Nouveau commentaire`;
      case 'assigned':
        return `${baseSubject} - Ticket assigné`;
      case 'sla_warning':
        return `⚠️ ${baseSubject} - SLA bientôt dépassé`;
      case 'sla_exceeded':
        return `🚨 ${baseSubject} - SLA dépassé`;
      default:
        return baseSubject;
    }
  }

  getTicketEmailTemplate(ticket, user, type, extraData = {}) {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 20px; }
            .ticket-info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
            .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .priority-urgent { background: #dc2626; color: white; }
            .priority-high { background: #d97706; color: white; }
            .priority-normal { background: #2563eb; color: white; }
            .priority-low { background: #6b7280; color: white; }
            .status-open { background: #2563eb; color: white; }
            .status-in_progress { background: #d97706; color: white; }
            .status-waiting_client { background: #6b7280; color: white; }
            .status-resolved { background: #059669; color: white; }
            .status-closed { background: #374151; color: white; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏢 Plateforme de Support</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${user.first_name},</h2>
              ${this.getNotificationContent(ticket, type, extraData)}
              
              <div class="ticket-info">
                <h3>📋 Informations du ticket</h3>
                <p><strong>Ticket #${ticket.id}:</strong> ${ticket.title}</p>
                <p><strong>Projet:</strong> ${ticket.project_name}</p>
                <p><strong>Description:</strong> ${ticket.description}</p>
                <p>
                  <span class="status-badge priority-${ticket.priority}">${this.formatPriority(ticket.priority)}</span>
                  <span class="status-badge status-${ticket.status}">${this.formatStatus(ticket.status)}</span>
                </p>
                <p><strong>Créé le:</strong> ${this.formatDate(ticket.created_at)}</p>
                ${ticket.sla_deadline ? `<p><strong>SLA:</strong> ${this.formatDate(ticket.sla_deadline)}</p>` : ''}
              </div>
              
              <a href="http://localhost:3000/client#tickets" class="btn">Voir le ticket</a>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement par notre système de support.</p>
              <p>Pour toute question, contactez notre équipe technique.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return baseTemplate;
  }

  getNotificationContent(ticket, type, extraData) {
    switch (type) {
      case 'created':
        return `<p>Votre ticket de support a été créé avec succès et sera traité dans les plus brefs délais.</p>`;
      
      case 'updated':
        return `<p>Votre ticket de support a été mis à jour.</p>`;
      
      case 'status_changed':
        return `<p>Le statut de votre ticket a été modifié : <strong>${this.formatStatus(ticket.status)}</strong></p>`;
      
      case 'comment_added':
        const comment = extraData.comment || {};
        return `
          <p>Un nouveau commentaire a été ajouté à votre ticket :</p>
          <div style="background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
            <p><strong>${comment.first_name} ${comment.last_name}</strong> - ${this.formatDate(comment.created_at)}</p>
            <p>${comment.content}</p>
          </div>
        `;
      
      case 'assigned':
        const assignee = extraData.assignee || {};
        return `<p>Votre ticket a été assigné à <strong>${assignee.first_name} ${assignee.last_name}</strong> qui va s'en occuper.</p>`;
      
      case 'sla_warning':
        return `<p>⚠️ <strong>Attention :</strong> Le délai de traitement de votre ticket expire bientôt (${this.formatDate(ticket.sla_deadline)}).</p>`;
      
      case 'sla_exceeded':
        return `<p>🚨 <strong>SLA dépassé :</strong> Le délai de traitement de votre ticket a été dépassé. Nous nous excusons pour ce retard et travaillons activement à sa résolution.</p>`;
      
      default:
        return `<p>Votre ticket a été mis à jour.</p>`;
    }
  }

  formatStatus(status) {
    const statusMap = {
      'open': 'Ouvert',
      'in_progress': 'En cours',
      'waiting_client': 'En attente de votre réponse',
      'resolved': 'Résolu',
      'closed': 'Fermé'
    };
    return statusMap[status] || status;
  }

  formatPriority(priority) {
    const priorityMap = {
      'urgent': 'Urgent',
      'high': 'Élevée',
      'normal': 'Normale',
      'low': 'Faible'
    };
    return priorityMap[priority] || priority;
  }

  formatDate(dateString) {
    return formatParisDate(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async sendWelcomeEmail(user, password) {
    const subject = 'Bienvenue sur notre plateforme de support';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 20px; }
            .credentials { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Bienvenue !</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${user.first_name},</h2>
              <p>Votre compte client a été créé avec succès sur notre plateforme de support.</p>
              
              <div class="credentials">
                <h3>🔑 Vos identifiants de connexion</h3>
                <p><strong>Email :</strong> ${user.email}</p>
                <p><strong>Mot de passe temporaire :</strong> ${password}</p>
                <p><em>⚠️ Pensez à changer votre mot de passe lors de votre première connexion.</em></p>
              </div>
              
              <p>Avec cette plateforme, vous pourrez :</p>
              <ul>
                <li>📋 Créer et suivre vos tickets de support</li>
                <li>📁 Consulter l'état de vos projets</li>
                <li>💬 Échanger avec notre équipe technique</li>
                <li>📎 Joindre des fichiers à vos demandes</li>
              </ul>
              
              <a href="http://localhost:3000/client" class="btn">Accéder à mon espace client</a>
            </div>
            <div class="footer">
              <p>Si vous avez des questions, n'hésitez pas à contacter notre équipe support.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendMail({
      from: '"Équipe Support" <support@agency.local>',
      to: user.email,
      subject,
      html
    });
  }
}

module.exports = new EmailService();