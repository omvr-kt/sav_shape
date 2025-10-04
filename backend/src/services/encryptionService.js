const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    // Ensure key is exactly 32 bytes for AES-256
    this.secretKey = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key-change-me', 'salt', 32);
  }

  encrypt(text) {
    if (!text) return { encrypted: '', iv: '' };

    // Vérifier le type de données
    if (typeof text !== 'string') {
      console.error('EncryptionService.encrypt: text must be a string, got', typeof text);
      throw new TypeError('Encryption requires a string, received ' + typeof text);
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (err) {
      console.error('EncryptionService.encrypt error:', err);
      throw err;
    }
  }

  decrypt(encryptedText, ivHex) {
    if (!encryptedText || !ivHex) return '';
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = new EncryptionService();