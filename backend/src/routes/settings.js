const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settingsService');
const { verifyToken, requireRole } = require('../middleware/auth');

/**
 * GET /api/settings/client-config
 * Récupère la configuration pour le frontend
 */
router.get('/client-config', async (req, res) => {
  try {
    const config = await SettingsService.getClientConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting client config:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration' });
  }
});

/**
 * GET /api/settings/:key
 * Récupère une valeur de configuration spécifique
 */
router.get('/:key', verifyToken, async (req, res) => {
  try {
    const value = await SettingsService.getSetting(req.params.key);
    if (value === null) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    res.json({ key: req.params.key, value });
  } catch (error) {
    console.error('Error getting setting:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du paramètre' });
  }
});

/**
 * PUT /api/settings/:key
 * Met à jour une valeur de configuration (admin uniquement)
 */
router.put('/:key', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'Valeur requise' });
    }

    const success = await SettingsService.setSetting(req.params.key, value.toString());
    if (success) {
      res.json({ message: 'Paramètre mis à jour avec succès' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du paramètre' });
  }
});

/**
 * GET /api/settings/category/:category
 * Récupère tous les paramètres d'une catégorie
 */
router.get('/category/:category', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const settings = await SettingsService.getSettingsByCategory(req.params.category);
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings by category:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
  }
});

module.exports = router;