const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { db } = require('../utils/database');
const SettingsService = require('../services/settingsService');
const emailService = require('../services/email');
const { templates } = require('../config/email-templates');

// Démarrer le scheduler automatique pour les factures en retard
let overdueScheduler = null;

/**
 * Démarre le scheduler automatique des factures en retard
 */
function startOverdueScheduler() {
  if (overdueScheduler) {
    clearInterval(overdueScheduler);
  }
  
  // Vérifier toutes les heures (3600000 ms = 1 heure)
  overdueScheduler = setInterval(async () => {
    console.log('Vérification automatique des factures en retard...');
    await updateOverdueInvoices();
  }, 3600000); // 1 heure
  
  console.log('Scheduler des factures en retard démarré (vérification toutes les heures)');
}

/**
 * Met à jour automatiquement les factures en retard
 */
async function updateOverdueInvoices() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    const sql = `
      UPDATE invoices 
      SET status = 'overdue', updated_at = datetime('now', 'localtime')
      WHERE status = 'sent' 
      AND due_date < ?
      AND due_date IS NOT NULL
    `;
    
    const result = await db.run(sql, [today]);
    
    if (result.changes > 0) {
      console.log(`${result.changes} facture(s) mise(s) à jour en retard`);
    }
    
    return result.changes;
  } catch (error) {
    console.error('Erreur mise à jour factures en retard:', error);
    return 0;
  }
}

// GET /api/invoices - Récupérer toutes les factures (admin) ou les factures du client
router.get('/', verifyToken, async (req, res) => {
  const { status, client_id } = req.query;
  
  // Mettre à jour les factures en retard automatiquement
  await updateOverdueInvoices();
  
  let sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company, u.address, u.city, u.country
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
  `;
  
  const conditions = [];
  const params = [];
  
  // Si c'est un client, il ne peut voir que ses factures
  if (req.user.role === 'client') {
    conditions.push('i.client_id = ?');
    params.push(req.user.id);
    console.log('Client filter applied:', { userId: req.user.id, userIdType: typeof req.user.id });
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
  
  try {
    const invoices = await db.all(sql, params);
    res.json({
      success: true,
      data: { invoices }
    });
  } catch (err) {
    console.error('Erreur récupération factures:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

/**
 * Génère un numéro de facture unique
 */
async function generateInvoiceNumber() {
  const config = await SettingsService.getInvoicingConfig();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  try {
    // Récupérer le compteur global des factures
    let counter = await db.get(
      "SELECT counter_value FROM counters WHERE counter_type = 'invoice' AND counter_key = 'global'",
      []
    );
    
    let nextNumber = 50; // Commence à 50 par défaut
    
    if (counter) {
      nextNumber = counter.counter_value + 1;
      // Mettre à jour le compteur
      await db.run(
        "UPDATE counters SET counter_value = ?, updated_at = datetime('now', 'localtime') WHERE counter_type = 'invoice' AND counter_key = 'global'",
        [nextNumber]
      );
    } else {
      // Créer le compteur s'il n'existe pas
      await db.run(
        "INSERT INTO counters (counter_type, counter_key, counter_value) VALUES ('invoice', 'global', ?)",
        [nextNumber]
      );
    }
    
    return `${config.prefix}-${year}${month}-${nextNumber}`;
  } catch (error) {
    console.error('Erreur génération numéro facture:', error);
    // Fallback avec timestamp si erreur
    const timestamp = Date.now().toString().slice(-6);
    return `${config.prefix}-${year}${month}-${timestamp}`;
  }
}

/**
 * Calcule les montants TVA
 */
async function calculateTVA(amountHT, tvaRate = null) {
  if (tvaRate === null) {
    const config = await SettingsService.getInvoicingConfig();
    tvaRate = config.defaultTvaRate;
  }
  
  const amountTVA = Math.round(amountHT * (tvaRate / 100) * 100) / 100;
  const amountTTC = Math.round((amountHT + amountTVA) * 100) / 100;
  return { 
    amount_tva: amountTVA, 
    amount_ttc: amountTTC,
    tva_rate: tvaRate
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
  try {
    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // Échéance à 7 jours

    let finalAmount = amount;
    let tvaAmount = null;
    let ttcAmount = null;
    let tvaRate = null;

    if (amount) {
      const tvaCalc = await calculateTVA(amount);
      tvaAmount = tvaCalc.amount_tva;
      ttcAmount = tvaCalc.amount_ttc;
      tvaRate = tvaCalc.tva_rate;
    }

    const sql = `
      INSERT INTO invoices (invoice_number, client_id, quote_file, specifications_file, amount_ht, amount_tva, amount_ttc, tva_rate, description, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `;

    const result = await db.run(sql, [invoiceNumber, clientId, quoteFile, specificationsFile, finalAmount, tvaAmount, ttcAmount, tvaRate, description, dueDate.toISOString()]);
    console.log(`Facture automatique créée: ${invoiceNumber} pour le client ${clientId}`);
    
    // Récupérer la facture créée
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [result.id]);
    return invoice;
  } catch (err) {
    console.error('Erreur création facture automatique:', err);
    throw err;
  }
}


// GET /api/invoices/client/:clientId - Récupérer les factures d'un client
router.get('/client/:clientId', verifyToken, async (req, res) => {
  const clientId = parseInt(req.params.clientId);

  // Vérifier que le clientId est valide
  if (isNaN(clientId) || clientId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'ID client invalide'
    });
  }

  // Mettre à jour les factures en retard automatiquement
  await updateOverdueInvoices();
  
  console.log('Invoice access attempt:', {
    requestedClientId: clientId,
    userRole: req.user.role,
    userId: req.user.id
  });

  // Vérifier les permissions
  console.log('Client invoices access check:', {
    userRole: req.user.role,
    userId: req.user.id,
    userIdType: typeof req.user.id,
    requestedClientId: clientId,
    clientIdType: typeof clientId,
    comparison: req.user.id == clientId
  });
  
  if (req.user.role !== 'admin' && req.user.id != clientId) {
    console.log('Permission denied for client invoices access');
    return res.status(403).json({
      success: false,
      message: 'Accès refusé'
    });
  }

  const sql = `
    SELECT i.*, u.first_name, u.last_name, u.email, u.company, u.address, u.city, u.country
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
    WHERE i.client_id = ?
    ORDER BY i.created_at DESC
  `;

  try {
    const rows = await db.all(sql, [clientId]);
    res.json({
      success: true,
      data: {
        invoices: rows
      }
    });
  } catch (err) {
    console.error('Erreur récupération factures client:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/invoices/:id - Récupérer une facture spécifique
router.get('/:id', verifyToken, async (req, res) => {
  const invoiceId = parseInt(req.params.id);

  // Mettre à jour les factures en retard automatiquement
  await updateOverdueInvoices();

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

  try {
    const invoice = await db.get(sql, [invoiceId]);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Vérifier les permissions
    console.log('GET Invoice Permission check:', {
      userRole: req.user.role,
      userId: req.user.id,
      userIdType: typeof req.user.id,
      invoiceClientId: invoice.client_id,
      invoiceClientIdType: typeof invoice.client_id,
      comparison: req.user.id == invoice.client_id
    });
    
    if (req.user.role !== 'admin' && req.user.id != invoice.client_id) {
      console.log('Permission denied for GET invoice access');
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
  } catch (err) {
    console.error('Erreur récupération facture:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
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
    const client = await db.get(clientSQL, [client_id]);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Calculer la TVA
    const finalTvaRate = no_tva ? 0 : tva_rate;
    const { amount_tva, amount_ttc } = await calculateTVA(amount_ht, finalTvaRate);
    
    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const sql = `
      INSERT INTO invoices (
        invoice_number, client_id, amount_ht, tva_rate, amount_tva, amount_ttc, 
        description, status, due_date, client_first_name, client_last_name, client_email, client_company,
        client_address, client_city, client_country
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.run(sql, [
      invoiceNumber, 
      client_id, 
      amount_ht, 
      finalTvaRate, 
      amount_tva, 
      amount_ttc, 
      description, 
      dueDate.toISOString().split('T')[0], // Format date only (YYYY-MM-DD)
      client.first_name || '',
      client.last_name || '',
      client.email || '',
      client.company || '',
      client.address || '',
      client.city || '',
      client.country || ''
    ]);

    // Récupérer la facture créée avec les infos client
    const getInvoiceSQL = `
      SELECT i.*, u.first_name, u.last_name, u.email, u.company, u.address, u.city, u.country
      FROM invoices i
      LEFT JOIN users u ON i.client_id = u.id
      WHERE i.id = ?
    `;
    
    const invoice = await db.get(getInvoiceSQL, [result.id]);

    // Envoyer notification au client pour la nouvelle facture
    try {
      const invoiceData = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        issue_date: new Date().toISOString(),
        due_date: invoice.due_date,
        subtotal: parseFloat(invoice.amount_ht),
        tax_rate: parseFloat(invoice.tva_rate),
        tax_amount: parseFloat(invoice.amount_tva),
        total: parseFloat(invoice.amount_ttc),
        status: invoice.status,
        description: invoice.description
      };

      const emailHtml = templates.newInvoiceForClient(invoiceData, client);
      
      await emailService.sendMail({
        from: process.env.SMTP_FROM,
        to: client.email,
        subject: `Nouvelle facture ${invoice.invoice_number} - Shape Conseil`,
        html: emailHtml
      });
      console.log('Notification facture envoyée au client:', client.email);
    } catch (emailError) {
      console.error('Erreur envoi notification facture:', emailError);
    }

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
], async (req, res) => {

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

  try {
    const result = await db.run(updateSql, params);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Statut de la facture mis à jour'
    });
  } catch (err) {
    console.error('Erreur mise à jour facture:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// PUT /api/invoices/:id - Mettre à jour une facture complète (admin uniquement)
router.put('/:id', [
  verifyToken,
  requireAdmin,
  body('amount_ht').optional().isFloat({ min: 0 }).withMessage('Montant HT invalide'),
  body('tva_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Taux TVA invalide'),
  body('description').optional().trim().isLength({ min: 1, max: 1000 }).withMessage('Description invalide (max 1000 caractères)'),
  body('status').optional().isIn(['sent', 'paid', 'overdue', 'cancelled']).withMessage('Statut invalide'),
  handleValidationErrors
], async (req, res) => {

  const invoiceId = parseInt(req.params.id);
  const { amount_ht, tva_rate, description, status } = req.body;

  try {
    // Récupérer la facture actuelle pour garder les valeurs non modifiées
    const getInvoiceSQL = `
      SELECT * FROM invoices WHERE id = ?
    `;
    
    const currentInvoice = await db.get(getInvoiceSQL, [invoiceId]);

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
    const { amount_tva, amount_ttc } = await calculateTVA(newAmountHt, newTvaRate);

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

    const result = await db.run(updateSql, params);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Récupérer la facture mise à jour avec les infos client
    const getUpdatedInvoiceSQL = `
      SELECT i.*, u.first_name, u.last_name, u.email, u.company, u.address, u.city, u.country
      FROM invoices i
      LEFT JOIN users u ON i.client_id = u.id
      WHERE i.id = ?
    `;
    
    const updatedInvoice = await db.get(getUpdatedInvoiceSQL, [invoiceId]);

    res.json({
      success: true,
      message: 'Facture mise à jour avec succès',
      data: { invoice: updatedInvoice }
    });
  } catch (error) {
    console.error('Erreur mise à jour facture:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la facture',
      error: error.message
    });
  }
});

// DELETE /api/invoices/:id - Supprimer une facture (admin uniquement)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {

  const invoiceId = parseInt(req.params.id);

  try {
    const result = await db.run('DELETE FROM invoices WHERE id = ?', [invoiceId]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Facture supprimée avec succès'
    });
  } catch (err) {
    console.error('Erreur suppression facture:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/invoices/:id/files/:type - Télécharger les fichiers associés à une facture (devis ou cahier des charges)
router.get('/:id/files/:type', verifyToken, async (req, res) => {
  const invoiceId = parseInt(req.params.id);
  const fileType = req.params.type;
  
  // Vérifier que le type de fichier est valide
  if (!['quote', 'specifications'].includes(fileType)) {
    return res.status(400).json({
      success: false,
      message: 'Type de fichier invalide'
    });
  }
  
  const sql = `
    SELECT i.*, u.id as user_id
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
    WHERE i.id = ?
  `;
  
  try {
    const invoice = await db.get(sql, [invoiceId]);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }
    
    // Vérifier les permissions
    if (req.user.role !== 'admin' && req.user.id != invoice.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }
    
    // Déterminer le champ à récupérer
    const fileField = fileType === 'quote' ? 'quote_file' : 'specifications_file';
    const filePath = invoice[fileField];
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: `Aucun ${fileType === 'quote' ? 'devis' : 'cahier des charges'} associé à cette facture`
      });
    }
    
    // Construire le chemin complet du fichier
    const path = require('path');
    const fs = require('fs');
    let fullPath;
    
    // Si le chemin commence par /uploads, c'est un chemin relatif
    if (filePath.startsWith('/uploads/')) {
      fullPath = path.join(__dirname, '../..', filePath);
    } else if (filePath.startsWith('uploads/')) {
      fullPath = path.join(__dirname, '../..', filePath);
    } else {
      // Chemin absolu ou autre format
      fullPath = filePath;
    }
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(fullPath)) {
      console.error(`Fichier non trouvé: ${fullPath}`);
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }
    
    // Obtenir le nom du fichier pour le téléchargement
    const fileName = path.basename(filePath);
    
    // Configurer les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Envoyer le fichier
    res.sendFile(path.resolve(fullPath));
    
  } catch (err) {
    console.error('Erreur téléchargement fichier facture:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});


// GET /api/invoices/:id/pdf - Télécharger la facture en PDF
router.get('/:id/pdf', verifyToken, async (req, res) => {
  const invoiceId = parseInt(req.params.id);

  // Mettre à jour les factures en retard automatiquement
  await updateOverdueInvoices();

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
           END as company,
           CASE 
             WHEN i.client_address IS NOT NULL 
             THEN i.client_address 
             ELSE u.address 
           END as address,
           CASE 
             WHEN i.client_city IS NOT NULL 
             THEN i.client_city 
             ELSE u.city 
           END as city,
           CASE 
             WHEN i.client_country IS NOT NULL 
             THEN i.client_country 
             ELSE u.country 
           END as country
    FROM invoices i
    LEFT JOIN users u ON i.client_id = u.id
    WHERE i.id = ?
  `;

  try {
    const invoice = await db.get(sql, [invoiceId]);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Vérifier les permissions
    console.log('PDF Permission check:', {
      userRole: req.user.role,
      userId: req.user.id,
      userIdType: typeof req.user.id,
      invoiceClientId: invoice.client_id,
      invoiceClientIdType: typeof invoice.client_id,
      userObject: req.user,
      comparison: req.user.id === invoice.client_id,
      strictComparison: req.user.id === invoice.client_id,
      looseComparison: req.user.id == invoice.client_id
    });
    
    if (req.user.role !== 'admin' && req.user.id != invoice.client_id) {
      console.log('Permission denied for PDF access');
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
  } catch (err) {
    console.error('Erreur récupération facture pour PDF:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Démarrer le scheduler automatiquement
startOverdueScheduler();

// Exécuter une première vérification immédiatement après l'initialisation de la DB
setTimeout(() => {
  updateOverdueInvoices().then(count => {
    if (count > 0) {
      console.log(`${count} facture(s) mise(s) à jour en retard au démarrage`);
    }
  }).catch(err => {
    console.error('Erreur lors de la vérification initiale des factures en retard:', err);
  });
}, 1000);

module.exports = { router, createAutomaticInvoice, startOverdueScheduler, updateOverdueInvoices };