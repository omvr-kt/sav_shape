const { db } = require('../utils/database');
const businessHours = require('../utils/business-hours');

class Ticket {
  static async create(ticketData) {
    const { title, description, priority, client_id, project_id } = ticketData;
    
    console.log('Ticket.create() - Données reçues:', { title, description, priority, client_id, project_id });
    
    // Générer le numéro de ticket incrémental pour ce projet
    let ticketNumber = 1;
    try {
      // Récupérer le compteur pour ce projet
      const counterKey = `project_${project_id}`;
      let counter = await db.get(
        "SELECT counter_value FROM counters WHERE counter_type = 'ticket' AND counter_key = ?",
        [counterKey]
      );
      
      if (counter) {
        ticketNumber = counter.counter_value + 1;
        // Mettre à jour le compteur
        await db.run(
          "UPDATE counters SET counter_value = ?, updated_at = datetime('now', 'localtime') WHERE counter_type = 'ticket' AND counter_key = ?",
          [ticketNumber, counterKey]
        );
      } else {
        // Créer le compteur s'il n'existe pas (commence à 1)
        await db.run(
          "INSERT INTO counters (counter_type, counter_key, counter_value) VALUES ('ticket', ?, 1)",
          [counterKey]
        );
      }
    } catch (error) {
      console.error('Erreur génération numéro ticket:', error);
      // Fallback: utiliser l'ID auto-incrémenté
    }
    
    const slaDeadline = await this.calculateSLADeadline(client_id, priority);
    console.log('Ticket.create() - SLA deadline calculée:', slaDeadline);
    
    console.log('Ticket.create() - Exécution INSERT avec ticket_number:', ticketNumber);
    const result = await db.run(`
      INSERT INTO tickets (ticket_number, title, description, priority, client_id, project_id, sla_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [ticketNumber, title, description, priority, client_id, project_id, slaDeadline]);
    
    console.log('Ticket.create() - Résultat INSERT:', result);
    
    const newTicket = await this.findById(result.id);
    console.log('Ticket.create() - Ticket créé:', newTicket);
    
    return newTicket;
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        t.*,
        t.ticket_number,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.email as client_email,
        u.company as client_company,
        p.name as project_name,
        assigned.first_name as assigned_first_name,
        assigned.last_name as assigned_last_name
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      WHERE t.id = ?
    `, [id]);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT 
        t.*,
        t.ticket_number,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company,
        p.name as project_name,
        assigned.first_name as assigned_first_name,
        assigned.last_name as assigned_last_name,
        CASE 
          WHEN t.sla_deadline < datetime('now', 'localtime') AND t.status NOT IN ('resolved', 'closed') 
          THEN 1 ELSE 0 
        END as is_overdue
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.client_id) {
      query += ' AND t.client_id = ?';
      params.push(filters.client_id);
    }

    if (filters.project_id) {
      query += ' AND t.project_id = ?';
      params.push(filters.project_id);
    }

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters.exclude_status) {
      // Support single status or array of statuses to exclude
      const excluded = Array.isArray(filters.exclude_status) ? filters.exclude_status : [filters.exclude_status];
      const placeholders = excluded.map(() => '?').join(',');
      query += ` AND t.status NOT IN (${placeholders})`;
      params.push(...excluded);
    }

    if (filters.priority) {
      query += ' AND t.priority = ?';
      params.push(filters.priority);
    }

    if (filters.assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(filters.assigned_to);
    }

    if (filters.overdue_only) {
      query += ' AND t.sla_deadline < datetime(\'now\') AND t.status NOT IN (\'resolved\', \'closed\')';
    }

    query += ' ORDER BY t.created_at DESC';
    
    const tickets = await db.all(query, params);
    
    // Recalculer is_overdue selon les horaires de bureau
    return tickets.map(ticket => {
      if (ticket.sla_deadline && ticket.status !== 'resolved' && ticket.status !== 'closed') {
        const deadline = new Date(ticket.sla_deadline);
        ticket.is_overdue = businessHours.isSLAOverdue(deadline) ? 1 : 0;
      }
      return ticket;
    });
  }

  static async update(id, updates) {
    const allowedFields = ['title', 'description', 'priority', 'status', 'assigned_to'];
    const fieldsToUpdate = [];
    const values = [];

    // Get current ticket data for SLA calculations
    const currentTicket = await this.findById(id);
    if (!currentTicket) {
      throw new Error('Ticket not found');
    }

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fieldsToUpdate.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Handle status changes and SLA adjustments
    if (updates.status && updates.status !== currentTicket.status) {
      await this.handleStatusChange(currentTicket, updates.status, fieldsToUpdate, values);
    }

    // Handle priority changes and recalculate SLA if needed
    if (updates.priority && updates.priority !== currentTicket.priority && 
        currentTicket.status !== 'closed' && currentTicket.status !== 'resolved') {
      const newDeadline = await this.recalculateSLAForStatusChange(currentTicket, updates.status || currentTicket.status, updates.priority);
      fieldsToUpdate.push('sla_deadline = ?');
      values.push(newDeadline);
    }

    values.push(new Date().toISOString());
    values.push(id);

    await db.run(`
      UPDATE tickets 
      SET ${fieldsToUpdate.join(', ')}, updated_at = ?
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  static async handleStatusChange(currentTicket, newStatus, fieldsToUpdate, values) {
    const now = new Date().toISOString();

    // Set closed_at when ticket is resolved or closed
    if (newStatus === 'closed' || newStatus === 'resolved') {
      fieldsToUpdate.push('closed_at = ?');
      values.push(now);
      return;
    }

    // Reset closed_at if ticket is reopened
    if ((currentTicket.status === 'closed' || currentTicket.status === 'resolved') &&
        (newStatus === 'open' || newStatus === 'in_progress')) {
      fieldsToUpdate.push('closed_at = NULL');
    }

    // Handle SLA suspension and resumption
    const oldStatus = currentTicket.status;
    
    // If moving to waiting_client, suspend SLA (store time spent)
    if (newStatus === 'waiting_client' && oldStatus !== 'waiting_client') {
      const timeSpent = this.calculateTimeSpent(currentTicket.created_at, currentTicket.sla_paused_at);
      fieldsToUpdate.push('sla_paused_at = ?', 'sla_time_spent = ?');
      values.push(now, timeSpent);
    }
    
    // If resuming from waiting_client, recalculate SLA deadline
    else if (oldStatus === 'waiting_client' && 
             (newStatus === 'open' || newStatus === 'in_progress')) {
      const newDeadline = await this.recalculateSLAForStatusChange(currentTicket, newStatus);
      fieldsToUpdate.push('sla_deadline = ?', 'sla_paused_at = NULL');
      values.push(newDeadline);
    }
  }

  static calculateTimeSpent(createdAt, pausedAt) {
    const start = new Date(createdAt);
    const end = pausedAt ? new Date(pausedAt) : new Date();
    return Math.floor((end - start) / (1000 * 60 * 60)); // Hours spent
  }

  static async recalculateSLAForStatusChange(ticket, newStatus, newPriority = null) {
    // Don't recalculate for closed/resolved tickets
    if (newStatus === 'closed' || newStatus === 'resolved') {
      return ticket.sla_deadline;
    }

    const priority = newPriority || ticket.priority;
    const timeSpent = ticket.sla_time_spent || 0;
    
    // Get total SLA time for this ticket
    const slaRule = await db.get(`
      SELECT response_time_hours 
      FROM sla_rules 
      WHERE client_id = ? AND priority = ?
    `, [ticket.client_id, priority]);

    let totalSLAHours = 24;
    if (slaRule) {
      totalSLAHours = slaRule.response_time_hours;
    } else {
      switch (priority) {
        case 'urgent': totalSLAHours = 2; break;
        case 'high': totalSLAHours = 8; break;
        case 'normal': totalSLAHours = 24; break;
        case 'low': totalSLAHours = 72; break;
      }
    }

    // Calculate remaining SLA time
    const remainingHours = Math.max(0, totalSLAHours - timeSpent);
    
    // Calculate new deadline from now
    const deadline = businessHours.calculateSLADeadline(remainingHours);
    return deadline.toISOString();
  }

  static async calculateSLADeadline(client_id, priority) {
    const slaRule = await db.get(`
      SELECT response_time_hours 
      FROM sla_rules 
      WHERE client_id = ? AND priority = ?
    `, [client_id, priority]);

    let hours = 8;
    if (slaRule) {
      hours = slaRule.response_time_hours;
    } else {
      switch (priority) {
        case 'urgent': hours = 2; break;
        case 'high': hours = 4; break;
        case 'normal': hours = 8; break;
        case 'low': hours = 8; break;
      }
    }

    // Calculer la deadline en respectant les horaires de bureau (9h-18h, lun-ven)
    const deadline = businessHours.calculateSLADeadline(hours);
    return deadline.toISOString();
  }

  static async getOverdueTickets() {
    const allTickets = await db.all(`
      SELECT 
        t.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company,
        p.name as project_name
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.sla_deadline IS NOT NULL
        AND t.status NOT IN ('resolved', 'closed', 'waiting_client')
      ORDER BY t.sla_deadline ASC
    `);
    
    // Filtrer selon les horaires de bureau
    return allTickets.filter(ticket => {
      const deadline = new Date(ticket.sla_deadline);
      return businessHours.isSLAOverdue(deadline);
    });
  }

  static async getTicketStats() {
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'waiting_client' THEN 1 END) as waiting_client,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
        COUNT(CASE WHEN sla_deadline < datetime('now', 'localtime') AND status NOT IN ('resolved', 'closed') THEN 1 END) as overdue
      FROM tickets
    `);

    return stats;
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM tickets WHERE id = ?', [id]);
    return result.changes > 0;
  }
}

module.exports = Ticket;
