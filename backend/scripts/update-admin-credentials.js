#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function hidePassword() {
  process.stdin.on('data', () => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write('*'.repeat(8));
  });
}

async function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function validatePassword(password) {
  if (password.length < 8) {
    console.log('\n❌ Le mot de passe doit contenir au moins 8 caractères');
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    console.log('\n❌ Le mot de passe doit contenir au moins une majuscule');
    return false;
  }
  if (!/[a-z]/.test(password)) {
    console.log('\n❌ Le mot de passe doit contenir au moins une minuscule');
    return false;
  }
  if (!/[0-9]/.test(password)) {
    console.log('\n❌ Le mot de passe doit contenir au moins un chiffre');
    return false;
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    console.log('\n❌ Le mot de passe doit contenir au moins un caractère spécial');
    return false;
  }
  return true;
}

async function updateAdminCredentials() {
  console.log('\n🔐 MISE À JOUR DES IDENTIFIANTS ADMINISTRATEUR');
  console.log('================================================\n');
  
  try {
    // Connexion à la base de données
    const Database = require('sqlite3').Database;
    const dbPath = path.join(__dirname, '../database.sqlite');
    const db = new Database(dbPath);
    
    // Vérifier qu'un admin existe
    const checkAdmin = () => new Promise((resolve, reject) => {
      db.get('SELECT id, email FROM users WHERE role = "admin" LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const currentAdmin = await checkAdmin();
    if (!currentAdmin) {
      console.log('❌ Aucun compte administrateur trouvé dans la base de données');
      rl.close();
      process.exit(1);
    }
    
    console.log(`📧 Email actuel: ${currentAdmin.email}\n`);
    
    // Demander le nouvel email
    let newEmail;
    let emailValid = false;
    while (!emailValid) {
      newEmail = await question('Nouvel email (ou appuyez sur Entrée pour garder l\'actuel): ');
      if (!newEmail) {
        newEmail = currentAdmin.email;
        emailValid = true;
      } else if (await validateEmail(newEmail)) {
        emailValid = true;
      } else {
        console.log('❌ Email invalide. Veuillez entrer un email valide.\n');
      }
    }
    
    // Demander le nouveau mot de passe
    console.log('\n🔑 Exigences du mot de passe:');
    console.log('   • Au moins 8 caractères');
    console.log('   • Au moins une majuscule');
    console.log('   • Au moins une minuscule');
    console.log('   • Au moins un chiffre');
    console.log('   • Au moins un caractère spécial (!@#$%^&*(),.?":{}|<>)\n');
    
    let newPassword;
    let passwordValid = false;
    while (!passwordValid) {
      newPassword = await question('Nouveau mot de passe: ');
      if (await validatePassword(newPassword)) {
        passwordValid = true;
      }
    }
    
    // Confirmer le mot de passe
    const confirmPassword = await question('Confirmer le mot de passe: ');
    if (newPassword !== confirmPassword) {
      console.log('\n❌ Les mots de passe ne correspondent pas');
      rl.close();
      process.exit(1);
    }
    
    // Afficher le récapitulatif
    console.log('\n📋 RÉCAPITULATIF');
    console.log('================');
    console.log(`Email: ${currentAdmin.email} → ${newEmail}`);
    console.log(`Mot de passe: ******** → ********\n`);
    
    const confirm = await question('Confirmer la mise à jour? (oui/non): ');
    if (confirm.toLowerCase() !== 'oui') {
      console.log('\n❌ Mise à jour annulée');
      rl.close();
      process.exit(0);
    }
    
    // Hasher le nouveau mot de passe
    console.log('\n⏳ Hashage du mot de passe...');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Mettre à jour la base de données
    const updateAdmin = () => new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET email = ?, password_hash = ?, updated_at = ? WHERE id = ?',
        [newEmail, hashedPassword, new Date().toISOString(), currentAdmin.id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    const changes = await updateAdmin();
    
    if (changes > 0) {
      console.log('\n✅ Identifiants mis à jour avec succès!');
      console.log('\n📝 Nouveaux identifiants:');
      console.log('=======================');
      console.log(`Email: ${newEmail}`);
      console.log(`Mot de passe: ${newPassword}`);
      console.log('\n⚠️  IMPORTANT: Notez ces identifiants en lieu sûr!');
      console.log('⚠️  Le mot de passe ne sera plus affiché après cette session.\n');
      
      // Mettre à jour le fichier .env si nécessaire
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
      console.log('\n❌ Aucune mise à jour effectuée');
    }
    
    db.close();
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

updateAdminCredentials().catch(console.error);