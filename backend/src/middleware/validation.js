const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    console.log('Request body:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  handleValidationErrors
];

const validateUserCreation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('role')
    .isIn(['admin', 'client', 'team', 'developer'])
    .withMessage('Rôle invalide'),
  body('first_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
  body('last_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Le nom de l\'entreprise ne peut excéder 100 caractères'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Le numéro de téléphone ne peut excéder 20 caractères'),
  body('company_address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('L\'adresse de l\'entreprise ne peut excéder 200 caractères'),
  body('siren')
    .optional()
    .trim()
    .isLength({ max: 14 })
    .withMessage('Le SIREN ne peut excéder 14 caractères'),
  handleValidationErrors
];

const validateProjectCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom du projet doit contenir entre 2 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut excéder 1000 caractères'),
  body('client_id')
    .isInt({ min: 1 })
    .withMessage('ID client invalide'),
  handleValidationErrors
];

const validateTicketCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Le titre doit contenir entre 5 et 200 caractères'),
  body('description')
    .trim()
    .isLength({ min: 5, max: 5000 })
    .withMessage('La description doit contenir entre 5 et 5000 caractères'),
  body('priority')
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide'),
  body('project_id')
    .isInt({ min: 1 })
    .withMessage('ID projet invalide'),
  handleValidationErrors
];

const validateTicketUpdate = [
  body('title')
    .optional()
    .trim()
    .custom((value, { req }) => {
      // Si le champ n'est pas dans la requête, on l'ignore
      if (!req.body.hasOwnProperty('title')) return true;
      // Si présent, doit respecter la taille minimale
      if (!value || value.length === 0) return false;
      return value.length >= 5 && value.length <= 200;
    })
    .withMessage('Le titre doit contenir entre 5 et 200 caractères'),
  body('description')
    .optional()
    .trim()
    .custom((value, { req }) => {
      // Si le champ n'est pas dans la requête, on l'ignore
      if (!req.body.hasOwnProperty('description')) {
        return true;
      }
      // Si présent, doit respecter la taille minimale
      if (!value || value.length === 0) {
        return false;
      }
      return value.length >= 5 && value.length <= 5000;
    })
    .withMessage('La description doit contenir entre 5 et 5000 caractères'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'waiting_client', 'resolved', 'closed'])
    .withMessage('Statut invalide'),
  body('assigned_to')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '' || value === undefined) {
        return true; // Permet null/vide pour "non assigné"
      }
      return Number.isInteger(parseInt(value)) && parseInt(value) > 0;
    })
    .withMessage('ID utilisateur assigné invalide'),
  handleValidationErrors
];

const validateCommentCreation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Le commentaire doit contenir entre 1 et 2000 caractères'),
  body('is_internal')
    .optional()
    .isBoolean()
    .withMessage('Le champ is_internal doit être un booléen'),
  handleValidationErrors
];

const validateSLACreation = [
  body('client_id')
    .isInt({ min: 1 })
    .withMessage('ID client invalide'),
  body('priority')
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide'),
  body('response_time_hours')
    .isInt({ min: 1, max: 720 })
    .withMessage('Le temps de réponse doit être entre 1 et 720 heures'),
  body('resolution_time_hours')
    .isInt({ min: 1, max: 8760 })
    .withMessage('Le temps de résolution doit être entre 1 et 8760 heures'),
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID invalide'),
  handleValidationErrors
];

const validateTicketId = [
  param('ticket_id')
    .isInt({ min: 1 })
    .withMessage('ID de ticket invalide'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateUserCreation,
  validateProjectCreation,
  validateTicketCreation,
  validateTicketUpdate,
  validateCommentCreation,
  validateSLACreation,
  validateId,
  validateTicketId
};
