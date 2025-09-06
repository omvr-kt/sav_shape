/**
 * Service de configuration centralisé pour le frontend
 * Remplace toutes les données en dur par des appels API
 */

class ConfigService {
  constructor() {
    this.config = null;
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * Charge la configuration depuis l'API
   * @returns {Promise<Object>}
   */
  async load() {
    if (this.config) {
      return this.config;
    }

    if (this.isLoading) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._fetchConfig();

    try {
      this.config = await this.loadPromise;
      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Récupère la configuration depuis l'API
   * @private
   */
  async _fetchConfig() {
    try {
      const response = await fetch('/api/settings/client-config');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const config = await response.json();
      console.log('Configuration chargée:', config);
      return config;
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
      
      // Configuration par défaut en cas d'erreur
      return {
        labels: {
          status: {
            open: 'Ouvert',
            in_progress: 'En cours',
            waiting_client: 'En attente',
            resolved: 'Résolu',
            closed: 'Fermé'
          },
          priority: {
            low: 'Faible',
            normal: 'Normal',
            high: 'Élevé',
            urgent: 'Urgent'
          }
        },
        businessHours: {
          startHour: 9,
          endHour: 18,
          workDays: [1, 2, 3, 4, 5]
        },
        app: {
          name: 'SAV Shape',
          company: 'Shape Agency'
        }
      };
    }
  }

  /**
   * Récupère les labels de statut
   * @returns {Promise<Object>}
   */
  async getStatusLabels() {
    const config = await this.load();
    return config.labels.status;
  }

  /**
   * Récupère les labels de priorité
   * @returns {Promise<Object>}
   */
  async getPriorityLabels() {
    const config = await this.load();
    return config.labels.priority;
  }

  /**
   * Récupère la configuration des horaires
   * @returns {Promise<Object>}
   */
  async getBusinessHours() {
    const config = await this.load();
    return config.businessHours;
  }

  /**
   * Récupère le label d'un statut
   * @param {string} status - Clé du statut
   * @returns {Promise<string>}
   */
  async getStatusLabel(status) {
    const labels = await this.getStatusLabels();
    return labels[status] || status;
  }

  /**
   * Récupère le label d'une priorité
   * @param {string} priority - Clé de la priorité
   * @returns {Promise<string>}
   */
  async getPriorityLabel(priority) {
    const labels = await this.getPriorityLabels();
    return labels[priority] || priority;
  }

  /**
   * Récupère les informations de l'application
   * @returns {Promise<Object>}
   */
  async getAppInfo() {
    const config = await this.load();
    return config.app;
  }

  /**
   * Force le rechargement de la configuration
   */
  async reload() {
    this.config = null;
    this.isLoading = false;
    this.loadPromise = null;
    return this.load();
  }

  /**
   * Crée les options HTML pour un select de statuts
   * @param {string} selectedValue - Valeur sélectionnée
   * @returns {Promise<string>}
   */
  async createStatusOptions(selectedValue = '') {
    const labels = await this.getStatusLabels();
    let html = '<option value="">Tous les statuts</option>';
    
    for (const [key, label] of Object.entries(labels)) {
      const selected = key === selectedValue ? 'selected' : '';
      html += `<option value="${key}" ${selected}>${label}</option>`;
    }
    
    return html;
  }

  /**
   * Crée les options HTML pour un select de priorités
   * @param {string} selectedValue - Valeur sélectionnée
   * @returns {Promise<string>}
   */
  async createPriorityOptions(selectedValue = '') {
    const labels = await this.getPriorityLabels();
    let html = '<option value="">Toutes les priorités</option>';
    
    for (const [key, label] of Object.entries(labels)) {
      const selected = key === selectedValue ? 'selected' : '';
      html += `<option value="${key}" ${selected}>${label}</option>`;
    }
    
    return html;
  }
}

// Instance globale
const configService = new ConfigService();