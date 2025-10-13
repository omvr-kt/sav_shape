#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function main() {
  const { initDatabase, db } = require('../src/utils/database');
  const SLA = require('../src/models/SLA');

  const emailArg = process.argv.find(a => a.startsWith('--email='));
  const companyArg = process.argv.find(a => a.startsWith('--company='));
  const firstArg = process.argv.find(a => a.startsWith('--first='));
  const lastArg = process.argv.find(a => a.startsWith('--last='));
  const passArg = process.argv.find(a => a.startsWith('--password='));

  const email = emailArg ? emailArg.split('=')[1] : 'it@startup.io';
  const company = companyArg ? companyArg.split('=')[1] : 'Startup.io';
  const firstName = firstArg ? firstArg.split('=')[1] : 'Startup';
  const lastName = lastArg ? lastArg.split('=')[1] : 'Contact';
  const plainPassword = passArg ? passArg.split('=')[1] : generatePassword();

  try {
    await initDatabase();

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      console.log(`⚠️  Un utilisateur avec l'email ${email} existe déjà (id=${existing.id}).`);
      return;
    }

    const hash = await bcrypt.hash(plainPassword, 12);
    const result = await db.run(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, company, is_active) VALUES (?, ?, 'client', ?, ?, ?, 1)`,
      [email.toLowerCase(), hash, firstName, lastName, company]
    );

    const userId = result.id;

    // Create default SLAs for this client
    try {
      if (typeof SLA.createDefaultSLAs === 'function') {
        await SLA.createDefaultSLAs(userId);
      }
    } catch (e) {
      console.warn('Impossible de créer les SLA par défaut:', e && e.message);
    }

    console.log('✅ Compte client créé avec succès');
    console.log(`   ID: ${userId}`);
    console.log(`   Société: ${company}`);
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe temporaire: ${plainPassword}`);
    console.log('   Pensez à le changer après la première connexion.');
  } catch (err) {
    console.error('❌ Erreur lors de la création du client:', err && err.message);
    process.exit(1);
  } finally {
    try { await db.close(); } catch (e) {}
  }
}

function generatePassword(length = 14) {
  // Alphanum + symbols, avoid ambiguous chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%-_+=';
  const bytes = crypto.randomBytes(length);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += alphabet[bytes[i] % alphabet.length];
  }
  return pass;
}

if (require.main === module) {
  main();
}

module.exports = { main };

