const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('saas.db');

/**
 * Génère un numéro de facture unique
 */
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}${month}-${timestamp}`;
}

/**
 * Créer une facture automatiquement lors de l'inscription d'un client
 * @param {number} clientId - ID du client
 * @param {string} quoteFile - Fichier devis
 * @param {string} specificationsFile - Fichier cahier des charges
 * @param {number} amount - Montant (optionnel)
 * @param {string} description - Description
 * @returns {Promise<Object>} - Facture créée
 */
async function createAutomaticInvoice(clientId, quoteFile = null, specificationsFile = null, amount = null, description = 'Facture automatique générée lors de l\'inscription') {
  return new Promise((resolve, reject) => {
    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Échéance à 30 jours

    const sql = `
      INSERT INTO invoices (invoice_number, client_id, quote_file, specifications_file, amount, description, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `;

    db.run(sql, [invoiceNumber, clientId, quoteFile, specificationsFile, amount, description, dueDate.toISOString()], function(err) {
      if (err) {
        console.error('Erreur création facture automatique:', err);
        reject(err);
      } else {
        console.log(`✅ Facture automatique créée: ${invoiceNumber} pour le client ${clientId}`);
        
        // Récupérer la facture créée
        db.get('SELECT * FROM invoices WHERE id = ?', [this.lastID], (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice);
          }
        });
      }
    });
  });
}

// GET /api/invoices - Récupérer toutes les factures (admin uniquement)
router.get('/', verifyToken, requireAdmin, (req, res) => {

  const sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company
    FROM invoices i
    JOIN users u ON i.client_id = u.id
    ORDER BY i.created_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Erreur récupération factures:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    res.json({
      success: true,
      data: {
        invoices: rows
      }
    });
  });
});

// GET /api/invoices/client/:clientId - Récupérer les factures d'un client
router.get('/client/:clientId', verifyToken, (req, res) => {
  const clientId = parseInt(req.params.clientId);

  // Vérifier les permissions
  if (req.user.role !== 'admin' && req.user.userId !== clientId) {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé'
    });
  }

  const sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company
    FROM invoices i
    JOIN users u ON i.client_id = u.id
    WHERE i.client_id = ?
    ORDER BY i.created_at DESC
  `;

  db.all(sql, [clientId], (err, rows) => {
    if (err) {
      console.error('Erreur récupération factures client:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    res.json({
      success: true,
      data: {
        invoices: rows
      }
    });
  });
});

// GET /api/invoices/:id - Récupérer une facture spécifique
router.get('/:id', verifyToken, (req, res) => {
  const invoiceId = parseInt(req.params.id);

  const sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company
    FROM invoices i
    JOIN users u ON i.client_id = u.id
    WHERE i.id = ?
  `;

  db.get(sql, [invoiceId], (err, invoice) => {
    if (err) {
      console.error('Erreur récupération facture:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && req.user.userId !== invoice.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    res.json({
      success: true,
      data: {
        invoice
      }
    });
  });
});

// POST /api/invoices - Créer une nouvelle facture (admin uniquement)
router.post('/', [
  verifyToken,
  requireAdmin,
  body('client_id').isInt({ min: 1 }).withMessage('ID client invalide'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Montant invalide'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description trop longue'),
  handleValidationErrors
], async (req, res) => {

  const { client_id, amount, description, quote_file, specifications_file } = req.body;

  try {
    const invoice = await createAutomaticInvoice(client_id, quote_file, specifications_file, amount, description);
    
    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: { invoice }
    });
  } catch (error) {
    console.error('Erreur création facture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture'
    });
  }
});

// PUT /api/invoices/:id/status - Mettre à jour le statut d'une facture
router.put('/:id/status', [
  verifyToken,
  requireAdmin,
  body('status').isIn(['pending', 'paid', 'overdue', 'cancelled']).withMessage('Statut invalide'),
  handleValidationErrors
], (req, res) => {

  const invoiceId = parseInt(req.params.id);
  const { status } = req.body;

  let updateSql = 'UPDATE invoices SET status = ?, updated_at = datetime(\'now\', \'localtime\')';
  let params = [status];

  // Si le statut est "paid", ajouter la date de paiement
  if (status === 'paid') {
    updateSql += ', paid_date = datetime(\'now\', \'localtime\')';
  }

  updateSql += ' WHERE id = ?';
  params.push(invoiceId);

  db.run(updateSql, params, function(err) {
    if (err) {
      console.error('Erreur mise à jour facture:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Statut de la facture mis à jour'
    });
  });
});

// DELETE /api/invoices/:id - Supprimer une facture (admin uniquement)
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {

  const invoiceId = parseInt(req.params.id);

  db.run('DELETE FROM invoices WHERE id = ?', [invoiceId], function(err) {
    if (err) {
      console.error('Erreur suppression facture:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Facture supprimée avec succès'
    });
  });
});

module.exports = { router, createAutomaticInvoice };