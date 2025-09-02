class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', data);
        if (data.errors) {
          console.error('Validation errors:', data.errors);
        }
        throw new Error(data.message || 'Une erreur est survenue');
      }

      return data;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Token')) {
        this.clearToken();
        window.location.reload();
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
}

// Global instance
window.api = new ApiClient();