const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Token manquant.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou utilisateur inactif.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Token invalide.' 
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

    if (req.user.role === 'admin' || req.user.role === 'team') {
      return next();
    }

    if (req.user.role === 'client') {
      const resourceClientId = req.params.client_id || req.body.client_id;
      if (resourceClientId && parseInt(resourceClientId) === req.user.id) {
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