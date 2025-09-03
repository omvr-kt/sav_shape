const { db } = require('../utils/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, password, role, first_name, last_name, company, phone } = userData;
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const result = await db.run(`
      INSERT INTO users (email, password_hash, role, first_name, last_name, company, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [email, hashedPassword, role, first_name, last_name, company, phone]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  static async findByEmail(email) {
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async findAll(filters = {}) {
    let query = 'SELECT id, email, role, first_name, last_name, company, phone, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    query += ' ORDER BY created_at DESC';
    
    return await db.all(query, params);
  }

  static async update(id, updates) {
    const allowedFields = ['first_name', 'last_name', 'company', 'is_active', 'confidential_file'];
    const fieldsToUpdate = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'confidential_file') {
          const encryptionService = require('../services/encryptionService');
          const { encrypted, iv } = encryptionService.encrypt(updates[key]);
          fieldsToUpdate.push(`${key} = ?`);
          values.push(`${encrypted}:${iv}`);
        } else {
          fieldsToUpdate.push(`${key} = ?`);
          values.push(updates[key]);
        }
      }
    });

    if (fieldsToUpdate.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(new Date().toISOString());
    values.push(id);

    await db.run(`
      UPDATE users 
      SET ${fieldsToUpdate.join(', ')}, updated_at = ?
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await db.run(`
      UPDATE users 
      SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `, [hashedPassword, new Date().toISOString(), id]);

    return true;
  }

  static async validatePassword(user, password) {
    return await bcrypt.compare(password, user.password_hash);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async getClientsWithProjects() {
    return await db.all(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.company,
        u.created_at,
        COUNT(p.id) as project_count,
        COUNT(t.id) as ticket_count
      FROM users u
      LEFT JOIN projects p ON u.id = p.client_id
      LEFT JOIN tickets t ON u.id = t.client_id
      WHERE u.role = 'client' AND u.is_active = 1
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
  }
}

module.exports = User;