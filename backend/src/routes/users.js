const express = require('express');
const User = require('../models/User');
const SLA = require('../models/SLA');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { validateUserCreation, validateId } = require('../middleware/validation');
const { createAutomaticInvoice } = require('./invoices');

const router = express.Router();

router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role, is_active } = req.query;
    const filters = {};
    
    if (role) filters.role = role;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const users = await User.findAll(filters);

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

router.get('/clients', verifyToken, requireAdmin, async (req, res) => {
  try {
    const clients = await User.getClientsWithProjects();

    res.json({
      success: true,
      data: { clients }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients'
    });
  }
});

router.get('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Déchiffrer le fichier confidentiel si autorisé
    if (user.confidential_file && (req.user.role === 'admin' || req.user.id === user.id)) {
      try {
        const encryptionService = require('../services/encryptionService');
        const parts = user.confidential_file.split(':');
        if (parts.length === 2) {
          user.confidential_file_decrypted = encryptionService.decrypt(parts[0], parts[1]);
        }
      } catch (decryptError) {
        console.error('Error decrypting confidential file:', decryptError);
      }
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
});

router.post('/', verifyToken, requireAdmin, validateUserCreation, async (req, res) => {
  try {
    const userData = req.body;
    
    const existingUser = await User.findByEmail(userData.email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    const user = await User.create(userData);

    if (userData.role === 'client') {
      await SLA.createDefaultSLAs(user.id);
      
      // Créer automatiquement une facture pour le nouveau client
      try {
        const invoice = await createAutomaticInvoice(
          user.id,
          userData.quote_file,
          userData.specifications_file,
          null, // Montant à définir manuellement par l'admin plus tard
          `Facture automatique générée pour le client ${userData.first_name} ${userData.last_name}`
        );
        
        console.log(`Facture automatique créée: ${invoice.invoice_number} pour ${userData.email}`);
      } catch (invoiceError) {
        console.error('Erreur création facture automatique:', invoiceError);
        // Ne pas échouer la création de l'utilisateur si la facture échoue
      }
    }

    res.status(201).json({
      success: true,
      message: userData.role === 'client' ? 
        'Client créé avec succès. Une facture automatique a été générée.' : 
        'Utilisateur créé avec succès',
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur'
    });
  }
});

router.put('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updates = req.body;

    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (req.user.role !== 'admin') {
      delete updates.is_active;
      delete updates.role;
      delete updates.confidential_file;
    }

    const updatedUser = await User.update(userId, updates);

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
});

router.delete('/:id', verifyToken, requireAdmin, validateId, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    const deleted = await User.delete(userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
});

module.exports = router;