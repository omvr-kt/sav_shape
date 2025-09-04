const { db } = require('../utils/database');

class Attachment {
  static async create(attachmentData) {
    const { 
      ticket_id = null,
      comment_id = null,
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
    `, [ticket_id, comment_id, filename, original_filename, file_path, file_size, mime_type, uploaded_by]);
    
    return this.findById(result.id);
  }

  static async findById(id) {
    return await db.get(`
      SELECT 
        a.*,
        u.first_name,
        u.last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.id = ?
    `, [id]);
  }

  static async findByCommentId(comment_id) {
    return await db.all(`
      SELECT 
        a.*,
        u.first_name,
        u.last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.comment_id = ?
      ORDER BY a.uploaded_at ASC
    `, [comment_id]);
  }

  static async findByTicketId(ticket_id) {
    return await db.all(`
      SELECT 
        a.*,
        u.first_name,
        u.last_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.ticket_id = ?
      ORDER BY a.uploaded_at ASC
    `, [ticket_id]);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM ticket_attachments WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async getAttachmentCount(ticket_id) {
    const result = await db.get('SELECT COUNT(*) as count FROM ticket_attachments WHERE ticket_id = ?', [ticket_id]);
    return result.count;
  }

  // Helper method to check file type
  static isImageType(mimeType) {
    return mimeType.startsWith('image/');
  }

  static isDocumentType(mimeType) {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    return documentTypes.includes(mimeType);
  }

  // Format file size for display
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = Attachment;