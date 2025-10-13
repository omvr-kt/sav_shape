const { db } = require('../utils/database');

class SettingsService {
  
  /**
   * Récupère une valeur de configuration
   * @param {string} key - Clé du paramètre
   * @returns {Promise<string|null>}
   */
  static async getSetting(key) {
    try {
      const setting = await db.get('SELECT value FROM app_settings WHERE key = ?', [key]);
      return setting ? setting.value : null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Récupère plusieurs valeurs de configuration
   * @param {string[]} keys - Liste des clés à récupérer
   * @returns {Promise<Object>}
   */
  static async getSettings(keys) {
    try {
      const placeholders = keys.map(() => '?').join(',');
      const settings = await db.all(
        `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`, 
        keys
      );
      
      const result = {};
      settings.forEach(setting => {
        result[setting.key] = setting.value;
      });
      
      return result;
    } catch (error) {
      console.error('Error getting multiple settings:', error);
      return {};
    }
  }

  /**
   * Récupère tous les paramètres d'une catégorie
   * @param {string} category - Catégorie des paramètres
   * @returns {Promise<Object>}
   */
  static async getSettingsByCategory(category) {
    try {
      const settings = await db.all(
        'SELECT key, value FROM app_settings WHERE category = ?', 
        [category]
      );
      
      const result = {};
      settings.forEach(setting => {
        result[setting.key] = setting.value;
      });
      
      return result;
    } catch (error) {
      console.error(`Error getting settings for category ${category}:`, error);
      return {};
    }
  }

  /**
   * Met à jour une valeur de configuration
   * @param {string} key - Clé du paramètre
   * @param {string} value - Nouvelle valeur
   * @returns {Promise<boolean>}
   */
  static async setSetting(key, value) {
    try {
      await db.run(
        'UPDATE app_settings SET value = ?, updated_at = datetime(\'now\', \'localtime\') WHERE key = ?',
        [value, key]
      );
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Récupère les labels de statut
   * @returns {Promise<Object>}
   */
  static async getStatusLabels() {
    const keys = [
      'status_open_label', 
      'status_in_progress_label', 
      'status_waiting_client_label',
      'status_resolved_label', 
      'status_closed_label'
    ];
    
    const settings = await this.getSettings(keys);
    
    return {
      open: settings.status_open_label || 'Ouvert',
      in_progress: settings.status_in_progress_label || 'En cours',
      waiting_client: settings.status_waiting_client_label || 'En attente',
      resolved: settings.status_resolved_label || 'Résolu',
      closed: settings.status_closed_label || 'Fermé'
    };
  }

  /**
   * Récupère les labels de priorité
   * @returns {Promise<Object>}
   */
  static async getPriorityLabels() {
    const keys = [
      'priority_low_label',
      'priority_normal_label', 
      'priority_high_label',
      'priority_urgent_label'
    ];
    
    const settings = await this.getSettings(keys);
    
    const normalLabel = settings.priority_normal_label || 'Moyenne';
    return {
      low: settings.priority_low_label || 'Faible',
      normal: normalLabel,
      medium: normalLabel, // alias pour cohérence des tâches
      high: settings.priority_high_label || 'Élevée',
      urgent: settings.priority_urgent_label || 'Urgente'
    };
  }

  /**
   * Récupère la configuration des horaires de travail
   * @returns {Promise<Object>}
   */
  static async getBusinessHoursConfig() {
    const settings = await this.getSettingsByCategory('business_hours');
    
    return {
      startHour: parseInt(settings.business_hours_start || '9'),
      endHour: parseInt(settings.business_hours_end || '18'),
      workDays: JSON.parse(settings.business_days || '[1,2,3,4,5]')
    };
  }

  /**
   * Récupère la configuration des factures
   * @returns {Promise<Object>}
   */
  static async getInvoicingConfig() {
    const settings = await this.getSettingsByCategory('invoicing');
    
    return {
      prefix: settings.invoice_prefix || 'SHAPE',
      defaultTvaRate: parseFloat(settings.default_tva_rate || '20.00')
    };
  }

  /**
   * Récupère tous les paramètres pour l'API frontend
   * @returns {Promise<Object>}
   */
  static async getClientConfig() {
    try {
      const [statusLabels, priorityLabels, businessHours, general] = await Promise.all([
        this.getStatusLabels(),
        this.getPriorityLabels(),
        this.getBusinessHoursConfig(),
        this.getSettingsByCategory('general')
      ]);

      return {
        labels: {
          status: statusLabels,
          priority: priorityLabels
        },
        businessHours,
        app: {
          name: general.app_name || 'SAV Shape',
          company: general.company_name || 'Shape Agency'
        }
      };
    } catch (error) {
      console.error('Error getting client config:', error);
      return {
        labels: {
          status: { open: 'Ouvert', in_progress: 'En cours', waiting_client: 'En attente', resolved: 'Résolu', closed: 'Fermé' },
          priority: { low: 'Faible', normal: 'Moyenne', medium: 'Moyenne', high: 'Élevée', urgent: 'Urgente' }
        },
        businessHours: { startHour: 9, endHour: 18, workDays: [1,2,3,4,5] },
        app: { name: 'SAV Shape', company: 'Shape Agency' }
      };
    }
  }
}

module.exports = SettingsService;
