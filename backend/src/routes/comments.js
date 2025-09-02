const express = require('express');
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
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

    if (!isInternal) {
      await Ticket.update(ticketId, { 
        status: req.user.role === 'client' ? 'open' : ticket.status,
        updated_at: new Date().toISOString()
      });
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