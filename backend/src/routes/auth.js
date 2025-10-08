const express = require('express');
const User = require('../models/User');
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  verifyToken
} = require('../middleware/auth');
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

    // Générer les tokens
    const token = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    // Supprimer le hash du mot de passe et les gros fichiers avant de renvoyer l'utilisateur
    const userResponse = { ...user };
    delete userResponse.password_hash;
    delete userResponse.quote_file_decrypted;
    delete userResponse.confidential_file_decrypted;
    delete userResponse.quote_file;
    delete userResponse.confidential_file;

    // Log pour déboguer la taille de la réponse
    console.log('User response size:', JSON.stringify(userResponse).length, 'chars');
    console.log('User response fields:', Object.keys(userResponse));

    console.log(`Connexion réussie pour: ${email} (${user.role})`);

    // Envoyer le refresh token dans un cookie HttpOnly sécurisé
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
    });

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

    // Exclure les gros fichiers pour éviter les problèmes de localStorage
    const userResponse = { ...user };
    delete userResponse.password_hash;
    delete userResponse.quote_file_decrypted;
    delete userResponse.confidential_file_decrypted;
    delete userResponse.quote_file;
    delete userResponse.confidential_file;

    res.json({
      success: true,
      data: { user: userResponse }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

// PUT /auth/profile - Mettre à jour le profil utilisateur
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { first_name, last_name, company, address, city, country } = req.body;
    const userId = req.user.id;

    // Validation des données
    if (first_name && first_name.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Le prénom ne peut pas dépasser 50 caractères'
      });
    }

    if (last_name && last_name.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Le nom ne peut pas dépasser 50 caractères'
      });
    }

    if (company && company.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de l\'entreprise ne peut pas dépasser 100 caractères'
      });
    }

    if (address && address.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'L\'adresse ne peut pas dépasser 200 caractères'
      });
    }

    if (city && city.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'La ville ne peut pas dépasser 100 caractères'
      });
    }

    if (country && country.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Le pays ne peut pas dépasser 100 caractères'
      });
    }

    // Mettre à jour le profil
    await User.updateProfile(userId, {
      first_name: first_name || null,
      last_name: last_name || null,
      company: company || null,
      address: address || null,
      city: city || null,
      country: country || null
    });

    // Récupérer le profil mis à jour
    const updatedUser = await User.findById(userId);

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// Internal helper to handle password change supporting both body styles
const handlePasswordChange = async (req, res) => {
  const current = req.body.currentPassword || req.body.current_password;
  const next = req.body.newPassword || req.body.new_password;

  if (!current || !next) {
    return res.status(400).json({
      success: false,
      message: 'Mot de passe actuel et nouveau mot de passe requis'
    });
  }

  if (next.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
    });
  }

  const user = await User.findByEmail(req.user.email);
  const isValidPassword = await User.validatePassword(user, current);

  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Mot de passe actuel incorrect'
    });
  }

  await User.updatePassword(req.user.id, next);

  return res.json({
    success: true,
    message: 'Mot de passe mis à jour avec succès'
  });
};

// PUT /auth/change-password - Changer le mot de passe
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    await handlePasswordChange(req, res);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe'
    });
  }
});

router.post('/change-password', verifyToken, async (req, res) => {
  try {
    await handlePasswordChange(req, res);
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du mot de passe'
    });
  }
});


router.post('/logout', verifyToken, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
});

// POST /auth/refresh - Rafraîchir le token d'accès
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token manquant'
      });
    }

    const tokenData = await verifyRefreshToken(refreshToken);

    if (!tokenData) {
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide ou expiré'
      });
    }

    const user = await User.findById(tokenData.user_id);

    if (!user || !user.is_active) {
      await revokeRefreshToken(refreshToken);
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        message: 'Utilisateur introuvable ou inactif'
      });
    }

    // Générer un nouveau access token
    const newAccessToken = generateToken(user);

    res.json({
      success: true,
      data: {
        token: newAccessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token'
    });
  }
});

module.exports = router;
