const express = require('express');
const SLA = require('../models/SLA');
const { verifyToken, requireTeamOrAdmin } = require('../middleware/auth');
const { validateSLACreation, validateId } = require('../middleware/validation');

const router = express.Router();

router.get('/', verifyToken, requireTeamOrAdmin, async (req, res) => {
  try {
    const slaRules = await SLA.findAll();

    res.json({
      success: true,
      data: { sla_rules: slaRules }
    });
  } catch (error) {
    console.error('Get SLA rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des règles SLA'
    });
  }
});

router.get('/client/:client_id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const clientId = parseInt(req.params.client_id);
    const slaRules = await SLA.findByClient(clientId);

    res.json({
      success: true,
      data: { sla_rules: slaRules }
    });
  } catch (error) {
    console.error('Get client SLA rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des règles SLA du client'
    });
  }
});

router.post('/', verifyToken, requireTeamOrAdmin, validateSLACreation, async (req, res) => {
  try {
    const slaData = req.body;
    const slaRule = await SLA.create(slaData);

    res.status(201).json({
      success: true,
      message: 'Règle SLA créée avec succès',
      data: { sla_rule: slaRule }
    });
  } catch (error) {
    console.error('Create SLA rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la règle SLA'
    });
  }
});

router.put('/:id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const slaId = parseInt(req.params.id);
    const updates = req.body;

    const slaRule = await SLA.findById(slaId);
    if (!slaRule) {
      return res.status(404).json({
        success: false,
        message: 'Règle SLA non trouvée'
      });
    }

    const updatedSLARule = await SLA.update(slaId, updates);

    res.json({
      success: true,
      message: 'Règle SLA mise à jour avec succès',
      data: { sla_rule: updatedSLARule }
    });
  } catch (error) {
    console.error('Update SLA rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la règle SLA'
    });
  }
});

router.delete('/:id', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const slaId = parseInt(req.params.id);

    const deleted = await SLA.delete(slaId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Règle SLA non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Règle SLA supprimée avec succès'
    });
  } catch (error) {
    console.error('Delete SLA rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la règle SLA'
    });
  }
});

router.post('/client/:client_id/defaults', verifyToken, requireTeamOrAdmin, validateId, async (req, res) => {
  try {
    const clientId = parseInt(req.params.client_id);
    
    await SLA.createDefaultSLAs(clientId);

    res.json({
      success: true,
      message: 'Règles SLA par défaut créées avec succès'
    });
  } catch (error) {
    console.error('Create default SLA rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des règles SLA par défaut'
    });
  }
});

module.exports = router;