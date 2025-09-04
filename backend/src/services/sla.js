const Ticket = require('../models/Ticket');
const User = require('../models/User');
const emailService = require('./email');
const businessHours = require('../utils/business-hours');

class SLAService {
  constructor() {
    this.checkInterval = 15 * 60 * 1000; // Check every 15 minutes
    this.warningThreshold = 2 * 60 * 60 * 1000; // Warn 2 hours before deadline
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Service SLA démarré');
    
    // Run immediately then at intervals
    this.checkSLAs();
    this.intervalId = setInterval(() => {
      this.checkSLAs();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Service SLA arrêté');
  }

  async checkSLAs() {
    try {
      console.log('Vérification des SLAs...');
      
      // Ne vérifier les SLA que pendant les horaires de bureau
      const now = new Date();
      if (!businessHours.isBusinessTime(now)) {
        console.log('Hors horaires de bureau - vérification SLA suspendue');
        return;
      }

      const warningTime = new Date(now.getTime() + this.warningThreshold);

      // Get tickets that need attention
      const overdueTickets = await this.getOverdueTickets();
      const warningTickets = await this.getWarningTickets(warningTime);

      console.log(`SLA Check: ${overdueTickets.length} tickets en retard, ${warningTickets.length} tickets avec warning`);

      // Process overdue tickets
      for (const ticket of overdueTickets) {
        await this.handleOverdueTicket(ticket);
      }

      // Process warning tickets
      for (const ticket of warningTickets) {
        await this.handleWarningTicket(ticket);
      }

    } catch (error) {
      console.error('Erreur lors de la vérification SLA:', error);
    }
  }

  async getOverdueTickets() {
    const { db } = require('../utils/database');
    
    const allTickets = await db.all(`
      SELECT 
        t.*,
        u.email as client_email,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        p.name as project_name
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.sla_deadline IS NOT NULL
        AND t.status NOT IN ('resolved', 'closed')
        AND (t.sla_notified_overdue = 0 OR t.sla_notified_overdue IS NULL)
    `);
    
    // Filtrer selon les horaires de bureau
    return allTickets.filter(ticket => {
      const deadline = new Date(ticket.sla_deadline);
      return businessHours.isSLAOverdue(deadline);
    });
  }

  async getWarningTickets(warningTime) {
    const { db } = require('../utils/database');
    
    return await db.all(`
      SELECT 
        t.*,
        u.email as client_email,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        p.name as project_name
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.sla_deadline < ? 
        AND t.sla_deadline > datetime('now', 'localtime')
        AND t.status NOT IN ('resolved', 'closed')
        AND (t.sla_notified_warning = 0 OR t.sla_notified_warning IS NULL)
    `, [warningTime.toISOString()]);
  }

  async handleOverdueTicket(ticket) {
    try {
      console.log(`Ticket #${ticket.id} en retard SLA`);
      
      const client = {
        id: ticket.client_id,
        email: ticket.client_email,
        first_name: ticket.client_first_name,
        last_name: ticket.client_last_name
      };

      // Send notification to client
      await emailService.sendTicketNotification(ticket, client, 'sla_exceeded');

      // Mark as notified
      await this.markSLANotified(ticket.id, 'overdue');

      // Notify internal team
      await this.notifyInternalTeam(ticket, 'overdue');

    } catch (error) {
      console.error(`Erreur handling overdue ticket #${ticket.id}:`, error);
    }
  }

  async handleWarningTicket(ticket) {
    try {
      console.log(`Ticket #${ticket.id} warning SLA`);
      
      const client = {
        id: ticket.client_id,
        email: ticket.client_email,
        first_name: ticket.client_first_name,
        last_name: ticket.client_last_name
      };

      // Send notification to client
      await emailService.sendTicketNotification(ticket, client, 'sla_warning');

      // Mark as notified
      await this.markSLANotified(ticket.id, 'warning');

      // Notify internal team
      await this.notifyInternalTeam(ticket, 'warning');

    } catch (error) {
      console.error(`Erreur handling warning ticket #${ticket.id}:`, error);
    }
  }

  async markSLANotified(ticketId, type) {
    const { db } = require('../utils/database');
    const field = type === 'overdue' ? 'sla_notified_overdue' : 'sla_notified_warning';
    
    await db.run(`UPDATE tickets SET ${field} = 1 WHERE id = ?`, [ticketId]);
  }

  async notifyInternalTeam(ticket, type) {
    try {
      const { db } = require('../utils/database');
      
      // Get all team members and admins
      const teamMembers = await db.all(`
        SELECT email, first_name, last_name 
        FROM users 
        WHERE role IN ('admin', 'team') AND is_active = 1
      `);

      const subject = type === 'overdue' 
        ? `SLA DÉPASSÉ - Ticket #${ticket.id}`
        : `SLA WARNING - Ticket #${ticket.id}`;

      for (const member of teamMembers) {
        await emailService.sendMail({
          from: '"Système SLA" <sla@agency.local>',
          to: member.email,
          subject,
          html: this.getInternalNotificationTemplate(ticket, member, type)
        });
      }

    } catch (error) {
      console.error('Erreur notification équipe interne:', error);
    }
  }

  getInternalNotificationTemplate(ticket, member, type) {
    const isOverdue = type === 'overdue';
    const icon = isOverdue ? 'URGENT' : 'ATTENTION';
    const title = isOverdue ? 'SLA DÉPASSÉ' : 'SLA BIENTÔT DÉPASSÉ';
    const urgencyClass = isOverdue ? 'urgent' : 'warning';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${isOverdue ? '#dc2626' : '#d97706'}; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 20px; }
            .ticket-info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid ${isOverdue ? '#dc2626' : '#d97706'}; }
            .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>[${icon}] ${title}</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${member.first_name},</h2>
              <p>${isOverdue ? 'Un ticket a dépassé son SLA' : 'Un ticket va bientôt dépasser son SLA'} et nécessite une attention immédiate.</p>
              
              <div class="ticket-info">
                <h3>Détails du ticket</h3>
                <p><strong>Ticket #${ticket.id}:</strong> ${ticket.title}</p>
                <p><strong>Client:</strong> ${ticket.client_first_name} ${ticket.client_last_name}</p>
                <p><strong>Projet:</strong> ${ticket.project_name}</p>
                <p><strong>Priorité:</strong> ${ticket.priority}</p>
                <p><strong>Statut:</strong> ${ticket.status}</p>
                <p><strong>SLA Deadline:</strong> ${emailService.formatDate(ticket.sla_deadline)}</p>
                <p><strong>Créé le:</strong> ${emailService.formatDate(ticket.created_at)}</p>
              </div>
              
              <a href="http://localhost:3000/admin#tickets" class="btn">Traiter le ticket</a>
            </div>
            <div class="footer">
              <p>Notification automatique du système SLA</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async getSLAStats() {
    const { db } = require('../utils/database');
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN sla_deadline < datetime('now', 'localtime') AND status NOT IN ('resolved', 'closed') THEN 1 END) as overdue_count,
        COUNT(CASE WHEN sla_deadline > datetime('now', 'localtime') AND sla_deadline < datetime('now', 'localtime', '+2 hours') AND status NOT IN ('resolved', 'closed') THEN 1 END) as warning_count,
        AVG(CASE WHEN status IN ('resolved', 'closed') 
          THEN (julianday(COALESCE(closed_at, updated_at)) - julianday(created_at)) * 24 
        END) as avg_resolution_hours,
        COUNT(CASE WHEN status IN ('resolved', 'closed') AND closed_at < sla_deadline THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as sla_compliance_rate
      FROM tickets
      WHERE sla_deadline IS NOT NULL
    `);

    return stats;
  }
}

module.exports = new SLAService();