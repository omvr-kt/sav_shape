const { db, initDatabase } = require('../src/utils/database');

/**
 * Migration pour ajouter les champs adresse, ville et pays aux clients
 */
async function addClientAddressFields() {
  try {
    // Initialiser la connexion à la base de données
    await db.connect();
    
    console.log('Ajout des champs adresse, ville et pays à la table users...');
    
    // Vérifier si les colonnes existent déjà
    const tableInfo = await db.all("PRAGMA table_info(users)");
    const hasAddress = tableInfo.some(col => col.name === 'address');
    const hasCity = tableInfo.some(col => col.name === 'city');
    const hasCountry = tableInfo.some(col => col.name === 'country');
    
    // Ajouter les nouveaux champs s'ils n'existent pas
    if (!hasAddress) {
      await db.run(`ALTER TABLE users ADD COLUMN address TEXT`);
      console.log('✅ Champ address ajouté');
    } else {
      console.log('ℹ️ Champ address existe déjà');
    }
    
    if (!hasCity) {
      await db.run(`ALTER TABLE users ADD COLUMN city TEXT`);
      console.log('✅ Champ city ajouté');
    } else {
      console.log('ℹ️ Champ city existe déjà');
    }
    
    if (!hasCountry) {
      await db.run(`ALTER TABLE users ADD COLUMN country TEXT`);
      console.log('✅ Champ country ajouté');
    } else {
      console.log('ℹ️ Champ country existe déjà');
    }
    
    console.log('✅ Migration des champs adresse terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des champs adresse:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Exécuter la migration si ce fichier est lancé directement
if (require.main === module) {
  addClientAddressFields()
    .then(() => {
      console.log('Migration terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration échouée:', error);
      process.exit(1);
    });
}

module.exports = { addClientAddressFields };
