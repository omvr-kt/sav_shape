const { db } = require('../utils/database');

class Ticket {
  static async create(ticketData) {
    const { title, description, priority, client_id, project_id } = ticketData;
    
    const slaDeadline = await this.calculateSLADeadline(client_id, priority);
    
    const result = await db.run(`
      INSERT INTO tickets (title, description, priority, client_id, project_id, sla_deadline)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, description, priority, client_id, project_id, slaDeadline]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        t.*,
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
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company,
        p.name as project_name,
        assigned.first_name as assigned_first_name,
        assigned.last_name as assigned_last_name,
        CASE 
          WHEN t.sla_deadline < datetime('now') AND t.status NOT IN ('resolved', 'closed') 
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
    
    return await db.all(query, params);
  }

  static async update(id, updates) {
    const allowedFields = ['title', 'description', 'priority', 'status', 'assigned_to'];
    const fieldsToUpdate = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fieldsToUpdate.length === 0) {
      throw new Error('No valid fields to update');
    }

    if (updates.status === 'closed' || updates.status === 'resolved') {
      fieldsToUpdate.push('closed_at = ?');
      values.push(new Date().toISOString());
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

  static async calculateSLADeadline(client_id, priority) {
    const slaRule = await db.get(`
      SELECT response_time_hours 
      FROM sla_rules 
      WHERE client_id = ? AND priority = ?
    `, [client_id, priority]);

    let hours = 24;
    if (slaRule) {
      hours = slaRule.response_time_hours;
    } else {
      switch (priority) {
        case 'urgent': hours = 2; break;
        case 'high': hours = 8; break;
        case 'normal': hours = 24; break;
        case 'low': hours = 72; break;
      }
    }

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    return deadline.toISOString();
  }

  static async getOverdueTickets() {
    return await db.all(`
      SELECT 
        t.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company,
        p.name as project_name
      FROM tickets t
      LEFT JOIN users u ON t.client_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.sla_deadline < datetime('now') 
        AND t.status NOT IN ('resolved', 'closed')
      ORDER BY t.sla_deadline ASC
    `);
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
        COUNT(CASE WHEN sla_deadline < datetime('now') AND status NOT IN ('resolved', 'closed') THEN 1 END) as overdue
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