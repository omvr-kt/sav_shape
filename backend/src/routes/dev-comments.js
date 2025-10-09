const express = require('express');
const { verifyToken, requireAdminOrDev } = require('../middleware/auth');
const Task = require('../models/Task');
const { db } = require('../utils/database');
const router = express.Router();

// ===== COMMENTAIRES =====

// GET /api/dev/tasks/:id/comments - Liste des commentaires d'une tâche
router.get('/tasks/:id/comments', verifyToken, requireAdminOrDev, async (req, res) => {
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
    
    const comments = await db.all(`
      SELECT 
        tc.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email
      FROM task_comments tc
      LEFT JOIN users u ON tc.author_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `, [taskId]);
    
    // Ajouter les mentions pour chaque commentaire
    for (let comment of comments) {
      const mentions = await db.all(`
        SELECT 
          cm.*,
          u.first_name as mentioned_first_name,
          u.last_name as mentioned_last_name,
          u.email as mentioned_email
        FROM comment_mentions cm
        LEFT JOIN users u ON cm.mentioned_user_id = u.id
        WHERE cm.comment_id = ?
      `, [comment.id]);
      
      comment.mentions = mentions;
    }
    
    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Erreur récupération commentaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commentaires'
    });
  }
});

// POST /api/dev/tasks/:id/comments - Ajouter un commentaire
router.post('/tasks/:id/comments', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { body, mentions } = req.body;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    if (!body || body.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Contenu du commentaire requis'
      });
    }
    
    // Créer le commentaire
    const result = await db.run(`
      INSERT INTO task_comments (task_id, author_id, body)
      VALUES (?, ?, ?)
    `, [taskId, req.user.id, body.trim()]);
    
    const commentId = result.id;
    
    // Ajouter les mentions si fournies
    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      for (const userId of mentions) {
        // Vérifier que l'utilisateur mentionné existe et a accès au projet
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (user) {
          const userCanAccess = await Task.canUserAccessTask(userId, taskId);
          if (userCanAccess) {
            await db.run(`
              INSERT INTO comment_mentions (comment_id, mentioned_user_id)
              VALUES (?, ?)
            `, [commentId, userId]);
          }
        }
      }
    }
    
    // Log de l'activité
    await Task.logActivity('task', taskId, 'comment_added', 
      { body: body.substring(0, 100), mentions }, req.user.id);
    
    // Récupérer le commentaire complet avec les mentions
    const comment = await db.get(`
      SELECT 
        tc.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email
      FROM task_comments tc
      LEFT JOIN users u ON tc.author_id = u.id
      WHERE tc.id = ?
    `, [commentId]);
    
    const commentMentions = await db.all(`
      SELECT 
        cm.*,
        u.first_name as mentioned_first_name,
        u.last_name as mentioned_last_name,
        u.email as mentioned_email
      FROM comment_mentions cm
      LEFT JOIN users u ON cm.mentioned_user_id = u.id
      WHERE cm.comment_id = ?
    `, [commentId]);
    
    comment.mentions = commentMentions;
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Erreur création commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du commentaire'
    });
  }
});

// PATCH /api/dev/comments/:id - Modifier un commentaire
router.patch('/comments/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { body } = req.body;
    
    if (!body || body.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Contenu du commentaire requis'
      });
    }
    
    // Vérifier que l'utilisateur est l'auteur du commentaire
    const comment = await db.get('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }
    
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seul l\'auteur peut modifier ce commentaire'
      });
    }
    
    // Mettre à jour le commentaire
    await db.run(`
      UPDATE task_comments 
      SET body = ?, edited = TRUE, updated_at = ?
      WHERE id = ?
    `, [body.trim(), new Date().toISOString(), commentId]);
    
    // Log de l'activité
    await Task.logActivity('task', comment.task_id, 'comment_edited', 
      { commentId, oldBody: comment.body.substring(0, 50), newBody: body.substring(0, 50) }, req.user.id);
    
    // Récupérer le commentaire mis à jour
    const updatedComment = await db.get(`
      SELECT 
        tc.*,
        u.first_name as author_first_name,
        u.last_name as author_last_name,
        u.email as author_email
      FROM task_comments tc
      LEFT JOIN users u ON tc.author_id = u.id
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
    
    // Vérifier que l'utilisateur est l'auteur du commentaire
    const comment = await db.get('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }
    
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seul l\'auteur peut supprimer ce commentaire'
      });
    }
    
    // Supprimer le commentaire (les mentions seront supprimées automatiquement par CASCADE)
    await db.run('DELETE FROM task_comments WHERE id = ?', [commentId]);
    
    // Log de l'activité
    await Task.logActivity('task', comment.task_id, 'comment_deleted', 
      { commentId, body: comment.body.substring(0, 50) }, req.user.id);
    
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

// ===== MENTIONS =====

// GET /api/dev/mentions/unread - Mentions non lues pour l'utilisateur
router.get('/mentions/unread', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const mentions = await db.all(`
      SELECT 
        cm.*,
        tc.body as comment_body,
        tc.task_id,
        t.title as task_title,
        t.project_id,
        p.name as project_name,
        u.first_name as author_first_name,
        u.last_name as author_last_name
      FROM comment_mentions cm
      INNER JOIN task_comments tc ON cm.comment_id = tc.id
      INNER JOIN tasks t ON tc.task_id = t.id
      INNER JOIN projects p ON t.project_id = p.id
      INNER JOIN users u ON tc.author_id = u.id
      WHERE cm.mentioned_user_id = ? AND cm.read_at IS NULL
      ORDER BY cm.created_at DESC
    `, [req.user.id]);
    
    res.json({
      success: true,
      data: mentions
    });
  } catch (error) {
    console.error('Erreur récupération mentions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des mentions'
    });
  }
});

// POST /api/dev/mentions/:id/read - Marquer une mention comme lue
router.post('/mentions/:id/read', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const mentionId = req.params.id;
    
    // Vérifier que la mention appartient à l'utilisateur
    const mention = await db.get('SELECT * FROM comment_mentions WHERE id = ? AND mentioned_user_id = ?', 
      [mentionId, req.user.id]);
    
    if (!mention) {
      return res.status(404).json({
        success: false,
        message: 'Mention non trouvée'
      });
    }
    
    // Marquer comme lue
    await db.run(`
      UPDATE comment_mentions 
      SET read_at = ?
      WHERE id = ?
    `, [new Date().toISOString(), mentionId]);
    
    res.json({
      success: true,
      message: 'Mention marquée comme lue'
    });
  } catch (error) {
    console.error('Erreur marquage mention:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage de la mention'
    });
  }
});

// ===== PIÈCES JOINTES =====

// GET /api/dev/tasks/:id/attachments - Liste des pièces jointes d'une tâche
router.get('/tasks/:id/attachments', verifyToken, requireAdminOrDev, async (req, res) => {
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
    
    const attachments = await Task.getAttachments(taskId);
    
    res.json({
      success: true,
      data: attachments
    });
  } catch (error) {
    console.error('Erreur récupération pièces jointes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pièces jointes'
    });
  }
});

// DELETE /api/dev/attachments/:id - Supprimer une pièce jointe
router.delete('/attachments/:id', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const attachmentId = req.params.id;
    
    // Récupérer les infos de la pièce jointe
    const attachment = await db.get('SELECT * FROM task_attachments WHERE id = ?', [attachmentId]);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, attachment.task_id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    // Supprimer la pièce jointe
    const deleted = await Task.removeAttachment(attachmentId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Pièce jointe supprimée'
    });
  } catch (error) {
    console.error('Erreur suppression pièce jointe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la pièce jointe'
    });
  }
});

// ===== LIAISON TICKETS =====

// GET /api/dev/tasks/:id/tickets - Liste des tickets liés à une tâche
router.get('/tasks/:id/tickets', verifyToken, requireAdminOrDev, async (req, res) => {
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
    
    const tickets = await Task.getLinkedTickets(taskId);
    
    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Erreur récupération tickets liés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tickets liés'
    });
  }
});

// POST /api/dev/tasks/:id/tickets - Lier un ticket à une tâche
router.post('/tasks/:id/tickets', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { ticket_id } = req.body;
    
    if (!ticket_id) {
      return res.status(400).json({
        success: false,
        message: 'ID du ticket requis'
      });
    }
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    // Vérifier que le ticket existe
    const ticket = await db.get('SELECT id, title FROM tickets WHERE id = ?', [ticket_id]);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }
    
    // Lier le ticket
    const linked = await Task.linkTicket(taskId, ticket_id);
    
    if (!linked) {
      return res.status(400).json({
        success: false,
        message: 'Ticket déjà lié à cette tâche'
      });
    }
    
    // Log de l'activité
    await Task.logActivity('task', taskId, 'ticket_linked', 
      { ticket_id, ticket_title: ticket.title }, req.user.id);
    
    res.json({
      success: true,
      message: 'Ticket lié à la tâche'
    });
  } catch (error) {
    console.error('Erreur liaison ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la liaison du ticket'
    });
  }
});

// DELETE /api/dev/tasks/:id/tickets/:ticketId - Délier un ticket d'une tâche
router.delete('/tasks/:id/tickets/:ticketId', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const { id: taskId, ticketId } = req.params;
    
    // Vérifier l'accès à la tâche
    const canAccess = await Task.canUserAccessTask(req.user.id, taskId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette tâche'
      });
    }
    
    // Récupérer le titre du ticket pour le log
    const ticket = await db.get('SELECT title FROM tickets WHERE id = ?', [ticketId]);
    
    // Délier le ticket
    const unlinked = await Task.unlinkTicket(taskId, ticketId);
    
    if (!unlinked) {
      return res.status(404).json({
        success: false,
        message: 'Liaison non trouvée'
      });
    }
    
    // Log de l'activité
    await Task.logActivity('task', taskId, 'ticket_unlinked', 
      { ticket_id: ticketId, ticket_title: ticket?.title }, req.user.id);
    
    res.json({
      success: true,
      message: 'Ticket délié de la tâche'
    });
  } catch (error) {
    console.error('Erreur déliaison ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déliaison du ticket'
    });
  }
});

// ===== LIAISON TÂCHES DEPUIS TICKETS =====

// GET /api/dev/tickets/:id/tasks - Liste des tâches liées à un ticket
router.get('/tickets/:id/tasks', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const ticketId = req.params.id;
    // Vérifier l'accès au ticket
    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket non trouvé' });

    // Admin/Dev: OK; si besoin, ajouter ACL ici
    const tasks = await db.all(`
      SELECT t.*
      FROM task_tickets tt
      INNER JOIN tasks t ON tt.task_id = t.id
      WHERE tt.ticket_id = ?
      ORDER BY t.created_at DESC
    `, [ticketId]);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Erreur récupération tâches liées au ticket:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des tâches' });
  }
});

// POST /api/dev/tickets/:id/tasks - Lier une tâche à un ticket
router.post('/tickets/:id/tasks', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { task_id } = req.body;
    if (!task_id) return res.status(400).json({ success: false, message: 'ID de la tâche requis' });

    // Vérifier que la tâche existe
    const task = await Task.findById(task_id);
    if (!task) return res.status(404).json({ success: false, message: 'Tâche non trouvée' });

    // Lier
    const linked = await Task.linkTicket(task_id, ticketId);
    if (!linked) {
      return res.status(400).json({ success: false, message: 'Déjà lié' });
    }
    await Task.logActivity('task', task_id, 'ticket_linked', { ticket_id: ticketId }, req.user.id);
    res.json({ success: true, message: 'Tâche liée au ticket' });
  } catch (error) {
    console.error('Erreur liaison tâche->ticket:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la liaison' });
  }
});

// DELETE /api/dev/tickets/:id/tasks/:taskId - Délier une tâche d'un ticket
router.delete('/tickets/:id/tasks/:taskId', verifyToken, requireAdminOrDev, async (req, res) => {
  try {
    const { id: ticketId, taskId } = req.params;
    const unlinked = await Task.unlinkTicket(taskId, ticketId);
    if (!unlinked) return res.status(404).json({ success: false, message: 'Lien non trouvé' });
    await Task.logActivity('task', taskId, 'ticket_unlinked', { ticket_id: ticketId }, req.user.id);
    res.json({ success: true, message: 'Tâche déliée du ticket' });
  } catch (error) {
    console.error('Erreur délier tâche->ticket:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du délier' });
  }
});

module.exports = router;
