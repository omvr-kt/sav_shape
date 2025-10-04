const { db } = require('../utils/database');

class SLA {
  static async create(slaData) {
    const { client_id, priority, response_time_hours, resolution_time_hours } = slaData;
    
    const result = await db.run(`
      INSERT INTO sla_rules (client_id, priority, response_time_hours, resolution_time_hours)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(client_id, priority) DO UPDATE SET
        response_time_hours = excluded.response_time_hours,
        resolution_time_hours = excluded.resolution_time_hours
    `, [client_id, priority, response_time_hours, resolution_time_hours]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        s.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company
      FROM sla_rules s
      LEFT JOIN users u ON s.client_id = u.id
      WHERE s.id = ?
    `, [id]);
  }

  static async findByClient(client_id) {
    return await db.all(`
      SELECT * FROM sla_rules
      WHERE client_id = ?
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END
    `, [client_id]);
  }

  static async findAll() {
    return await db.all(`
      SELECT 
        s.*,
        u.first_name as client_first_name,
        u.last_name as client_last_name,
        u.company as client_company
      FROM sla_rules s
      LEFT JOIN users u ON s.client_id = u.id
      ORDER BY u.company, 
        CASE s.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END
    `);
  }

  static async update(id, updates) {
    const allowedFields = ['response_time_hours', 'resolution_time_hours'];
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

    values.push(id);

    await db.run(`
      UPDATE sla_rules 
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM sla_rules WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static getDefaultSLA(priority) {
    const defaults = {
      'urgent': { response_time_hours: 2, resolution_time_hours: 8 },
      'high': { response_time_hours: 4, resolution_time_hours: 16 },
      'normal': { response_time_hours: 8, resolution_time_hours: 32 },
      'low': { response_time_hours: 8, resolution_time_hours: 48 }
    };

    return defaults[priority] || defaults['normal'];
  }

  static async getSLAForTicket(client_id, priority) {
    const slaRule = await db.get(`
      SELECT response_time_hours, resolution_time_hours 
      FROM sla_rules 
      WHERE client_id = ? AND priority = ?
    `, [client_id, priority]);

    return slaRule || this.getDefaultSLA(priority);
  }

  static async createDefaultSLAs(client_id) {
    const priorities = ['urgent', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      const defaultSLA = this.getDefaultSLA(priority);
      await this.create({
        client_id,
        priority,
        response_time_hours: defaultSLA.response_time_hours,
        resolution_time_hours: defaultSLA.resolution_time_hours
      });
    }
  }
}

module.exports = SLA;