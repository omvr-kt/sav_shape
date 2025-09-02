const { db } = require('../utils/database');

class Project {
  static async create(projectData) {
    const { name, description, client_id } = projectData;
    
    const result = await db.run(`
      INSERT INTO projects (name, description, client_id)
      VALUES (?, ?, ?)
    `, [name, description, client_id]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        p.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      WHERE p.id = ?
    `, [id]);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT 
        p.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as active_ticket_count
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      LEFT JOIN tickets t ON p.id = t.project_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.client_id) {
      query += ' AND p.client_id = ?';
      params.push(filters.client_id);
    }

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';
    
    return await db.all(query, params);
  }

  static async findByClientId(client_id) {
    return await db.all(`
      SELECT 
        p.*,
        COUNT(t.id) as ticket_count,
        COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as active_ticket_count
      FROM projects p
      LEFT JOIN tickets t ON p.id = t.project_id
      WHERE p.client_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [client_id]);
  }

  static async update(id, updates) {
    const allowedFields = ['name', 'description', 'status'];
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

    values.push(new Date().toISOString());
    values.push(id);

    await db.run(`
      UPDATE projects 
      SET ${fieldsToUpdate.join(', ')}, updated_at = ?
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM projects WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async getProjectStats(projectId) {
    return await db.get(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'waiting_client' THEN 1 END) as waiting_client_tickets,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tickets,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_tickets,
        AVG(CASE WHEN closed_at IS NOT NULL 
          THEN (julianday(closed_at) - julianday(created_at)) * 24 
          END) as avg_resolution_hours
      FROM tickets
      WHERE project_id = ?
    `, [projectId]);
  }
}

module.exports = Project;