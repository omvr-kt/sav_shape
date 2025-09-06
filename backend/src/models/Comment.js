const { db } = require('../utils/database');

class Comment {
  static async create(commentData) {
    const { ticket_id, user_id, content, is_internal = false } = commentData;
    
    const result = await db.run(`
      INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal)
      VALUES (?, ?, ?, ?)
    `, [ticket_id, user_id, content, is_internal]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.role
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [id]);
  }

  static async findByTicketId(ticket_id, includeInternal = false) {
    let query = `
      SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.role
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ?
    `;

    if (!includeInternal) {
      query += ' AND c.is_internal = 0';
    }

    query += ' ORDER BY c.created_at ASC';

    return await db.all(query, [ticket_id]);
  }

  static async update(id, updates) {
    const allowedFields = ['content'];
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
      UPDATE ticket_comments 
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM ticket_comments WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async getCommentCount(ticket_id, includeInternal = false) {
    let query = 'SELECT COUNT(*) as count FROM ticket_comments WHERE ticket_id = ?';
    if (!includeInternal) {
      query += ' AND is_internal = 0';
    }
    
    const result = await db.get(query, [ticket_id]);
    return result.count;
  }
}

module.exports = Comment;