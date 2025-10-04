#!/usr/bin/env node

const bcryptjs = require('bcryptjs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Récupérer les arguments de ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n📘 UTILISATION:');
  console.log('================');
  console.log('node scripts/change-admin.js <email> <mot_de_passe>\n');
  console.log('Exemple:');
  console.log('node scripts/change-admin.js admin@monentreprise.fr MonMotDePasse123!\n');
  console.log('⚠️  Exigences du mot de passe:');
  console.log('   • Au moins 8 caractères');
  console.log('   • Au moins une majuscule');
  console.log('   • Au moins une minuscule');
  console.log('   • Au moins un chiffre');
  console.log('   • Au moins un caractère spécial\n');
  process.exit(1);
}

const [newEmail, newPassword] = args;

// Validation email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(newEmail)) {
  console.log('❌ Email invalide');
  process.exit(1);
}

// Validation mot de passe
const errors = [];
if (newPassword.length < 8) errors.push('au moins 8 caractères');
if (!/[A-Z]/.test(newPassword)) errors.push('au moins une majuscule');
if (!/[a-z]/.test(newPassword)) errors.push('au moins une minuscule');
if (!/[0-9]/.test(newPassword)) errors.push('au moins un chiffre');
if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) errors.push('au moins un caractère spécial');

if (errors.length > 0) {
  console.log('❌ Le mot de passe doit contenir:', errors.join(', '));
  process.exit(1);
}

async function updateAdmin() {
  try {
    // Hasher le mot de passe
    console.log('⏳ Hashage du mot de passe...');
    const hashedPassword = await bcryptjs.hash(newPassword, 12);

    // Connexion à la base de données
    const dbPath = path.join(__dirname, '../database.sqlite');
    const db = new sqlite3.Database(dbPath);

    // Vérifier qu'un admin existe
    db.get('SELECT id, email FROM users WHERE role = "admin" LIMIT 1', async (err, currentAdmin) => {
      if (err) {
        console.error('❌ Erreur base de données:', err);
        db.close();
        process.exit(1);
      }

      if (!currentAdmin) {
        console.log('❌ Aucun compte administrateur trouvé');
        db.close();
        process.exit(1);
      }

      console.log(`\n📧 Mise à jour: ${currentAdmin.email} → ${newEmail}`);

      // Mettre à jour les identifiants
      db.run(
        'UPDATE users SET email = ?, password_hash = ?, updated_at = ? WHERE id = ?',
        [newEmail, hashedPassword, new Date().toISOString(), currentAdmin.id],
        function(err) {
          if (err) {
            console.error('❌ Erreur lors de la mise à jour:', err);
            db.close();
            process.exit(1);
          }

          if (this.changes > 0) {
            console.log('\n✅ Identifiants mis à jour avec succès!\n');
            console.log('📝 Nouveaux identifiants:');
            console.log('========================');
            console.log(`Email: ${newEmail}`);
            console.log(`Mot de passe: ${newPassword}\n`);
            console.log('⚠️  IMPORTANT: Notez ces identifiants en lieu sûr!');
            console.log('⚠️  Le mot de passe ne sera plus affiché.\n');

            // Mettre à jour le .env si nécessaire
            if (newEmail !== currentAdmin.email) {
              const fs = require('fs');
              const envPath = path.join(__dirname, '../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/ADMIN_EMAIL=.*/g, `ADMIN_EMAIL=${newEmail}`);
                fs.writeFileSync(envPath, envContent);
                console.log('✅ Fichier .env mis à jour\n');
              }
            }
          } else {
            console.log('❌ Aucune mise à jour effectuée');
          }

          db.close();
        }
      );
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

updateAdmin();