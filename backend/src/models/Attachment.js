const { db } = require('../utils/database');
const fs = require('fs');
const path = require('path');

class Attachment {
  static async create(attachmentData) {
    const { 
      ticket_id, 
      comment_id, 
      filename, 
      original_filename, 
      file_path, 
      file_size, 
      mime_type, 
      uploaded_by 
    } = attachmentData;
    
    const result = await db.run(`
      INSERT INTO ticket_attachments (
        ticket_id, comment_id, filename, original_filename, 
        file_path, file_size, mime_type, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticket_id, 
      comment_id, 
      filename, 
      original_filename, 
      file_path, 
      file_size, 
      mime_type, 
      uploaded_by
    ]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        a.*,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.id = ?
    `, [id]);
  }

  static async findByTicketId(ticket_id) {
    return await db.all(`
      SELECT 
        a.*,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.ticket_id = ?
      ORDER BY a.uploaded_at DESC
    `, [ticket_id]);
  }

  static async findByCommentId(comment_id) {
    return await db.all(`
      SELECT 
        a.*,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.comment_id = ?
      ORDER BY a.uploaded_at DESC
    `, [comment_id]);
  }

  static async delete(id) {
    const attachment = await this.findById(id);
    
    if (attachment) {
      try {
        const fullPath = path.join(__dirname, '../../uploads', attachment.filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
      
      const result = await db.run('DELETE FROM ticket_attachments WHERE id = ?', [id]);
      return result.changes > 0;
    }
    
    return false;
  }

  static async getFileStats() {
    return await db.get(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size
      FROM ticket_attachments
    `);
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getFileIcon(mime_type) {
    if (mime_type.startsWith('image/')) return '🖼️';
    if (mime_type.startsWith('video/')) return '🎥';
    if (mime_type.includes('pdf')) return '📄';
    if (mime_type.includes('word')) return '📝';
    if (mime_type.includes('excel')) return '📊';
    if (mime_type.includes('text')) return '📄';
    return '📎';
  }
}

module.exports = Attachment;