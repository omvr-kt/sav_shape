const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Attachment = require('../models/Attachment');
const Comment = require('../models/Comment');
const Ticket = require('../models/Ticket');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configuration de multer pour l'upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/attachments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Types de fichiers autorisés
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    // Archives
    'application/zip', 'application/x-rar-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Upload attachment for comment
router.post('/comment/:comment_id', verifyToken, upload.single('attachment'), async (req, res) => {
  try {
    const commentId = parseInt(req.params.comment_id);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Vérifier que le commentaire existe et que l'utilisateur a accès
    const comment = await Comment.findById(commentId);
    if (!comment) {
      // Supprimer le fichier uploadé si le commentaire n'existe pas
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    // Vérifier l'accès au ticket
    const ticket = await Ticket.findById(comment.ticket_id);
    if (!ticket) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const attachmentData = {
      comment_id: commentId,
      filename: req.file.filename,
      original_filename: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: req.user.id
    };

    const attachment = await Attachment.create(attachmentData);

    res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      data: { attachment }
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    
    // Supprimer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'upload du fichier'
    });
  }
});

// Get attachments for a comment
router.get('/comment/:comment_id', verifyToken, async (req, res) => {
  try {
    const commentId = parseInt(req.params.comment_id);
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    const ticket = await Ticket.findById(comment.ticket_id);
    if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const attachments = await Attachment.findByCommentId(commentId);

    res.json({
      success: true,
      data: { attachments }
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des attachments'
    });
  }
});

// Download attachment
router.get('/download/:id', verifyToken, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.id);
    
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    // Vérifier les permissions
    if (attachment.comment_id) {
      const comment = await Comment.findById(attachment.comment_id);
      const ticket = await Ticket.findById(comment.ticket_id);
      
      if (req.user.role === 'client' && ticket.client_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
    }

    // Vérifier que le fichier existe
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    // Configurer les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    
    // Envoyer le fichier
    res.sendFile(path.resolve(attachment.file_path));
    
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement'
    });
  }
});

// Delete attachment
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.id);
    
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    // Vérifier les permissions (seul l'uploader ou un admin peut supprimer)
    if (attachment.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres fichiers'
      });
    }

    // Supprimer le fichier du système de fichiers
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Supprimer l'enregistrement de la base de données
    const deleted = await Attachment.delete(attachmentId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
});

module.exports = router;