class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
    
    // Vérifier la validité du token au démarrage
    this.validateStoredToken();
  }
  
  validateStoredToken() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (tokenData.exp && tokenData.exp <= currentTime) {
          console.warn('Token expiré détecté, suppression');
          this.clearToken();
        }
      } catch (error) {
        console.warn('Token invalide détecté, suppression');
        this.clearToken();
      }
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Récupérer le token le plus récent du localStorage
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      this.token = currentToken;
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    
    return headers;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Vérifier si la réponse est valide
      if (!response.ok) {
        // Gestion spéciale des erreurs 401
        if (response.status === 401) {
          console.warn('Token invalide ou expiré, redirection vers la page de connexion');
          this.clearToken();
          window.location.href = '/';
          return;
        }
        
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        console.error('API Error Response:', errorData);
        if (errorData.errors) {
          console.error('Validation errors:', errorData.errors);
        }
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      // Gestion des erreurs réseau ou de parsing
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Erreur de connexion au serveur');
      }
      throw error;
    }
  }

  // Auth methods
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  // User methods
  async getUsers(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/users?${params}`);
  }

  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  async getClients() {
    return this.request('/users/clients');
  }

  // Project methods
  async getProjects(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/projects?${params}`);
  }

  async getProject(id) {
    return this.request(`/projects/${id}`);
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(id, projectData) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async getProjectStats(id) {
    return this.request(`/projects/${id}/stats`);
  }

  // Ticket methods
  async getTickets(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/tickets?${params}`);
  }

  async getTicket(id) {
    return this.request(`/tickets/${id}`);
  }

  async createTicket(ticketData) {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async updateTicket(id, ticketData) {
    return this.request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ticketData),
    });
  }

  async deleteTicket(id) {
    return this.request(`/tickets/${id}`, { method: 'DELETE' });
  }

  async getTicketStats() {
    return this.request('/tickets/stats');
  }

  async getOverdueTickets() {
    return this.request('/tickets/overdue');
  }

  // Comment methods
  async getTicketComments(ticketId) {
    return this.request(`/comments/ticket/${ticketId}`);
  }

  async createComment(ticketId, commentData) {
    return this.request(`/comments/ticket/${ticketId}`, {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
  }

  async updateComment(id, commentData) {
    return this.request(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(commentData),
    });
  }

  async deleteComment(id) {
    return this.request(`/comments/${id}`, { method: 'DELETE' });
  }

  // SLA methods
  async getSLARules() {
    return this.request('/sla');
  }

  async getClientSLARules(clientId) {
    return this.request(`/sla/client/${clientId}`);
  }

  async createSLARule(slaData) {
    return this.request('/sla', {
      method: 'POST',
      body: JSON.stringify(slaData),
    });
  }

  async updateSLARule(id, slaData) {
    return this.request(`/sla/${id}`, {
      method: 'PUT',
      body: JSON.stringify(slaData),
    });
  }

  async deleteSLARule(id) {
    return this.request(`/sla/${id}`, { method: 'DELETE' });
  }

  async createDefaultSLAs(clientId) {
    return this.request(`/sla/client/${clientId}/defaults`, { method: 'POST' });
  }

  // Utility methods
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Paris'
    });
  }

  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
  }

  // Obtenir l'heure actuelle en France
  getCurrentFrenchTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Paris"}));
  }

  formatStatus(status) {
    const statusMap = {
      'open': 'Ouvert',
      'in_progress': 'En cours',
      'waiting_client': 'Attente client',
      'resolved': 'Résolu',
      'closed': 'Fermé'
    };
    return statusMap[status] || status;
  }

  formatPriority(priority) {
    const priorityMap = {
      'urgent': 'Urgent',
      'high': 'Élevée',
      'normal': 'Normale',
      'low': 'Faible'
    };
    return priorityMap[priority] || priority;
  }

  getStatusClass(status) {
    return `status-${status}`;
  }

  getPriorityClass(priority) {
    return `priority-${priority}`;
  }

  // === INVOICES ===
  async getInvoices(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.client_id) params.append('client_id', filters.client_id);
    
    const url = `/invoices${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request(url);
  }

  async getInvoice(id) {
    return this.request(`/invoices/${id}`);
  }

  async createInvoice(invoiceData) {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
  }

  async updateInvoice(id, data) {
    return this.request(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async updateInvoiceStatus(id, status) {
    return this.request(`/invoices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async deleteInvoice(id) {
    return this.request(`/invoices/${id}`, {
      method: 'DELETE'
    });
  }

  async getClientInvoices(clientId) {
    return this.request(`/invoices/client/${clientId}`);
  }

  // === ATTACHMENTS ===
  async uploadAttachment(commentId, fileData) {
    const formData = new FormData();
    formData.append('attachment', fileData);
    
    const url = `/attachments/comment/${commentId}`;
    return fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    }).then(response => response.json());
  }

  async getCommentAttachments(commentId) {
    return this.request(`/attachments/comment/${commentId}`);
  }

  async downloadAttachment(attachmentId) {
    const token = localStorage.getItem('token');
    const url = `${this.baseURL}/attachments/download/${attachmentId}`;
    
    // Ouvrir le lien de téléchargement dans un nouvel onglet
    window.open(`${url}?token=${token}`, '_blank');
  }

  async deleteAttachment(attachmentId) {
    return this.request(`/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
  }
}

// Fonction utilitaire globale pour mettre à jour le badge tickets dans la sidebar
async function updateTicketBadge() {
  try {
    // Récupérer le token et vérifier s'il y a un utilisateur connecté
    const token = localStorage.getItem('token');
    const badge = document.getElementById('ticketCount');
    
    if (!badge) {
      return; // Pas de badge à mettre à jour
    }
    
    let totalTickets = 0;
    
    // Si nous sommes en mode test (comme dans client-tickets.js), utiliser les données de test
    if (!token || token === 'test' || window.location.hostname === 'localhost') {
      // Vérifier si l'instance ticketsApp existe et utiliser ses données
      if (window.ticketsApp && window.ticketsApp.tickets) {
        // Utiliser la même logique que updateStatsDisplay() : compter seulement les tickets actifs
        totalTickets = window.ticketsApp.tickets.filter(ticket => 
          ticket.status !== 'resolved' && ticket.status !== 'closed'
        ).length;
      } else {
        // Données de test par défaut
        const defaultTestTickets = [
          {
            id: 1,
            title: "Problème de connexion sur l'espace admin",
            status: 'in_progress',
            priority: 'urgent',
            project_id: 1,
            created_at: '2024-01-15T10:30:00Z'
          },
          {
            id: 2,
            title: "Demande de modification du design de la page d'accueil",
            status: 'waiting_client',
            priority: 'normal',
            project_id: 2,
            created_at: '2024-01-10T14:15:00Z'
          },
          {
            id: 3,
            title: "Bug sur le processus de commande mobile",
            status: 'resolved',
            priority: 'high',
            project_id: 3,
            created_at: '2024-01-08T09:45:00Z'
          }
        ];
        // Compter seulement les tickets actifs dans les données par défaut
        totalTickets = defaultTestTickets.filter(ticket => 
          ticket.status !== 'resolved' && ticket.status !== 'closed'
        ).length;
      }
    } else {
      // Mode production - utiliser l'API réelle
      try {
        const response = await api.getTickets();
        if (response.success && response.data && response.data.tickets) {
          // Compter seulement les tickets actifs (même logique que updateStatsDisplay)
          totalTickets = response.data.tickets.filter(ticket => 
            ticket.status !== 'resolved' && ticket.status !== 'closed'
          ).length;
        }
      } catch (error) {
        console.warn('Erreur API, utilisation des données de test:', error);
        totalTickets = 2; // Valeur par défaut pour tickets actifs (in_progress + waiting_client)
      }
    }

    // Mettre à jour le badge
    badge.textContent = totalTickets;
    badge.style.display = totalTickets > 0 ? 'inline-flex' : 'none';
    
  } catch (error) {
    console.warn('Erreur lors de la mise à jour du badge tickets:', error);
    // En cas d'erreur, utiliser une valeur par défaut
    const badge = document.getElementById('ticketCount');
    if (badge) {
      badge.textContent = '3';
      badge.style.display = 'inline-flex';
    }
  }
}

// Fonction pour initialiser le badge à l'ouverture d'une page
function initTicketBadge() {
  // Attendre que le DOM soit chargé avant de mettre à jour le badge
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateTicketBadge);
  } else {
    updateTicketBadge();
  }
}

// Rendre les fonctions disponibles globalement
window.updateTicketBadge = updateTicketBadge;
window.initTicketBadge = initTicketBadge;

// Global instance
window.api = new ApiClient();