const express = require('express');
const Project = require('../models/Project');
const { verifyToken, requireTeamOrAdmin, requireClientOrOwner } = require('../middleware/auth');
const { validateProjectCreation, validateId } = require('../middleware/validation');

const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage for project-level files (quotes/specs)
const projectFilesDir = path.join(__dirname, '../../uploads/projects');
if (!fs.existsSync(projectFilesDir)) {
  try { fs.mkdirSync(projectFilesDir, { recursive: true }); } catch (e) {}
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, projectFilesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]/gi, '_');
    const fname = `${Date.now()}_${base}${ext}`;
    cb(null, fname);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

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

// === Project-level files (quote & specifications) ===
router.post('/:id/upload-quote', verifyToken, requireTeamOrAdmin, upload.single('quote'), async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Projet non trouvé' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    const publicPath = `/uploads/projects/${req.file.filename}`;
    const updated = await Project.update(projectId, { quote_file: publicPath });
    res.json({ success: true, message: 'Devis uploadé', data: { project: updated } });
  } catch (err) {
    console.error('Upload quote error:', err);
    res.status(500).json({ success: false, message: 'Erreur upload devis' });
  }
});

router.post('/:id/upload-specifications', verifyToken, requireTeamOrAdmin, upload.single('specifications'), async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Projet non trouvé' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    const publicPath = `/uploads/projects/${req.file.filename}`;
    const updated = await Project.update(projectId, { specifications_file: publicPath });
    res.json({ success: true, message: 'Cahier des charges uploadé', data: { project: updated } });
  } catch (err) {
    console.error('Upload specs error:', err);
    res.status(500).json({ success: false, message: 'Erreur upload cahier des charges' });
  }
});

module.exports = router;
