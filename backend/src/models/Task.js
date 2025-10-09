const { db } = require('../utils/database');

class Task {
  static async create(taskData) {
    const { 
      project_id, 
      title, 
      description, 
      urgency = 'medium', 
      status = 'todo_back', 
      start_at = new Date().toISOString(),
      created_by,
      ticket_ids = []
    } = taskData;

    // Calculer due_at selon l'urgence (SLA)
    const due_at = this.calculateDueDate(start_at, urgency);

    const result = await db.run(`
      INSERT INTO tasks (project_id, title, description, urgency, status, start_at, due_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [project_id, title, description, urgency, status, start_at, due_at, created_by]);

    const taskId = result.id;

    // Lier les tickets si fournis
    if (ticket_ids.length > 0) {
      for (const ticket_id of ticket_ids) {
        await this.linkTicket(taskId, ticket_id);
      }
    }

    // Log de l'activité
    await this.logActivity('task', taskId, 'created', { title, urgency, status }, created_by);

    return this.findById(taskId);
  }

  static async findById(id) {
    const task = await db.get(`
      SELECT 
        t.*,
        p.name as project_name,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        assigned.first_name as assigned_first_name,
        assigned.last_name as assigned_last_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assigned ON t.assigned_to = assigned.id
      WHERE t.id = ?
    `, [id]);

    return task;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT 
        t.*,
        p.name as project_name,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        COUNT(DISTINCT ta.id) as attachment_count,
        COUNT(DISTINCT tc.id) as comment_count
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN task_attachments ta ON t.id = ta.task_id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.project_id) {
      query += ' AND t.project_id = ?';
      params.push(filters.project_id);
    }

    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    if (filters.urgency) {
      query += ' AND t.urgency = ?';
      params.push(filters.urgency);
    }

    if (filters.created_by) {
      query += ' AND t.created_by = ?';
      params.push(filters.created_by);
    }

    if (filters.search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' GROUP BY t.id';
    query += ' ORDER BY COALESCE(t.due_at, t.due_date) ASC, t.urgency DESC, t.created_at ASC';

    return await db.all(query, params);
  }

  static async update(id, updates, updated_by) {
    const allowedFields = ['title', 'description', 'urgency', 'status', 'due_date', 'assigned_to'];
    const fieldsToUpdate = [];
    const values = [];

    // Récupérer la tâche actuelle pour comparaison
    const currentTask = await this.findById(id);
    if (!currentTask) {
      throw new Error('Task not found');
    }

    const changes = {};

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== currentTask[key]) {
        fieldsToUpdate.push(`${key} = ?`);
        values.push(updates[key]);
        changes[key] = { from: currentTask[key], to: updates[key] };
      }
    });

    if (fieldsToUpdate.length === 0) {
      return currentTask;
    }

    // Recalculer due_at si urgence ou start_at changent
    if (updates.urgency || updates.start_at) {
      const newUrgency = updates.urgency || currentTask.urgency;
      const newStartAt = updates.start_at || currentTask.start_at;
      const newDueAt = this.calculateDueDate(newStartAt, newUrgency);
      
      fieldsToUpdate.push('due_at = ?');
      values.push(newDueAt);
      changes.due_at = { from: currentTask.due_at, to: newDueAt };
    }

    fieldsToUpdate.push('updated_by = ?', 'updated_at = ?');
    values.push(updated_by, new Date().toISOString());
    values.push(id);

    await db.run(`
      UPDATE tasks 
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = ?
    `, values);

    // Propager les changements de statut aux tickets liés
    if (updates.status && updates.status !== currentTask.status) {
      await this.propagateStatusToTickets(id, updates.status);
    }

    // Log de l'activité
    await this.logActivity('task', id, 'updated', changes, updated_by);

    return this.findById(id);
  }

  static async delete(id, deleted_by) {
    // Log avant suppression
    const task = await this.findById(id);
    if (task) {
      await this.logActivity('task', id, 'deleted', { title: task.title }, deleted_by);
    }

    const result = await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Calcul de la date d'échéance selon l'urgence (SLA)
  static calculateDueDate(startAt, urgency) {
    // Convertir startAt en timestamp robuste (prend en charge dates SQLite sans timezone)
    let startMs;
    if (startAt instanceof Date) {
      const t = startAt.getTime();
      startMs = Number.isFinite(t) ? t : Date.now();
    } else if (typeof startAt === 'string') {
      let s = startAt.trim();
      // Normaliser "YYYY-MM-DD HH:mm:ss" en ISO-like pour parsing
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T');
      }
      const parsed = Date.parse(s);
      startMs = Number.isFinite(parsed) ? parsed : Date.now();
    } else if (typeof startAt === 'number' && Number.isFinite(startAt)) {
      startMs = startAt;
    } else {
      startMs = Date.now();
    }

    let hoursToAdd;
    switch (urgency) {
      case 'urgent': hoursToAdd = 24; break;
      case 'high': hoursToAdd = 48; break;
      case 'medium': hoursToAdd = 72; break;
      case 'low': hoursToAdd = 96; break;
      default: hoursToAdd = 72;
    }

    const dueMs = startMs + (hoursToAdd * 60 * 60 * 1000);
    const dueDate = new Date(dueMs);
    const iso = dueDate.toISOString();
    // Sécurité: si jamais iso est invalide (cas improbable), fallback sur maintenant + 72h
    return typeof iso === 'string' ? iso : new Date(Date.now() + 72 * 3600000).toISOString();
  }

  // Gestion des tickets liés
  static async linkTicket(taskId, ticketId) {
    try {
      await db.run(`
        INSERT INTO task_tickets (task_id, ticket_id)
        VALUES (?, ?)
      `, [taskId, ticketId]);
      return true;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return false; // Déjà lié
      }
      throw error;
    }
  }

  static async unlinkTicket(taskId, ticketId) {
    const result = await db.run(`
      DELETE FROM task_tickets 
      WHERE task_id = ? AND ticket_id = ?
    `, [taskId, ticketId]);
    return result.changes > 0;
  }

  static async getLinkedTickets(taskId) {
    return await db.all(`
      SELECT 
        t.id,
        t.ticket_number,
        t.title,
        t.status,
        t.priority
      FROM task_tickets tt
      INNER JOIN tickets t ON tt.ticket_id = t.id
      WHERE tt.task_id = ?
      ORDER BY t.created_at DESC
    `, [taskId]);
  }

  // Récupérer les tâches liées à un ticket
  static async getTasksByTicket(ticketId) {
    return await db.all(`
      SELECT t.*
      FROM task_tickets tt
      INNER JOIN tasks t ON tt.task_id = t.id
      WHERE tt.ticket_id = ?
      ORDER BY t.created_at DESC
    `, [ticketId]);
  }

  // Propagation du statut vers les tickets liés
  static async propagateStatusToTickets(taskId, newTaskStatus) {
    const statusMapping = {
      'todo_back': 'open',
      'todo_front': 'open',
      'in_progress': 'in_progress',
      // Map "ready_for_review" to an allowed ticket status
      // Tickets allowed: 'open','in_progress','waiting_client','resolved','closed'
      'ready_for_review': 'in_progress',
      'done': 'resolved'
    };

    const ticketStatus = statusMapping[newTaskStatus];
    if (!ticketStatus) return;

    const linkedTickets = await this.getLinkedTickets(taskId);
    
    for (const ticket of linkedTickets) {
      // Ne pas changer le statut des tickets fermés
      if (ticket.status !== 'closed') {
        await db.run(`
          UPDATE tickets 
          SET status = ?, updated_at = ?
          WHERE id = ?
        `, [ticketStatus, new Date().toISOString(), ticket.id]);
      }
    }
  }

  // Gestion des pièces jointes
  static async getAttachments(taskId) {
    return await db.all(`
      SELECT 
        ta.*,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name
      FROM task_attachments ta
      LEFT JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.created_at DESC
    `, [taskId]);
  }

  static async addAttachment(taskId, attachmentData) {
    const { filename, path, size, mime_type, uploaded_by } = attachmentData;
    
    const result = await db.run(`
      INSERT INTO task_attachments (task_id, filename, path, size, mime_type, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [taskId, filename, path, size, mime_type, uploaded_by]);

    await this.logActivity('task', taskId, 'attachment_added', { filename }, uploaded_by);

    return result.id;
  }

  static async removeAttachment(attachmentId, removed_by) {
    const attachment = await db.get('SELECT * FROM task_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) return false;

    const result = await db.run('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);
    
    if (result.changes > 0) {
      await this.logActivity('task', attachment.task_id, 'attachment_removed', 
        { filename: attachment.filename }, removed_by);
    }

    return result.changes > 0;
  }

  // Gestion des commentaires
  static async getCommentCount(taskId) {
    const result = await db.get('SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?', [taskId]);
    return result.count;
  }

  // Permissions
  static async canUserAccessTask(userId, taskId) {
    const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) return false;

    // Admin peut tout voir
    if (user.role === 'admin') return true;

    // Développeur ne peut voir que les projets assignés
    if (user.role === 'developer') {
      const access = await db.get(`
        SELECT 1
        FROM tasks t
        INNER JOIN developer_projects dp ON t.project_id = dp.project_id
        WHERE t.id = ? AND dp.user_id = ?
      `, [taskId, userId]);
      return !!access;
    }

    return false;
  }

  static async getUserAccessibleProjects(userId) {
    const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) return [];

    // Admin voit tous les projets
    if (user.role === 'admin') {
      return await db.all('SELECT id, name, status FROM projects ORDER BY name');
    }

    // Développeur voit seulement ses projets assignés
    if (user.role === 'developer') {
      return await db.all(`
        SELECT p.id, p.name, p.status
        FROM projects p
        INNER JOIN developer_projects dp ON p.id = dp.project_id
        WHERE dp.user_id = ?
        ORDER BY p.name
      `, [userId]);
    }

    return [];
  }

  // Logs d'activité
  static async logActivity(entityType, entityId, action, payload, actorId) {
    await db.run(`
      INSERT INTO activity_logs (entity_type, entity_id, action, payload_json, actor_id)
      VALUES (?, ?, ?, ?, ?)
    `, [entityType, entityId, action, JSON.stringify(payload), actorId]);
  }

  static async getActivityLogs(taskId, limit = 50) {
    return await db.all(`
      SELECT 
        al.*,
        u.first_name as actor_first_name,
        u.last_name as actor_last_name
      FROM activity_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.entity_type = 'task' AND al.entity_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [taskId, limit]);
  }

  // Vérifier si un utilisateur a accès à un projet
  static async hasProjectAccess(userId, projectId) {
    const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) return false;

    // Admin a accès à tous les projets
    if (user.role === 'admin') {
      return true;
    }

    // Développeur a accès seulement aux projets assignés
    if (user.role === 'developer') {
      const access = await db.get(`
        SELECT 1 FROM developer_projects 
        WHERE user_id = ? AND project_id = ?
      `, [userId, projectId]);
      return !!access;
    }

    return false;
  }
}

module.exports = Task;
