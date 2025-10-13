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

    // Si body est un FormData, laisser le navigateur gérer Content-Type
    if (config.body instanceof FormData) {
      // Cloner sans Content-Type
      const headers = { ...config.headers };
      delete headers['Content-Type'];
      config.headers = headers;
    }

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

  async updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ 
        currentPassword, 
        newPassword 
      }),
    });
  }

  // User methods
  async getUsers(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/users?${params}`);
  }

  async getAllUsers() {
    return this.request('/users/all');
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

  async uploadProjectQuote(id, file) {
    const formData = new FormData();
    formData.append('quote', file);
    return fetch(`${this.baseURL}/projects/${id}/upload-quote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    }).then(r => r.json());
  }

  async uploadProjectSpecifications(id, file) {
    const formData = new FormData();
    formData.append('specifications', file);
    return fetch(`${this.baseURL}/projects/${id}/upload-specifications`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    }).then(r => r.json());
  }

  async getProjectMembers(projectId) {
    return this.request(`/dev/projects/${projectId}/members`);
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

  // Dev links: tasks <-> tickets
  async getTicketLinkedTasks(ticketId) {
    return this.request(`/dev/tickets/${ticketId}/tasks`);
  }

  async linkTaskToTicket(ticketId, taskId) {
    return this.request(`/dev/tickets/${ticketId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId })
    });
  }

  async unlinkTaskFromTicket(ticketId, taskId) {
    return this.request(`/dev/tickets/${ticketId}/tasks/${taskId}`, { method: 'DELETE' });
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
      // Normaliser l'affichage de closed en "Résolu"
      'closed': 'Résolu'
    };
    return statusMap[status] || status;
  }

  formatPriority(priority) {
    const priorityMap = {
      'urgent': 'Urgente',
      'high': 'Élevée',
      'normal': 'Moyenne',
      'medium': 'Moyenne',
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
    // Si il y a un fichier attaché, utiliser FormData
    if (invoiceData.attachment) {
      const formData = new FormData();
      Object.keys(invoiceData).forEach(key => {
        if (key !== 'attachment') {
          formData.append(key, invoiceData[key]);
        }
      });
      formData.append('attachment', invoiceData.attachment);
      
      return this.request('/invoices', {
        method: 'POST',
        body: formData,
        headers: {} // Pas de Content-Type pour FormData, le navigateur l'ajoute automatiquement
      });
    } else {
      return this.request('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });
    }
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
    const badge = document.getElementById('ticketCount');
    
    if (!badge) {
      return; // Pas de badge à mettre à jour
    }
    
    let totalTickets = 0;
    
    // D'abord, vérifier si l'app tickets est chargée et utiliser ses données
    if (window.ticketsApp && window.ticketsApp.tickets && Array.isArray(window.ticketsApp.tickets)) {
      // Logique différente selon le rôle utilisateur
      const token = localStorage.getItem('token');
      let userRole = 'client';
      
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userRole = payload.role || 'client';
        } catch (e) {
          userRole = 'client';
        }
      }
      
      if (userRole === 'admin' || userRole === 'team') {
        // Pour les admins : compter les tickets "ouverts"
        totalTickets = window.ticketsApp.tickets.filter(ticket => 
          ticket.status === 'open'
        ).length;
      } else {
        // Pour les clients : compter les tickets "en cours"
        totalTickets = window.ticketsApp.tickets.filter(ticket => 
          ticket.status === 'in_progress'
        ).length;
      }
      
    } else {
      // Sinon, utiliser l'API directement
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          
          totalTickets = 0;
        } else {
          const response = await fetch('/api/tickets', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            let tickets = [];
            
            if (result.success && result.data) {
              if (result.data.tickets) {
                tickets = result.data.tickets;
              } else if (Array.isArray(result.data)) {
                tickets = result.data;
              }
            } else if (Array.isArray(result)) {
              tickets = result;
            }
            
            // Logique différente selon le rôle utilisateur pour l'API
            const token = localStorage.getItem('token');
            let userRole = 'client';
            
            if (token) {
              try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                userRole = payload.role || 'client';
              } catch (e) {
                userRole = 'client';
              }
            }
            
            if (userRole === 'admin' || userRole === 'team') {
              // Pour les admins : compter les tickets "ouverts"
              totalTickets = tickets.filter(ticket => 
                ticket.status === 'open'
              ).length;
            } else {
              // Pour les clients : compter les tickets "en cours"
              totalTickets = tickets.filter(ticket => 
                ticket.status === 'in_progress'
              ).length;
            }
            
            
          } else {
            console.warn('Erreur API tickets pour badge:', response.status);
            totalTickets = 0;
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération des tickets pour badge:', error);
        totalTickets = 0;
      }
    }

    // Mettre à jour le badge
    badge.textContent = totalTickets;
    badge.style.display = totalTickets > 0 ? 'inline-flex' : 'none';
    
  } catch (error) {
    console.warn('Erreur lors de la mise à jour du badge tickets:', error);
    // En cas d'erreur, mettre le badge à 0
    const badge = document.getElementById('ticketCount');
    if (badge) {
      badge.textContent = '0';
      badge.style.display = 'none';
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
  
  // Mettre à jour le badge périodiquement pour maintenir la synchronisation
  setInterval(updateTicketBadge, 30000); // Toutes les 30 secondes
}

// Fonction pour forcer la mise à jour immédiate du badge (appelée lors de changements)
function refreshTicketBadge() {
  updateTicketBadge();
}

// Rendre les fonctions disponibles globalement
window.updateTicketBadge = updateTicketBadge;
window.refreshTicketBadge = refreshTicketBadge;
window.initTicketBadge = initTicketBadge;

// Global instance
window.api = new ApiClient();
