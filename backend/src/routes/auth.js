const express = require('express');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validateLogin } = require('../middleware/validation');

const router = express.Router();

router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation des entrées
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const user = await User.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Log pour débogage sans exposer d'informations sensibles
      console.log(`Tentative de connexion avec email inexistant: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (!user.is_active) {
      console.log(`Tentative de connexion avec compte inactif: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.'
      });
    }

    const isValidPassword = await User.validatePassword(user, password);
    if (!isValidPassword) {
      console.log(`Tentative de connexion avec mot de passe incorrect: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Générer le token
    const token = generateToken(user);

    // Supprimer le hash du mot de passe avant de renvoyer l'utilisateur
    const userResponse = { ...user };
    delete userResponse.password_hash;

    console.log(`Connexion réussie pour: ${email} (${user.role})`);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur. Veuillez réessayer.'
    });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
    }

    const user = await User.findByEmail(req.user.email);
    const isValidPassword = await User.validatePassword(user, current_password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    await User.updatePassword(req.user.id, new_password);

    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe'
    });
  }
});

router.post('/logout', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

module.exports = router;