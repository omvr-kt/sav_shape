const express = require('express');
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Project = require('../models/Project');
const emailService = require('../services/email');
const { templates } = require('../config/email-templates');
const { verifyToken, requireTeamOrAdmin } = require('../middleware/auth');
const { validateCommentCreation, validateId, validateTicketId } = require('../middleware/validation');

const router = express.Router();

router.get('/ticket/:ticket_id', verifyToken, validateTicketId, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticket_id);
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce ticket'
      });
    }

    const includeInternal = req.user.role !== 'client';
    const comments = await Comment.findByTicketId(ticketId, includeInternal);

    res.json({
      success: true,
      data: { comments }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commentaires'
    });
  }
});

router.post('/ticket/:ticket_id', verifyToken, validateTicketId, validateCommentCreation, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticket_id);
    const { content, is_internal = false } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce ticket'
      });
    }

    let isInternal = is_internal;
    if (req.user.role === 'client') {
      isInternal = false;
    }

    const commentData = {
      ticket_id: ticketId,
      user_id: req.user.id,
      content,
      is_internal: isInternal
    };

    const comment = await Comment.create(commentData);
    // Mentions @email parsing
    try {
      const { db } = require('../utils/database');
      const mentionMatches = (content.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || [])
        .map(m => m.slice(1).toLowerCase());
      const unique = [...new Set(mentionMatches)];
      console.log('[mentions] parsed from comment:', unique);
      for (const email of unique) {
        const user = await User.findByEmail(email);
        if (user) {
          await db.run('INSERT INTO ticket_comment_mentions (comment_id, mentioned_user_id) VALUES (?, ?)', [comment.id, user.id]);
        }
      }
    } catch (mErr) {
      console.warn('[mentions] parse error:', mErr?.message);
    }

    if (!isInternal) {
      await Ticket.update(ticketId, { 
        status: req.user.role === 'client' ? 'open' : ticket.status,
        updated_at: new Date().toISOString()
      });
    }

    // Mentions @email dans le contenu
    try {
      const { db } = require('../utils/database');
      const mentionMatches = (content.match(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g) || [])
        .map(m => m.slice(1).toLowerCase());
      const uniqueEmails = [...new Set(mentionMatches)];
      for (const email of uniqueEmails) {
        const user = await User.findByEmail(email);
        if (user) {
          await db.run(`INSERT INTO ticket_comment_mentions (comment_id, mentioned_user_id) VALUES (?, ?)`, [comment.id, user.id]);
        }
      }
    } catch (mentionErr) {
      console.warn('Mention parse failed:', mentionErr.message);
    }

    // Notifications selon le type d'utilisateur
    try {
      const project = await Project.findById(ticket.project_id);
      
      if (req.user.role === 'client' && !isInternal) {
        // Notification pour Omar quand un client ajoute un commentaire
        if (process.env.ADMIN_NOTIFICATION_EMAIL) {
          const client = await User.findById(req.user.id);
          const emailHtml = templates.newCommentForOmar(comment, ticket, client, project);
          
          await emailService.sendMail({
            from: process.env.SMTP_FROM,
            to: process.env.ADMIN_NOTIFICATION_EMAIL,
            subject: `Nouveau commentaire client - Ticket #${ticket.id}`,
            html: emailHtml
          });
          console.log('Notification commentaire client envoyée à Omar');
        }
      } else if ((req.user.role === 'admin' || req.user.role === 'team') && !isInternal) {
        // Notification pour le client quand la team/admin ajoute un commentaire non interne
        const client = await User.findById(ticket.client_id);
        const author = await User.findById(req.user.id);
        const emailHtml = templates.newCommentForClient(comment, ticket, author, client, project);
        
        await emailService.sendMail({
          from: process.env.SMTP_FROM,
          to: client.email,
          subject: `Nouvelle réponse sur votre ticket #${ticket.id}`,
          html: emailHtml
        });
        console.log('Notification commentaire envoyée au client');
      }
    } catch (emailError) {
      console.error('Erreur envoi notification commentaire:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Commentaire ajouté avec succès',
      data: { comment }
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du commentaire'
    });
  }
});

router.put('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le contenu du commentaire est requis'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres commentaires'
      });
    }

    const updatedComment = await Comment.update(commentId, { content });

    res.json({
      success: true,
      message: 'Commentaire mis à jour avec succès',
      data: { comment: updatedComment }
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du commentaire'
    });
  }
});

router.delete('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres commentaires'
      });
    }

    const deleted = await Comment.delete(commentId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Commentaire supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du commentaire'
    });
  }
});

module.exports = router;
