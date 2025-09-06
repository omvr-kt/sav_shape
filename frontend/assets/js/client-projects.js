class ProjectsApp {
  constructor() {
    this.currentUser = null;
    this.projects = [];
    this.filteredProjects = [];
    this.init();
  }

  init() {
    console.log('ProjectsApp: Initializing...');
    this.checkAuth();
    this.setupEventListeners();
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/client/';
      return;
    }

    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      this.currentUser = {
        id: tokenData.userId,
        email: tokenData.email,
        role: tokenData.role
      };
      
      this.loadUserInfo();
      this.loadProjects();
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('token');
      window.location.href = '/client/';
    }
  }

  loadUserInfo() {
    const userNameEl = document.getElementById('currentUser');
    if (userNameEl && this.currentUser) {
      userNameEl.textContent = this.currentUser.email;
    }
  }

  setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await this.handleLogout();
    });

    // Search input
    document.getElementById('projectSearch').addEventListener('input', () => {
      this.filterProjects();
    });

    // Status filter
    document.getElementById('projectStatusFilter').addEventListener('change', () => {
      this.filterProjects();
    });

    // Navigation links work as normal links - no preventDefault needed
    
    // Event delegation for dynamically created buttons
    this.setupDynamicEventListeners();
  }

  setupDynamicEventListeners() {
    // Remove existing listener to avoid duplicates
    document.removeEventListener('click', this.handleDelegatedClicks);
    
    // Use event delegation for dynamic elements
    this.handleDelegatedClicks = (e) => {
      const target = e.target;
      
      // New ticket for project buttons
      if (target.classList.contains('create-ticket-btn')) {
        e.preventDefault();
        const projectId = parseInt(target.dataset.projectId);
        this.createTicketForProject(projectId);
        return;
      }
      
      // View project details buttons
      if (target.classList.contains('view-project-btn')) {
        e.preventDefault();
        const projectId = parseInt(target.dataset.projectId);
        this.viewProjectDetails(projectId);
        return;
      }
      
      // Modal close buttons
      if (target.classList.contains('modal-close') || target.classList.contains('btn-cancel')) {
        e.preventDefault();
        this.closeModal();
        return;
      }
      
      // Click outside modal to close
      if (target.classList.contains('modal')) {
        e.preventDefault();
        this.closeModal();
        return;
      }
    };
    
    document.addEventListener('click', this.handleDelegatedClicks);
  }

  async loadProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '<div class="loading">Chargement des projets...</div>';

    try {
      const response = await api.getProjects({ client_id: this.currentUser.id });
      this.projects = response.data.projects;
      this.filteredProjects = [...this.projects];
      this.renderProjects();
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des projets</div>';
    }
  }

  filterProjects() {
    const searchTerm = document.getElementById('projectSearch').value.toLowerCase();
    const statusFilter = document.getElementById('projectStatusFilter').value;

    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm) ||
                           (project.description && project.description.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !statusFilter || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.renderProjects();
  }

  renderProjects() {
    const container = document.getElementById('projectsList');
    
    if (this.filteredProjects.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun projet trouvé</div>';
      return;
    }

    container.innerHTML = this.filteredProjects.map(project => `
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
            <div class="project-stat-number">${this.getStatusLabel(project.status)}</div>
            <div class="project-stat-label">Statut</div>
          </div>
        </div>
        <div class="project-card-actions">
          <button class="btn btn-primary btn-sm create-ticket-btn" data-project-id="${project.id}">
            + Nouveau ticket
          </button>
          <button class="btn btn-secondary btn-sm view-project-btn" data-project-id="${project.id}">
            Voir détails
          </button>
          <a href="/client/tickets" class="btn btn-outline btn-sm">
            Tous les tickets
          </a>
        </div>
      </div>
    `).join('');
  }

  createTicketForProject(projectId) {
    console.log('Creating ticket for project:', projectId);
    const project = this.projects.find(p => p.id === projectId);
    
    if (!project) {
      alert('Projet non trouvé');
      return;
    }
    
    // Show ticket creation modal
    this.showNewTicketModal(project);
  }

  viewProjectDetails(projectId) {
    console.log('Viewing project details:', projectId);
    const project = this.projects.find(p => p.id === projectId);
    
    if (!project) {
      alert('Projet non trouvé');
      return;
    }
    
    // Show project details modal
    this.showProjectDetailsModal(project);
  }

  showNewTicketModal(project) {
    const modalHtml = `
      <div class="modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Nouveau Ticket - ${project.name}</h2>
            <button class="modal-close">&times;</button>
          </div>
          <form id="newTicketForm" class="form">
            <div class="form-group">
              <label class="form-label">Projet</label>
              <input type="text" class="form-input" value="${project.name}" disabled>
              <input type="hidden" name="project_id" value="${project.id}">
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketTitle">Titre du ticket *</label>
              <input type="text" id="ticketTitle" name="title" class="form-input" 
                     placeholder="Ex: Problème de connexion, Nouvelle fonctionnalité..." 
                     minlength="5" maxlength="200" required>
              <small class="form-help">Entre 5 et 200 caractères</small>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketDescription">Description *</label>
              <textarea id="ticketDescription" name="description" class="form-textarea" 
                        rows="5" placeholder="Décrivez en détail votre demande (minimum 10 caractères)..." 
                        minlength="10" maxlength="5000" required></textarea>
              <small class="form-help">Entre 10 et 5000 caractères</small>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketPriority">Priorité *</label>
              <select id="ticketPriority" name="priority" class="form-select" required>
                <option value="normal">Normale - Dans les temps</option>
                <option value="high">Haute - Urgent</option>
                <option value="urgent">Urgente - Critique</option>
                <option value="low">Basse - Quand possible</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary btn-cancel">Annuler</button>
              <button type="submit" class="btn btn-primary">Créer le ticket</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Setup form submission
    document.getElementById('newTicketForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createTicket();
    });
  }

  showProjectDetailsModal(project) {
    const statusClass = project.status.toLowerCase();
    const modalHtml = `
      <div class="modal" style="display: flex;">
        <div class="modal-content modal-large">
          <div class="modal-header">
            <h2>${project.name}</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="project-details">
              <div class="project-detail-item">
                <strong>Description :</strong>
                <p>${project.description || 'Aucune description disponible'}</p>
              </div>
              <div class="project-detail-item">
                <strong>Statut :</strong>
                <span class="project-status project-status-${statusClass}">${this.getStatusLabel(project.status)}</span>
              </div>
              <div class="project-detail-item">
                <strong>Nombre de tickets :</strong>
                <span>${project.ticket_count || 0}</span>
              </div>
              <div class="project-detail-item">
                <strong>Créé le :</strong>
                <span>${this.formatDate(project.created_at)}</span>
              </div>
            </div>
            <div class="project-actions">
              <button class="btn btn-primary create-ticket-btn" data-project-id="${project.id}">
                + Nouveau ticket
              </button>
              <a href="/client/tickets" class="btn btn-secondary">
                Voir tous les tickets
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async createTicket() {
    const formData = new FormData(document.getElementById('newTicketForm'));
    const ticketData = {
      project_id: parseInt(formData.get('project_id')),
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      priority: formData.get('priority')
    };

    // Client-side validation
    const validationError = this.validateTicketData(ticketData);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      const submitBtn = document.querySelector('#newTicketForm button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création...';

      const response = await api.createTicket(ticketData);
      
      if (response.success) {
        this.closeModal();
        alert('Ticket créé avec succès !');
        // Optionally refresh projects to update ticket count
        this.loadProjects();
        
        // Rediriger vers la page tickets pour voir le nouveau ticket
        if (window.clientApp && typeof window.clientApp.showTab === 'function') {
          window.clientApp.showTab('tickets');
        }
      } else {
        // Handle specific error messages from server
        let errorMessage = 'Erreur lors de la création du ticket';
        if (response.errors && Array.isArray(response.errors)) {
          errorMessage = response.errors.map(err => err.msg).join('\n');
        } else if (response.message) {
          errorMessage = response.message;
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Create ticket error:', error);
      
      // Check if it's a validation error response
      if (error.response && error.response.data && error.response.data.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg).join('\n');
        alert('Erreurs de validation:\n' + errorMessages);
      } else {
        alert('Erreur lors de la création du ticket. Veuillez réessayer.');
      }
    } finally {
      const submitBtn = document.querySelector('#newTicketForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Créer le ticket';
      }
    }
  }

  validateTicketData(ticketData) {
    if (!ticketData.title || ticketData.title.length < 5) {
      return 'Le titre doit contenir au moins 5 caractères';
    }
    
    if (ticketData.title.length > 200) {
      return 'Le titre ne peut pas dépasser 200 caractères';
    }
    
    if (!ticketData.description || ticketData.description.length < 10) {
      return 'La description doit contenir au moins 10 caractères';
    }
    
    if (ticketData.description.length > 5000) {
      return 'La description ne peut pas dépasser 5000 caractères';
    }
    
    if (!ticketData.priority) {
      return 'Veuillez sélectionner une priorité';
    }
    
    if (!['low', 'normal', 'high', 'urgent'].includes(ticketData.priority)) {
      return 'Priorité invalide';
    }
    
    return null; // No validation errors
  }

  closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
  }

  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Europe/Paris'
      });
    } catch {
      return dateString;
    }
  }

  getStatusLabel(status) {
    const labels = {
      'active': 'Actif',
      'paused': 'En pause',
      'completed': 'Terminé',
      'archived': 'Archivé'
    };
    return labels[status] || status;
  }

  async handleLogout() {
    await api.logout();
    window.location.href = '/';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing ProjectsApp');
  window.projectsApp = new ProjectsApp();
});