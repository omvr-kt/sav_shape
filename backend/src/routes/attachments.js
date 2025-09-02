const express = require('express');
const Attachment = require('../models/Attachment');
const Ticket = require('../models/Ticket');
const { verifyToken } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { validateId } = require('../middleware/validation');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/ticket/:ticket_id', verifyToken, validateId, async (req, res) => {
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

    const attachments = await Attachment.findByTicketId(ticketId);

    res.json({
      success: true,
      data: { attachments }
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des pièces jointes'
    });
  }
});

router.post('/ticket/:ticket_id', verifyToken, validateId, upload.array('files', 5), handleUploadError, async (req, res) => {
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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    const attachments = [];
    
    for (const file of req.files) {
      const attachmentData = {
        ticket_id: ticketId,
        comment_id: null,
        filename: file.filename,
        original_filename: file.originalname,
        file_path: `/uploads/${file.filename}`,
        file_size: file.size,
        mime_type: file.mimetype,
        uploaded_by: req.user.id
      };

      const attachment = await Attachment.create(attachmentData);
      attachments.push(attachment);
    }

    res.status(201).json({
      success: true,
      message: `${attachments.length} fichier(s) uploadé(s) avec succès`,
      data: { attachments }
    });
  } catch (error) {
    console.error('Upload attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload des fichiers'
    });
  }
});

router.get('/download/:id', verifyToken, validateId, async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }

    const ticket = await Ticket.findById(attachment.ticket_id);
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette pièce jointe'
      });
    }

    const filePath = path.join(__dirname, '../../uploads', attachment.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    res.download(filePath, attachment.original_filename);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement'
    });
  }
});

router.delete('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }

    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres fichiers'
      });
    }

    const deleted = await Attachment.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Pièce jointe non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Pièce jointe supprimée avec succès'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
});

router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'team') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const stats = await Attachment.getFileStats();

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get file stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;