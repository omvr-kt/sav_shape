const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('saas.db');

// GET /api/invoices - Récupérer toutes les factures (admin) ou les factures du client
router.get('/', verifyToken, (req, res) => {
  const { status, client_id } = req.query;
  
  let sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
  `;
  
  const conditions = [];
  const params = [];
  
  // Si c'est un client, il ne peut voir que ses factures
  if (req.user.role === 'client') {
    conditions.push('i.client_id = ?');
    params.push(req.user.userId);
  } else if (client_id) {
    // Admin peut filtrer par client_id
    conditions.push('i.client_id = ?');
    params.push(client_id);
  }
  
  // Filtre par statut
  if (status) {
    conditions.push('i.status = ?');
    params.push(status);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  sql += ' ORDER BY i.created_at DESC';
  
  db.all(sql, params, (err, invoices) => {
    if (err) {
      console.error('Erreur récupération factures:', err);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }

    res.json({
      success: true,
      data: { invoices }
    });
  });
});

/**
 * Génère un numéro de facture unique
 */
function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  return `SHAPE-${year}${month}-${timestamp}`;
}

/**
 * Calcule les montants TVA
 */
function calculateTVA(amountHT, tvaRate = 20.00) {
  const amountTVA = Math.round(amountHT * (tvaRate / 100) * 100) / 100;
  const amountTTC = Math.round((amountHT + amountTVA) * 100) / 100;
  return { 
    amount_tva: amountTVA, 
    amount_ttc: amountTTC 
  };
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
    LEFT JOIN users u ON i.client_id = u.id
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
    SELECT i.*, 
           CASE 
             WHEN i.client_first_name IS NOT NULL 
             THEN i.client_first_name 
             ELSE u.first_name 
           END as first_name,
           CASE 
             WHEN i.client_last_name IS NOT NULL 
             THEN i.client_last_name 
             ELSE u.last_name 
           END as last_name,
           CASE 
             WHEN i.client_email IS NOT NULL 
             THEN i.client_email 
             ELSE u.email 
           END as email,
           CASE 
             WHEN i.client_company IS NOT NULL 
             THEN i.client_company 
             ELSE u.company 
           END as company
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
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
  body('amount_ht').isFloat({ min: 0 }).withMessage('Montant HT invalide'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Description requise (max 1000 caractères)'),
  body('tva_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide'),
  body('no_tva').optional().isBoolean().withMessage('Paramètre no_tva invalide'),
  handleValidationErrors
], async (req, res) => {

  const { client_id, amount_ht, description, tva_rate = 20.00, no_tva = false } = req.body;

  try {
    // D'abord récupérer les informations actuelles du client
    const clientSQL = 'SELECT first_name, last_name, email, company FROM users WHERE id = ?';
    
    db.get(clientSQL, [client_id], (err, client) => {
      if (err) {
        console.error('Erreur récupération client:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la récupération du client'
        });
      }
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }

      // Calculer la TVA
      const finalTvaRate = no_tva ? 0 : tva_rate;
      const { amount_tva, amount_ttc } = calculateTVA(amount_ht, finalTvaRate);
      
      const invoiceNumber = generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const sql = `
        INSERT INTO invoices (
          invoice_number, client_id, amount_ht, tva_rate, amount_tva, amount_ttc, 
          description, status, due_date, client_first_name, client_last_name, client_email, client_company
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        invoiceNumber, 
        client_id, 
        amount_ht, 
        finalTvaRate, 
        amount_tva, 
        amount_ttc, 
        description, 
        dueDate.toISOString(),
        client.first_name,
        client.last_name,
        client.email,
        client.company
      ], function(err) {
      if (err) {
        console.error('Erreur création facture:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création de la facture'
        });
      }

        // Récupérer la facture créée avec les infos client
        const getInvoiceSQL = `
          SELECT i.*, u.first_name, u.last_name, u.email, u.company
          FROM invoices i
          LEFT JOIN users u ON i.client_id = u.id
          WHERE i.id = ?
        `;
        
        db.get(getInvoiceSQL, [this.lastID], (err, invoice) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la récupération de la facture'
            });
          }

          res.status(201).json({
            success: true,
            message: 'Facture créée avec succès',
            data: { invoice }
          });
        });
      });
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

// PUT /api/invoices/:id - Mettre à jour une facture complète (admin uniquement)
router.put('/:id', [
  verifyToken,
  requireAdmin,
  body('amount_ht').optional().isFloat({ min: 0 }).withMessage('Montant HT invalide'),
  body('tva_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide'),
  body('description').optional().trim().isLength({ min: 1, max: 1000 }).withMessage('Description invalide (max 1000 caractères)'),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('Statut invalide'),
  handleValidationErrors
], (req, res) => {

  const invoiceId = parseInt(req.params.id);
  const { amount_ht, tva_rate, description, status } = req.body;

  try {
    // Récupérer la facture actuelle pour garder les valeurs non modifiées
    const getInvoiceSQL = `
      SELECT * FROM invoices WHERE id = ?
    `;
    
    db.get(getInvoiceSQL, [invoiceId], (err, currentInvoice) => {
      if (err) {
        console.error('Erreur récupération facture:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }

      if (!currentInvoice) {
        return res.status(404).json({
          success: false,
          message: 'Facture non trouvée'
        });
      }

      // Utiliser les nouvelles valeurs ou garder les anciennes
      const newAmountHt = amount_ht !== undefined ? parseFloat(amount_ht) : parseFloat(currentInvoice.amount_ht);
      const newTvaRate = tva_rate !== undefined ? parseFloat(tva_rate) : parseFloat(currentInvoice.tva_rate);
      const newDescription = description !== undefined ? description : currentInvoice.description;
      const newStatus = status !== undefined ? status : currentInvoice.status;

      // Recalculer la TVA avec les nouveaux montants
      const { amount_tva, amount_ttc } = calculateTVA(newAmountHt, newTvaRate);

      // Construire la requête de mise à jour
      let updateSql = `
        UPDATE invoices 
        SET amount_ht = ?, tva_rate = ?, amount_tva = ?, amount_ttc = ?, 
            description = ?, status = ?, updated_at = datetime('now', 'localtime')
      `;
      let params = [newAmountHt, newTvaRate, amount_tva, amount_ttc, newDescription, newStatus];

      // Si le statut devient "paid", ajouter la date de paiement
      if (newStatus === 'paid' && currentInvoice.status !== 'paid') {
        updateSql += ', paid_date = datetime(\'now\', \'localtime\')';
      }

      updateSql += ' WHERE id = ?';
      params.push(invoiceId);

      db.run(updateSql, params, function(err) {
        if (err) {
          console.error('Erreur mise à jour facture:', err);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour'
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            message: 'Facture non trouvée'
          });
        }

        // Récupérer la facture mise à jour avec les infos client
        const getUpdatedInvoiceSQL = `
          SELECT i.*, u.first_name, u.last_name, u.email, u.company
          FROM invoices i
          LEFT JOIN users u ON i.client_id = u.id
          WHERE i.id = ?
        `;
        
        db.get(getUpdatedInvoiceSQL, [invoiceId], (err, updatedInvoice) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la récupération de la facture mise à jour'
            });
          }

          res.json({
            success: true,
            message: 'Facture mise à jour avec succès',
            data: { invoice: updatedInvoice }
          });
        });
      });
    });
  } catch (error) {
    console.error('Erreur mise à jour facture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la facture'
    });
  }
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


// GET /api/invoices/:id/pdf - Télécharger la facture en PDF
router.get('/:id/pdf', verifyToken, (req, res) => {
  const invoiceId = parseInt(req.params.id);

  const sql = `
    SELECT i.*, 
           CASE 
             WHEN i.client_first_name IS NOT NULL 
             THEN i.client_first_name 
             ELSE u.first_name 
           END as first_name,
           CASE 
             WHEN i.client_last_name IS NOT NULL 
             THEN i.client_last_name 
             ELSE u.last_name 
           END as last_name,
           CASE 
             WHEN i.client_email IS NOT NULL 
             THEN i.client_email 
             ELSE u.email 
           END as email,
           CASE 
             WHEN i.client_company IS NOT NULL 
             THEN i.client_company 
             ELSE u.company 
           END as company
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
    WHERE i.id = ?
  `;

  db.get(sql, [invoiceId], (err, invoice) => {
    if (err) {
      console.error('Erreur récupération facture pour PDF:', err);
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

    // Retourner les données pour génération PDF côté client
    res.json({
      success: true,
      data: { invoice }
    });
  });
});

module.exports = { router, createAutomaticInvoice };