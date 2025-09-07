const { db } = require('../src/utils/database');

/**
 * Migration pour ajouter les champs d'adresse aux factures
 * Permet de capturer l'adresse du client au moment de la création de la facture
 */

async function addInvoiceAddressFields() {
  try {
    // Vérifier si les colonnes existent déjà
    const tableInfo = await db.all("PRAGMA table_info(invoices)");
    const existingColumns = tableInfo.map(col => col.name);
    
    const columnsToAdd = [
      { name: 'client_address', sql: 'ALTER TABLE invoices ADD COLUMN client_address TEXT' },
      { name: 'client_city', sql: 'ALTER TABLE invoices ADD COLUMN client_city TEXT' },
      { name: 'client_country', sql: 'ALTER TABLE invoices ADD COLUMN client_country TEXT' }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        await db.run(column.sql);
        console.log(`Colonne ${column.name} ajoutée à la table invoices`);
      } else {
        console.log(`Colonne ${column.name} existe déjà dans la table invoices`);
      }
    }
    
    console.log('Migration des champs d\'adresse de facture terminée avec succès');
    
  } catch (error) {
    console.error('Erreur lors de la migration des champs d\'adresse de facture:', error);
    throw error;
  }
}

// Exécuter la migration si le fichier est appelé directement
if (require.main === module) {
  const { initDatabase } = require('../src/utils/database');
  
  initDatabase()
    .then(() => addInvoiceAddressFields())
    .then(() => {
      console.log('Migration terminée');
      process.exit(0);
    })
    .catch(error => {
      console.error('Erreur:', error);
      process.exit(1);
    });
}

module.exports = { addInvoiceAddressFields };
