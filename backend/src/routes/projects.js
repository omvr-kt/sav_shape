const express = require('express');
const Project = require('../models/Project');
const { verifyToken, requireTeamOrAdmin, requireClientOrOwner } = require('../middleware/auth');
const { validateProjectCreation, validateId } = require('../middleware/validation');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let filters = {};

    if (req.user.role === 'client') {
      filters.client_id = req.user.id;
    } else if (client_id) {
      filters.client_id = client_id;
    }

    if (status) filters.status = status;

    const projects = await Project.findAll(filters);

    res.json({
      success: true,
      data: { projects }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des projets'
    });
  }
});

router.get('/:id', verifyToken, validateId, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    if (req.user.role === 'client' && project.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }

    const stats = await Project.getProjectStats(project.id);

    res.json({
      success: true,
      data: { project, stats }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du projet'
    });
  }
});

router.post('/', verifyToken, requireTeamOrAdmin, validateProjectCreation, async (req, res) => {
  try {
    const projectData = req.body;
    const project = await Project.create(projectData);

    res.status(201).json({
      success: true,
      message: 'Projet créé avec succès',
      data: { project }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du projet'
    });
  }
});

router.put('/:id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const updates = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    const updatedProject = await Project.update(projectId, updates);

    res.json({
      success: true,
      message: 'Projet mis à jour avec succès',
      data: { project: updatedProject }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du projet'
    });
  }
});

router.delete('/:id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    const deleted = await Project.delete(projectId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du projet'
    });
  }
});

router.get('/:id/stats', verifyToken, validateId, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    if (req.user.role === 'client' && project.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce projet'
      });
    }

    const stats = await Project.getProjectStats(project.id);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques du projet'
    });
  }
});

module.exports = router;