/**
 * Templates d'email centralisés
 * Modifier ce fichier pour personnaliser tous les emails de l'application
 */

const templates = {
  // Template de base pour tous les emails
  base: {
    styles: `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb; }
      .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
      .header { background: #ffffff; color: #111827; padding: 24px; border-bottom: 1px solid #e5e7eb; }
      .header h1 { margin: 0; font-size: 20px; font-weight: 600; color: #111827; }
      .header p { margin: 5px 0 0 0; color: #6b7280; font-size: 14px; }
      .content { padding: 24px; }
      .content h2 { color: #111827; margin-top: 0; font-size: 18px; font-weight: 600; }
      .content p { margin: 12px 0; color: #374151; }
      .info-box { background: #f9fafb; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 3px solid #374151; }
      .info-box h3 { margin-top: 0; color: #111827; font-size: 14px; font-weight: 600; }
      .info-box p { margin: 8px 0; }
      .info-box table { width: 100%; margin-top: 8px; }
      .info-box td { padding: 6px 0; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; }
      .info-box td:first-child { font-weight: 500; width: 35%; color: #111827; }
      .info-box tr:last-child td { border-bottom: none; }
      .comment-box { background: #f9fafb; padding: 14px; border-radius: 6px; margin: 12px 0; border-left: 3px solid #6b7280; }
      .comment-author { font-weight: 600; color: #111827; margin-bottom: 4px; font-size: 14px; }
      .comment-date { color: #6b7280; font-size: 12px; }
      .comment-content { margin-top: 8px; color: #374151; white-space: pre-wrap; font-size: 14px; }
      .btn { display: inline-block; padding: 10px 20px; background: #374151; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 500; font-size: 14px; }
      .btn:hover { background: #1f2937; }
      .priority-urgent { background: #dc2626; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; }
      .priority-high { background: #ea580c; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; }
      .priority-normal { background: #1f2937; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; }
      .priority-low { background: #6b7280; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; }
      .status-badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; display: inline-block; margin-left: 8px; }
      .status-open { background: #1f2937; color: white; }
      .status-in_progress { background: #ea580c; color: white; }
      .status-waiting_client { background: #6b7280; color: white; }
      .status-resolved { background: #059669; color: white; }
      .status-closed { background: #374151; color: white; }
      .footer { background: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
      .footer p { margin: 4px 0; }
      .signature { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
      .signature p { margin: 4px 0; color: #6b7280; font-size: 14px; }
      .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 14px; }
      .success-box { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 14px; }
    `,
    wrapper: (content, headerTitle, headerSubtitle = '') => `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${templates.base.styles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${headerTitle}</h1>
              ${headerSubtitle ? `<p>${headerSubtitle}</p>` : ''}
            </div>
            ${content}
            <div class="footer">
              <p>Email automatique, ne pas répondre</p>
            </div>
          </div>
        </body>
      </html>
    `
  },

  // Template pour Omar - Nouveau ticket créé par un client
  newTicketForOmar: (ticket, client, project) => {
    const priorityClass = `priority-${ticket.priority}`;
    const priorityLabel = {
      urgent: 'URGENTE',
      high: 'ÉLEVÉE',
      normal: 'MOYENNE',
      medium: 'MOYENNE',
      low: 'FAIBLE'
    }[ticket.priority] || ticket.priority.toUpperCase();

    const content = `
      <div class="content">
        <h2>Nouveau ticket créé par un client</h2>
        
        ${ticket.priority === 'urgent' ? '<div class="alert-box">⚠️ <strong>Attention :</strong> Ce ticket est marqué comme URGENT</div>' : ''}
        
        <p>Un nouveau ticket vient d'être créé par <strong>${client.first_name} ${client.last_name}</strong>${client.company ? ` (${client.company})` : ''}.</p>
        
        <div class="info-box">
          <h3>Informations du ticket</h3>
          <table>
            <tr>
              <td>Ticket ID :</td>
              <td>#${ticket.id}</td>
            </tr>
            <tr>
              <td>Titre :</td>
              <td><strong>${ticket.title}</strong></td>
            </tr>
            <tr>
              <td>Projet :</td>
              <td>${project.name}</td>
            </tr>
            <tr>
              <td>Priorité :</td>
              <td><span class="${priorityClass}">${priorityLabel}</span></td>
            </tr>
            <tr>
              <td>Client :</td>
              <td>${client.first_name} ${client.last_name} - ${client.email}</td>
            </tr>
            ${client.phone ? `
            <tr>
              <td>Téléphone :</td>
              <td>${client.phone}</td>
            </tr>` : ''}
            <tr>
              <td>Date de création :</td>
              <td>${new Date(ticket.created_at).toLocaleString('fr-FR')}</td>
            </tr>
            ${ticket.sla_deadline ? `
            <tr>
              <td>SLA Deadline :</td>
              <td>${new Date(ticket.sla_deadline).toLocaleString('fr-FR')}</td>
            </tr>` : ''}
          </table>
        </div>

        <div class="info-box">
          <h3>Description du problème</h3>
          <p style="white-space: pre-wrap;">${ticket.description}</p>
        </div>

        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin#tickets" class="btn">Voir le ticket</a>

        <div class="signature">
          <p style="text-align: center; font-weight: 600; font-size: 16px; color: #111827;">Shape</p>
        </div>
      </div>
    `;

    return templates.base.wrapper(content, '🎫 Nouveau Ticket Client', `Ticket #${ticket.id} - ${ticket.title}`);
  },

  // Template pour Omar - Nouveau commentaire d'un client
  newCommentForOmar: (comment, ticket, client, project) => {
    const content = `
      <div class="content">
        <h2>Nouveau commentaire client</h2>
        
        <p><strong>${client.first_name} ${client.last_name}</strong> a ajouté un commentaire sur le ticket <strong>#${ticket.id}</strong>.</p>
        
        <div class="info-box">
          <h3>Informations du ticket</h3>
          <table>
            <tr>
              <td>Ticket :</td>
              <td>#${ticket.id} - ${ticket.title}</td>
            </tr>
            <tr>
              <td>Projet :</td>
              <td>${project.name}</td>
            </tr>
            <tr>
              <td>Statut actuel :</td>
              <td><span class="status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span></td>
            </tr>
            <tr>
              <td>Client :</td>
              <td>${client.first_name} ${client.last_name} - ${client.email}</td>
            </tr>
          </table>
        </div>

        <div class="comment-box">
          <div class="comment-author">${client.first_name} ${client.last_name}</div>
          <div class="comment-date">${new Date(comment.created_at).toLocaleString('fr-FR')}</div>
          <div class="comment-content">${comment.content}</div>
        </div>

        <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin#tickets" class="btn">Répondre au ticket</a>

        <div class="signature">
          <p style="text-align: center; font-weight: 600; font-size: 16px; color: #111827;">Shape</p>
        </div>
      </div>
    `;

    return templates.base.wrapper(content, '💬 Nouveau Commentaire Client', `Ticket #${ticket.id}`);
  },

  // Template pour le client - Changement de statut du ticket
  statusChangeForClient: (ticket, oldStatus, newStatus, client, project) => {
    const statusMessages = {
      'open': 'Votre ticket a été réouvert et sera traité dans les plus brefs délais.',
      'in_progress': 'Votre ticket est maintenant en cours de traitement par notre équipe.',
      'waiting_client': 'Nous attendons des informations supplémentaires de votre part pour continuer.',
      'resolved': 'Votre ticket a été résolu. Si le problème persiste, n\'hésitez pas à nous le signaler.',
      'closed': 'Votre ticket a été fermé. Vous pouvez créer un nouveau ticket si nécessaire.'
    };

    const content = `
      <div class="content">
        <h2>Bonjour ${client.first_name},</h2>
        
        <p>Le statut de votre ticket <strong>#${ticket.id}</strong> a été mis à jour.</p>
        
        <div class="info-box">
          <h3>Changement de statut</h3>
          <p>
            Ancien statut : <span class="status-badge status-${oldStatus}">${formatStatus(oldStatus)}</span>
            <br>
            Nouveau statut : <span class="status-badge status-${newStatus}">${formatStatus(newStatus)}</span>
          </p>
          <p>${statusMessages[newStatus] || 'Le statut de votre ticket a été mis à jour.'}</p>
        </div>

        <div class="info-box">
          <h3>Détails du ticket</h3>
          <table>
            <tr>
              <td>Ticket :</td>
              <td>#${ticket.id} - ${ticket.title}</td>
            </tr>
            <tr>
              <td>Projet :</td>
              <td>${project.name}</td>
            </tr>
            <tr>
              <td>Créé le :</td>
              <td>${new Date(ticket.created_at).toLocaleString('fr-FR')}</td>
            </tr>
          </table>
        </div>

        <a href="${process.env.APP_URL || 'http://localhost:3000'}/client#tickets" class="btn">Voir mon ticket</a>

        <div class="signature">
          <p style="text-align: center; font-weight: 600; font-size: 16px; color: #111827;">Shape</p>
        </div>
      </div>
    `;

    return templates.base.wrapper(content, '📋 Mise à jour de votre ticket', `Ticket #${ticket.id}`);
  },

  // Template pour le client - Nouveau commentaire de la team/admin
  newCommentForClient: (comment, ticket, author, client, project) => {
    const content = `
      <div class="content">
        <h2>Bonjour ${client.first_name},</h2>
        
        <p>Un nouveau message a été ajouté à votre ticket <strong>#${ticket.id}</strong>.</p>

        <div class="comment-box">
          <div class="comment-author">${author.first_name} ${author.last_name} - Équipe Support</div>
          <div class="comment-date">${new Date(comment.created_at).toLocaleString('fr-FR')}</div>
          <div class="comment-content">${comment.content}</div>
        </div>

        <div class="info-box">
          <h3>Informations du ticket</h3>
          <table>
            <tr>
              <td>Ticket :</td>
              <td>#${ticket.id} - ${ticket.title}</td>
            </tr>
            <tr>
              <td>Projet :</td>
              <td>${project.name}</td>
            </tr>
            <tr>
              <td>Statut :</td>
              <td><span class="status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span></td>
            </tr>
          </table>
        </div>

        ${ticket.status === 'waiting_client' ? 
          '<div class="alert-box">⏳ <strong>Action requise :</strong> Nous attendons votre réponse pour continuer le traitement de votre demande.</div>' : 
          ''}

        <a href="${process.env.APP_URL || 'http://localhost:3000'}/client#tickets" class="btn">Répondre</a>

        <div class="signature">
          <p style="text-align: center; font-weight: 600; font-size: 16px; color: #111827;">Shape</p>
        </div>
      </div>
    `;

    return templates.base.wrapper(content, '💬 Nouvelle réponse sur votre ticket', `Ticket #${ticket.id}`);
  },

  // Template pour le client - Nouvelle facture
  newInvoiceForClient: (invoice, client) => {
    const content = `
      <div class="content">
        <h2>Bonjour ${client.first_name},</h2>
        
        <p>Une nouvelle facture a été générée pour votre compte.</p>
        
        <div class="info-box">
          <h3>Détails de la facture</h3>
          <table>
            <tr>
              <td>Numéro de facture :</td>
              <td><strong>${invoice.invoice_number}</strong></td>
            </tr>
            <tr>
              <td>Date d'émission :</td>
              <td>${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}</td>
            </tr>
            <tr>
              <td>Date d'échéance :</td>
              <td><strong>${new Date(invoice.due_date).toLocaleDateString('fr-FR')}</strong></td>
            </tr>
            <tr>
              <td>Montant HT :</td>
              <td>${invoice.subtotal.toFixed(2)} €</td>
            </tr>
            <tr>
              <td>TVA (${invoice.tax_rate}%) :</td>
              <td>${invoice.tax_amount.toFixed(2)} €</td>
            </tr>
            <tr>
              <td><strong>Montant TTC :</strong></td>
              <td><strong>${invoice.total.toFixed(2)} €</strong></td>
            </tr>
            <tr>
              <td>Statut :</td>
              <td>${invoice.status === 'paid' ? '✅ Payée' : '⏳ En attente de paiement'}</td>
            </tr>
          </table>
        </div>

        ${invoice.description ? `
        <div class="info-box">
          <h3>Description</h3>
          <p>${invoice.description}</p>
        </div>
        ` : ''}

        <a href="${process.env.APP_URL || 'http://localhost:3000'}/client#invoices" class="btn">Voir la facture</a>

        ${invoice.status !== 'paid' ? `
        <div class="info-box">
          <h3>Informations de paiement</h3>
          <p>Pour régler cette facture, vous pouvez :</p>
          <ul>
            <li>Effectuer un virement bancaire avec la référence : <strong>${invoice.invoice_number}</strong></li>
            <li>Nous contacter pour convenir d'un autre mode de paiement</li>
          </ul>
        </div>
        ` : ''}

        <div class="signature">
          <p style="text-align: center; font-weight: 600; font-size: 16px; color: #111827;">Shape</p>
        </div>
      </div>
    `;

    return templates.base.wrapper(
      content, 
      '📄 Nouvelle facture disponible', 
      `Facture ${invoice.invoice_number}`
    );
  }
};

// Fonctions utilitaires
function formatStatus(status) {
  const statusMap = {
    'open': 'Ouvert',
    'in_progress': 'En cours',
    'waiting_client': 'En attente client',
    'resolved': 'Résolu',
    'closed': 'Fermé'
  };
  return statusMap[status] || status;
}

function formatPriority(priority) {
  const priorityMap = {
    'urgent': 'Urgente',
    'high': 'Élevée',
    'normal': 'Moyenne',
    'medium': 'Moyenne',
    'low': 'Faible'
  };
  return priorityMap[priority] || priority;
}

module.exports = { templates, formatStatus, formatPriority };
