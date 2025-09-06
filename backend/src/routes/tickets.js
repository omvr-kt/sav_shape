const express = require('express');
const Ticket = require('../models/Ticket');
const Comment = require('../models/Comment');
const Project = require('../models/Project');
const { verifyToken, requireTeamOrAdmin } = require('../middleware/auth');
const { validateTicketCreation, validateTicketUpdate, validateId } = require('../middleware/validation');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const { client_id, project_id, status, priority, assigned_to, overdue_only } = req.query;
    let filters = {};

    console.log('API Tickets - User role:', req.user.role, 'User ID:', req.user.id);
    console.log('API Tickets - Query params:', req.query);

    if (req.user.role === 'client') {
      filters.client_id = req.user.id;
    } else {
      if (client_id) filters.client_id = client_id;
      if (assigned_to) filters.assigned_to = assigned_to;
    }

    if (project_id) filters.project_id = project_id;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (overdue_only === 'true') filters.overdue_only = true;

    console.log('API Tickets - Filters appliqués:', filters);
    const tickets = await Ticket.findAll(filters);
    console.log('API Tickets - Nombre de tickets trouvés:', tickets.length);

    res.json({
      success: true,
      data: { tickets }
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tickets'
    });
  }
});

router.get('/stats', verifyToken, requireTeamOrAdmin, async (req, res) => {
  try {
    const stats = await Ticket.getTicketStats();
    const overdueTickets = await Ticket.getOverdueTickets();

    res.json({
      success: true,
      data: { 
        stats,
        overdue_tickets: overdueTickets 
      }
    });
  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

router.get('/overdue', verifyToken, requireTeamOrAdmin, async (req, res) => {
  try {
    const overdueTickets = await Ticket.getOverdueTickets();

    res.json({
      success: true,
      data: { tickets: overdueTickets }
    });
  } catch (error) {
    console.error('Get overdue tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tickets en retard'
    });
  }
});

router.get('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

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
    const comments = await Comment.findByTicketId(ticket.id, includeInternal);

    res.json({
      success: true,
      data: { ticket, comments }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du ticket'
    });
  }
});

router.post('/', verifyToken, validateTicketCreation, async (req, res) => {
  try {
    console.log('=== CRÉATION TICKET ===');
    console.log('User:', req.user.role, 'ID:', req.user.id);
    console.log('Body reçu:', req.body);
    
    const ticketData = { ...req.body };
    
    console.log('Recherche projet ID:', ticketData.project_id);
    const project = await Project.findById(ticketData.project_id);
    console.log('Projet trouvé:', project);
    
    if (!project) {
      console.log('ERREUR: Projet non trouvé');
      return res.status(400).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    if (req.user.role === 'client') {
      if (project.client_id !== req.user.id) {
        console.log('ERREUR: Client non autorisé pour ce projet');
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez créer des tickets que pour vos propres projets'
        });
      }
      ticketData.client_id = req.user.id;
    } else {
      ticketData.client_id = project.client_id;
    }

    console.log('Données ticket finales:', ticketData);
    console.log('Appel Ticket.create()...');
    const ticket = await Ticket.create(ticketData);
    console.log('Ticket créé avec succès:', ticket);

    res.status(201).json({
      success: true,
      message: 'Ticket créé avec succès',
      data: { ticket }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du ticket'
    });
  }
});

router.put('/:id', verifyToken, validateId, validateTicketUpdate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const updates = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    if (req.user.role === 'client') {
      if (ticket.client_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à ce ticket'
        });
      }
      
      delete updates.status;
      delete updates.assigned_to;
    }

    const updatedTicket = await Ticket.update(ticketId, updates);

    res.json({
      success: true,
      message: 'Ticket mis à jour avec succès',
      data: { ticket: updatedTicket }
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du ticket'
    });
  }
});

router.delete('/:id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);

    const deleted = await Ticket.delete(ticketId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Ticket supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du ticket'
    });
  }
});

module.exports = router;