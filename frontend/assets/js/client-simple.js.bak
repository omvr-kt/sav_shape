class ClientApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.projects = [];
    this.tickets = [];
    this.init();
  }

  init() {
    console.log('ClientApp: Initializing simple version...');
    this.checkAuth();
    this.setupEventListeners();
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      this.showLogin();
      return;
    }

    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      this.currentUser = {
        id: tokenData.userId,
        email: tokenData.email,
        role: tokenData.role
      };
      
      this.showMainApp();
    } catch (error) {
      console.error('Token validation error:', error);
      this.showLogin();
    }
  }

  showLogin() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
  }

  showMainApp() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Set current user name
    const userNameEl = document.getElementById('currentUser');
    if (userNameEl && this.currentUser) {
      userNameEl.textContent = this.currentUser.email;
    }
    
    this.loadTabContent(this.currentTab);
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await this.handleLogout();
    });

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
        console.log('Clicking tab:', tabName);
        this.switchTab(tabName);
      });
    });
    
    // New ticket buttons
    document.getElementById('newTicketBtn')?.addEventListener('click', () => {
      console.log('New ticket button clicked');
      this.showNewTicketModal();
    });
    
    document.getElementById('newTicketBtn2')?.addEventListener('click', () => {
      console.log('New ticket button 2 clicked');
      this.showNewTicketModal();
    });

    // Refresh buttons
    document.getElementById('refreshTickets')?.addEventListener('click', () => {
      console.log('Refresh tickets clicked');
      this.loadTickets();
    });

    // Project search
    document.getElementById('projectSearch')?.addEventListener('input', () => {
      this.filterProjects();
    });

    document.getElementById('projectStatusFilter')?.addEventListener('change', () => {
      this.filterProjects();
    });

    // Ticket search
    document.getElementById('ticketSearch')?.addEventListener('input', () => {
      this.filterTickets();
    });

    document.getElementById('ticketStatusFilter')?.addEventListener('change', () => {
      this.filterTickets();
    });

    // Password change form
    document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange();
    });
  }

  switchTab(tabName) {
    console.log('ClientApp: Switching to tab:', tabName);
    
    // Update navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;
    console.log('ClientApp: Tab switched successfully to', tabName);

    // Load data for the tab
    this.loadTabContent(tabName);
  }

  loadTabContent(tabName) {
    switch (tabName) {
      case 'overview':
        // Simple overview - nothing to load
        break;
      case 'projects':
        this.loadProjects();
        break;
      case 'tickets':
        this.loadTickets();
        break;
      case 'profile':
        this.loadProfile();
        break;
    }
  }

  async handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
      const response = await api.login(email, password);
      
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        this.currentUser = response.data.user;
        this.showMainApp();
        errorDiv.style.display = 'none';
      } else {
        errorDiv.textContent = response.message;
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorDiv.textContent = 'Erreur de connexion';
      errorDiv.style.display = 'block';
    }
  }

  async handleLogout() {
    await api.logout();
    this.currentUser = null;
    window.location.href = '/';
  }

  async loadProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '<div class="loading">Chargement des projets...</div>';

    try {
      const response = await api.getProjects({ client_id: this.currentUser.id });
      this.projects = response.data.projects;
      this.renderProjects();
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des projets</div>';
    }
  }

  renderProjects() {
    const container = document.getElementById('projectsList');
    
    if (this.projects.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun projet trouvé</div>';
      return;
    }

    container.innerHTML = this.projects.map(project => `
      <div class="project-card">
        <div class="project-card-header">
          <div class="project-card-title">${project.name}</div>
          <div class="project-card-description">${project.description || 'Aucune description disponible'}</div>
        </div>
        <div class="project-card-stats">
          <div class="project-stat">
            <div class="project-stat-number">${project.ticket_count || 0}</div>
            <div class="project-stat-label">Tickets</div>
          </div>
          <div class="project-stat">
            <div class="project-stat-number">${project.status}</div>
            <div class="project-stat-label">Statut</div>
          </div>
        </div>
        <div class="project-card-actions">
          <button class="btn btn-primary btn-sm" onclick="clientApp.createTicketForProject(${project.id})">
            + Nouveau ticket
          </button>
        </div>
      </div>
    `).join('');
  }

  filterProjects() {
    // Simple filter implementation
    this.renderProjects();
  }

  async loadTickets() {
    const container = document.getElementById('ticketsList');
    container.innerHTML = '<div class="loading">Chargement des tickets...</div>';

    try {
      const response = await api.getTickets({ client_id: this.currentUser.id });
      this.tickets = response.data.tickets;
      this.renderTickets();
    } catch (error) {
      console.error('Tickets load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des tickets</div>';
    }
  }

  renderTickets() {
    const container = document.getElementById('ticketsList');
    
    if (this.tickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket trouvé</div>';
      return;
    }

    container.innerHTML = this.tickets.map(ticket => `
      <div class="ticket-card">
        <div class="ticket-card-header">
          <div class="ticket-card-title">${ticket.title}</div>
          <div class="ticket-card-meta">
            <span class="ticket-status-${ticket.status}">${this.getStatusLabel(ticket.status)}</span>
            <span>${this.formatDate(ticket.created_at)}</span>
          </div>
        </div>
        <div class="ticket-card-description">${ticket.description}</div>
      </div>
    `).join('');
  }

  filterTickets() {
    // Simple filter implementation
    this.renderTickets();
  }

  async loadProfile() {
    const container = document.getElementById('profileInfo');
    
    try {
      const user = this.currentUser;
      
      container.innerHTML = `
        <div class="profile-info-item">
          <span class="profile-info-label">Email</span>
          <span class="profile-info-value">${user.email}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Rôle</span>
          <span class="profile-info-value">${user.role}</span>
        </div>
      `;
    } catch (error) {
      console.error('Profile load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement du profil</div>';
    }
  }

  async handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const resultDiv = document.getElementById('passwordChangeResult');

    if (newPassword !== confirmPassword) {
      resultDiv.textContent = 'Les mots de passe ne correspondent pas';
      resultDiv.className = 'error-message';
      resultDiv.style.display = 'block';
      return;
    }

    try {
      const response = await api.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        resultDiv.textContent = 'Mot de passe modifié avec succès';
        resultDiv.className = 'success-message';
        document.getElementById('changePasswordForm').reset();
      } else {
        resultDiv.textContent = response.message;
        resultDiv.className = 'error-message';
      }
      resultDiv.style.display = 'block';
    } catch (error) {
      console.error('Password change error:', error);
      resultDiv.textContent = 'Erreur lors du changement de mot de passe';
      resultDiv.className = 'error-message';
      resultDiv.style.display = 'block';
    }
  }

  showNewTicketModal() {
    console.log('Showing new ticket modal...');
    // Simple alert for now
    alert('Fonctionnalité de création de ticket en cours de développement');
  }

  createTicketForProject(projectId) {
    console.log('Creating ticket for project:', projectId);
    alert('Création de ticket pour le projet #' + projectId);
  }

  getStatusLabel(status) {
    const labels = {
      'open': 'Ouvert',
      'in_progress': 'En cours',
      'waiting_client': 'En attente',
      'resolved': 'Résolu',
      'closed': 'Fermé'
    };
    return labels[status] || status;
  }

  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Europe/Paris'
      });
    } catch {
      return dateString;
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing ClientApp');
  window.clientApp = new ClientApp();
});