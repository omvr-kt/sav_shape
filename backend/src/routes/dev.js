const express = require('express');
const { verifyToken, requireAdmin, requireAdminOrDev } = require('../middleware/auth');
const Task = require('../models/Task');
const { db } = require('../utils/database');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const router = express.Router();

// Configuration multer pour les pièces jointes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../uploads/tasks');
    try { if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true }); } catch (e) {}
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    console.log('[dev attachments] Upload type:', file.mimetype, 'name:', file.originalname);
    cb(null, true);
  }
});

// ===== PROJETS DEV =====

// GET /api/dev/projects - Liste des projets accessibles
router.get('/projects', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const { status } = req.query;
    
    const projects = await Task.getUserAccessibleProjects(req.user.id);
    
    let filteredProjects = projects;
    if (status) {
      filteredProjects = projects.filter(p => p.status === status);
    }
    
    res.json({
      success: true,
      data: filteredProjects
    });
  } catch (error) {
    console.error('Erreur récupération projets dev:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des projets'
    });
  }
});

// POST /api/dev/projects - Créer un projet (Admin seulement)
router.post('/projects', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, code } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Nom et code du projet requis'
      });
    }
    
    const result = await db.run(`
      INSERT INTO projects (name, code, status, created_at)
      VALUES (?, ?, 'active', ?)
    `, [name, code, new Date().toISOString()]);
    
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [result.id]);
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Erreur création projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du projet'
    });
  }
});

// GET /api/dev/projects/:id - Détails d'un projet
router.get('/projects/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Vérifier l'accès au projet
    const accessibleProjects = await Task.getUserAccessibleProjects(req.user.id);
    const hasAccess = accessibleProjects.some(p => p.id == projectId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }
    
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Erreur récupération projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du projet'
    });
  }
});

// PATCH /api/dev/projects/:id - Mettre à jour un projet (Admin seulement)
router.patch('/projects/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, status } = req.body;
    const projectId = req.params.id;
    
    const updates = {};
    if (name) updates.name = name;
    if (status) updates.status = status;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ à mettre à jour'
      });
    }
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), projectId];
    
    await db.run(`
      UPDATE projects 
      SET ${fields}, updated_at = ?
      WHERE id = ?
    `, values);
    
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Erreur mise à jour projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du projet'
    });
  }
});

// POST /api/dev/projects/:id/archive - Archiver un projet (Admin seulement)
router.post('/projects/:id/archive', verifyToken, requireAdmin, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    await db.run(`
      UPDATE projects 
      SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), new Date().toISOString(), projectId]);
    
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Erreur archivage projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage du projet'
    });
  }
});

// POST /api/dev/projects/:id/restore - Restaurer un projet (Admin seulement)
router.post('/projects/:id/restore', verifyToken, requireAdmin, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    await db.run(`
      UPDATE projects 
      SET status = 'active', archived_at = NULL, updated_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), projectId]);
    
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Erreur restauration projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la restauration du projet'
    });
  }
});

// ===== ASSIGNATION DÉVELOPPEURS =====

// GET /api/dev/projects/:id/developers - Liste des développeurs du projet
router.get('/projects/:id/developers', verifyToken, requireAdmin, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const developers = await db.all(`
      SELECT u.id, u.first_name, u.last_name, u.email, dp.created_at as assigned_at
      FROM developer_projects dp
      INNER JOIN users u ON dp.user_id = u.id
      WHERE dp.project_id = ? AND u.role = 'developer'
      ORDER BY u.first_name, u.last_name
    `, [projectId]);
    
    res.json({
      success: true,
      data: developers
    });
  } catch (error) {
    console.error('Erreur récupération développeurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des développeurs'
    });
  }
});

// POST /api/dev/projects/:id/developers - Assigner un développeur
router.post('/projects/:id/developers', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    const projectId = req.params.id;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }
    
    // Vérifier que l'utilisateur est un développeur
    const user = await db.get('SELECT role FROM users WHERE id = ? AND role = ?', [user_id, 'developer']);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Utilisateur non trouvé ou n\'est pas un développeur'
      });
    }
    
    // Assigner au projet
    await db.run(`
      INSERT OR IGNORE INTO developer_projects (user_id, project_id)
      VALUES (?, ?)
    `, [user_id, projectId]);
    
    res.json({
      success: true,
      message: 'Développeur assigné au projet'
    });
  } catch (error) {
    console.error('Erreur assignation développeur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation du développeur'
    });
  }
});

// DELETE /api/dev/projects/:id/developers/:userId - Désassigner un développeur
router.delete('/projects/:id/developers/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { id: projectId, userId } = req.params;
    
    await db.run(`
      DELETE FROM developer_projects 
      WHERE user_id = ? AND project_id = ?
    `, [userId, projectId]);
    
    res.json({
      success: true,
      message: 'Développeur désassigné du projet'
    });
  } catch (error) {
    console.error('Erreur désassignation développeur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désassignation du développeur'
    });
  }
});

// ===== TÂCHES =====

// GET /api/dev/projects/:id/tasks - Liste des tâches d'un projet
router.get('/projects/:id/tasks', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { status } = req.query;
    
    // Vérifier l'accès au projet
    const accessibleProjects = await Task.getUserAccessibleProjects(req.user.id);
    const hasAccess = accessibleProjects.some(p => p.id == projectId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }
    
    const filters = { project_id: projectId };
    if (status) filters.status = status;
    
    const tasks = await Task.findAll(filters);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Erreur récupération tâches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tâches'
    });
  }
});

// POST /api/dev/projects/:id/tasks - Créer une tâche
router.post('/projects/:id/tasks', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { title, description, urgency, status, start_at, ticket_ids } = req.body;
    
    // Vérifier l'accès au projet
    const accessibleProjects = await Task.getUserAccessibleProjects(req.user.id);
    const hasAccess = accessibleProjects.some(p => p.id == projectId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Titre de la tâche requis'
      });
    }
    
    const taskData = {
      project_id: projectId,
      title,
      description,
      urgency: urgency || 'medium',
      status: status || 'todo_back',
      start_at: start_at || new Date().toISOString(),
      created_by: req.user.id,
      ticket_ids: ticket_ids || []
    };
    
    const task = await Task.create(taskData);
    
    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Erreur création tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la tâche'
    });
  }
});

// GET /api/dev/tasks/:id - Détails d'une tâche
router.get('/tasks/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Erreur récupération tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la tâche'
    });
  }
});

// PATCH /api/dev/tasks/:id - Mettre à jour une tâche
router.patch('/tasks/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    const updates = req.body;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    const task = await Task.update(taskId, updates, req.user.id);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Erreur mise à jour tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la tâche'
    });
  }
});

// DELETE /api/dev/tasks/:id - Supprimer une tâche
router.delete('/tasks/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    const deleted = await Task.delete(taskId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Tâche supprimée'
    });
  } catch (error) {
    console.error('Erreur suppression tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la tâche'
    });
  }
});

// ===== GESTION DÉVELOPPEURS =====

// GET /api/dev/developers - Liste tous les développeurs avec leurs assignations (Admin seulement)
router.get('/developers', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Récupérer tous les développeurs avec leurs projets assignés
    const developers = await db.all(`
      SELECT DISTINCT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.is_active,
        GROUP_CONCAT(p.name) as assigned_projects,
        COUNT(p.id) as project_count
      FROM users u
      LEFT JOIN developer_projects dp ON u.id = dp.user_id
      LEFT JOIN projects p ON dp.project_id = p.id AND p.status = 'active'
      WHERE u.role = 'developer'
      GROUP BY u.id
      ORDER BY u.last_name, u.first_name
    `);
    
    res.json({
      success: true,
      data: developers
    });
  } catch (error) {
    console.error('Erreur récupération développeurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des développeurs'
    });
  }
});

// ===== TEST ENDPOINT =====
// GET /api/dev/test - Endpoint de test 
router.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({
    success: true,
    message: 'API dev fonctionne',
    timestamp: new Date().toISOString()
  });
});

// ===== ATTACHMENTS TÂCHES =====

// POST /api/dev/tasks/:id/attachments - Upload d'attachement (single ou multiple)
router.post('/tasks/:id/attachments', verifyToken, requireAdminOrDev, upload.any(), async (req, res) => {
  try {
    const taskId = req.params.id;
    
    console.log('=== UPLOAD ATTACHMENT DEBUG ===');
    console.log('Task ID:', taskId);
    console.log('User ID:', req.user?.id);
    console.log('User role:', req.user?.role);
    console.log('File info:', req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    } : 'No file');
    
    const files = req.files && req.files.length ? req.files : (req.file ? [req.file] : []);
    if (!files.length) {
      console.log('ERROR: No file provided');
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    // Vérifier que la tâche existe et que l'utilisateur y a accès
    console.log('Looking for task with ID:', taskId);
    const task = await Task.findById(taskId);
    console.log('Task found:', task ? `${task.title} (project: ${task.project_id})` : 'null');
    
    if (!task) {
      console.log('ERROR: Task not found');
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    // Vérifier l'accès au projet
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce projet'
      });
    }
    
    const results = [];
    for (const f of files) {
      const attachmentId = await Task.addAttachment(taskId, {
        filename: f.originalname,
        path: f.path,
        size: f.size,
        mime_type: f.mimetype,
        uploaded_by: req.user.id
      });
      const newAttachment = await db.get(`
        SELECT ta.*, u.first_name as uploader_first_name, u.last_name as uploader_last_name
        FROM task_attachments ta
        JOIN users u ON ta.uploaded_by = u.id
        WHERE ta.id = ?
      `, [attachmentId]);
      results.push(newAttachment);
    }
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Erreur upload attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'attachement'
    });
  }
});

// GET /api/dev/tasks/:id/attachments - Liste des attachements
router.get('/tasks/:id/attachments', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Vérifier l'accès à la tâche
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce projet'
      });
    }
    
    const attachments = await db.all(`
      SELECT ta.*, u.first_name, u.last_name
      FROM task_attachments ta
      JOIN users u ON ta.uploaded_by = u.id
      WHERE ta.task_id = ?
      ORDER BY ta.uploaded_at DESC
    `, [taskId]);
    
    res.json({
      success: true,
      data: attachments
    });
  } catch (error) {
    console.error('Erreur récupération attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des attachements'
    });
  }
});

// GET /api/dev/attachments/download/:id - Télécharger un attachement de tâche
router.get('/attachments/download/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const id = req.params.id;
    const attachment = await db.get('SELECT * FROM task_attachments WHERE id = ?', [id]);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
    }
    const task = await Task.findById(attachment.task_id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Tâche non trouvée' });
    }
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Accès refusé à ce projet' });
    }
    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable sur le serveur' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename || path.basename(attachment.path)}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(attachment.path));
  } catch (error) {
    console.error('Erreur téléchargement attachment tâche:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du téléchargement' });
  }
});

// DELETE /api/dev/attachments/:id - Supprimer un attachement
router.delete('/attachments/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const attachmentId = req.params.id;
    
    const attachment = await db.get('SELECT * FROM task_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachement non trouvé'
      });
    }
    
    // Vérifier l'accès via la tâche
    const task = await Task.findById(attachment.task_id);
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }
    
    // Supprimer le fichier du système de fichiers
    const fs = require('fs');
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }
    
    await db.run('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);
    
    res.json({
      success: true,
      message: 'Attachement supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'attachement'
    });
  }
});

// ===== COMMENTAIRES TÂCHES =====

// GET /api/dev/tasks/:id/comments - Liste des commentaires
router.get('/tasks/:id/comments', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Vérifier l'accès à la tâche
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce projet'
      });
    }
    
    const comments = await db.all(`
      SELECT 
        tc.*,
        u.first_name as author_first_name, 
        u.last_name as author_last_name,
        GROUP_CONCAT(DISTINCT mu.first_name || ' ' || mu.last_name) as mentioned_users
      FROM task_comments tc
      JOIN users u ON tc.author_id = u.id
      LEFT JOIN comment_mentions cm ON tc.id = cm.comment_id
      LEFT JOIN users mu ON cm.mentioned_user_id = mu.id
      WHERE tc.task_id = ?
      GROUP BY tc.id
      ORDER BY tc.created_at ASC
    `, [taskId]);
    
    // Ajouter les permissions pour chaque commentaire
    const commentsWithPermissions = comments.map(comment => ({
      ...comment,
      can_edit: comment.author_id === req.user.id || req.user.role === 'admin',
      can_delete: comment.author_id === req.user.id || req.user.role === 'admin'
    }));
    
    res.json({
      success: true,
      data: commentsWithPermissions
    });
  } catch (error) {
    console.error('Erreur récupération commentaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commentaires'
    });
  }
});

// ===== RECHERCHE TICKETS POUR LIAISON =====
// GET /api/dev/tickets/search?q=...&limit=10
router.get('/tickets/search', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit || '10', 10) || 10, 25);
    if (!q) return res.json({ success: true, data: [] });
    let rows;
    if (/^\d+$/.test(q)) {
      // Recherche par id numérique ou ticket_number
      rows = await db.all(`
        SELECT id, ticket_number, title, status, priority
        FROM tickets
        WHERE id = ? OR ticket_number LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [parseInt(q, 10), `%${q}%`, limit]);
    } else {
      rows = await db.all(`
        SELECT id, ticket_number, title, status, priority
        FROM tickets
        WHERE title LIKE ? OR ticket_number LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `, [`%${q}%`, `%${q}%`, limit]);
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Erreur recherche tickets:', error);
    res.status(500).json({ success: false, message: 'Erreur recherche tickets' });
  }
});

// POST /api/dev/tasks/:id/comments - Créer un commentaire
router.post('/tasks/:id/comments', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { body: content, mentions = [] } = req.body;
    
    console.log('Comment body:', req.body);
    console.log('Content:', content);
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le contenu du commentaire est requis'
      });
    }
    
    // Vérifier l'accès à la tâche
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }
    
    const hasAccess = await Task.hasProjectAccess(req.user.id, task.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce projet'
      });
    }
    
    // Créer le commentaire
    const comment = await db.run(`
      INSERT INTO task_comments (task_id, author_id, body)
      VALUES (?, ?, ?)
    `, [taskId, req.user.id, content.trim()]);
    
    // Notre helper db.run() retourne un objet { id, changes }
    const commentId = comment.id;
    if (!commentId) {
      throw new Error('Erreur lors de la création du commentaire');
    }
    
    // Ajouter les mentions
    if (mentions && mentions.length > 0) {
      for (const userId of mentions) {
        await db.run(`
          INSERT INTO comment_mentions (comment_id, mentioned_user_id)
          VALUES (?, ?)
        `, [commentId, userId]);
      }
    }
    
    // Récupérer le commentaire créé avec les infos utilisateur
    const newComment = await db.get(`
      SELECT 
        tc.*,
        u.first_name as author_first_name, u.last_name as author_last_name,
        GROUP_CONCAT(DISTINCT mu.first_name || ' ' || mu.last_name) as mentioned_users
      FROM task_comments tc
      JOIN users u ON tc.author_id = u.id
      LEFT JOIN comment_mentions cm ON tc.id = cm.comment_id
      LEFT JOIN users mu ON cm.mentioned_user_id = mu.id
      WHERE tc.id = ?
      GROUP BY tc.id
    `, [commentId]);
    
    res.json({
      success: true,
      data: newComment
    });
  } catch (error) {
    console.error('Erreur création commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du commentaire'
    });
  }
});

// PUT /api/dev/comments/:id - Modifier un commentaire
router.put('/comments/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le contenu du commentaire est requis'
      });
    }
    
    const comment = await db.get('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }
    
    // Seul l'auteur ou un admin peut modifier
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres commentaires'
      });
    }
    
    await db.run(`
      UPDATE task_comments 
      SET body = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [content.trim(), commentId]);
    
    const updatedComment = await db.get(`
      SELECT tc.*, u.first_name, u.last_name
      FROM task_comments tc
      JOIN users u ON tc.author_id = u.id
      WHERE tc.id = ?
    `, [commentId]);
    
    res.json({
      success: true,
      data: updatedComment
    });
  } catch (error) {
    console.error('Erreur modification commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du commentaire'
    });
  }
});

// DELETE /api/dev/comments/:id - Supprimer un commentaire
router.delete('/comments/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const commentId = req.params.id;
    
    const comment = await db.get('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }
    
    // Seul l'auteur ou un admin peut supprimer
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres commentaires'
      });
    }
    
    // Supprimer les mentions associées
    await db.run('DELETE FROM comment_mentions WHERE comment_id = ?', [commentId]);
    
    // Supprimer le commentaire
    await db.run('DELETE FROM task_comments WHERE id = ?', [commentId]);
    
    res.json({
      success: true,
      message: 'Commentaire supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du commentaire'
    });
  }
});

// ===== MENTIONS NON LUES =====

// GET /api/dev/mentions/unread - Mentions non lues
router.get('/mentions/unread', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const mentions = await db.all(`
      SELECT 
        cm.*,
        tc.body as comment_content,
        tc.task_id,
        t.title as task_title,
        u.first_name, u.last_name
      FROM comment_mentions cm
      JOIN task_comments tc ON cm.comment_id = tc.id
      JOIN tasks t ON tc.task_id = t.id
      JOIN users u ON tc.author_id = u.id
      WHERE cm.mentioned_user_id = ? AND cm.read_at IS NULL
      ORDER BY tc.created_at DESC
    `, [req.user.id]);
    
    res.json({
      success: true,
      data: mentions
    });
  } catch (error) {
    console.error('Erreur mentions non lues:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des mentions'
    });
  }
});

// PUT /api/dev/mentions/:id/read - Marquer une mention comme lue
router.put('/mentions/:id/read', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const mentionId = req.params.id;
    
    const mention = await db.get('SELECT * FROM comment_mentions WHERE id = ?', [mentionId]);
    if (!mention) {
      return res.status(404).json({
        success: false,
        message: 'Mention non trouvée'
      });
    }
    
    if (mention.mentioned_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }
    
    await db.run(`
      UPDATE comment_mentions 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [mentionId]);
    
    res.json({
      success: true,
      message: 'Mention marquée comme lue'
    });
  } catch (error) {
    console.error('Erreur marquer mention lue:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la mention'
    });
  }
});

// GET /api/dev/tasks/:id/activity - Historique d'activité d'une tâche
router.get('/tasks/:id/activity', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette tâche'
      });
    }
    
    const activities = await Task.getActivityLogs(taskId);
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Erreur chargement activité tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement de l\'activité'
    });
  }
});

// GET /api/dev/attachments/:id/download - Télécharger une pièce jointe
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const attachmentId = req.params.id;
    
    // Récupérer les infos de l'attachment
    const attachment = await db.get(`
      SELECT ta.*, t.project_id 
      FROM task_attachments ta
      INNER JOIN tasks t ON ta.task_id = t.id
      WHERE ta.id = ?
    `, [attachmentId]);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }
    
    // Vérifier l'accès au projet
    const hasAccess = await Task.hasProjectAccess(req.user.id, attachment.project_id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette pièce jointe'
      });
    }
    
    const fs = require('fs');
    const path = require('path');
    
    // Vérifier que le fichier existe
    const filePath = path.join(__dirname, '../../', attachment.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }
    
    // Télécharger le fichier
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Erreur téléchargement pièce jointe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement'
    });
  }
});

module.exports = router;
