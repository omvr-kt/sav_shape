const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET non défini dans les variables d\'environnement');
  }

  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant ou format invalide.' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant.' 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return res.status(401).json({ 
        success: false, 
        message: jwtError.name === 'TokenExpiredError' ? 'Token expiré.' : 'Token invalide.' 
      });
    }

    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur introuvable.' 
      });
    }

    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Compte utilisateur désactivé.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne lors de la vérification du token.' 
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Permissions insuffisantes.' 
      });
    }

    next();
  };
};

const requireAdmin = requireRole('admin');
const requireTeamOrAdmin = requireRole('team', 'admin');

const requireClientOrOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise.' 
      });
    }

    // Admin et team ont accès à tout
    if (req.user.role === 'admin' || req.user.role === 'team') {
      return next();
    }

    // Pour les clients, vérifier qu'ils accèdent à leurs propres ressources
    if (req.user.role === 'client') {
      const resourceClientId = req.params.client_id || req.body.client_id || req.query.client_id;
      
      // Si aucun client_id spécifié, permettre l'accès (pour les requêtes générales)
      if (!resourceClientId) {
        return next();
      }
      
      // Vérifier que le client accède à ses propres ressources
      if (parseInt(resourceClientId) === req.user.id) {
        return next();
      }
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Accès non autorisé à cette ressource.' 
    });
  } catch (error) {
    console.error('Permission middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur de validation des permissions.' 
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  requireRole,
  requireAdmin,
  requireTeamOrAdmin,
  requireClientOrOwner
};