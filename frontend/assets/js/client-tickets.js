class TicketsApp {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.filteredTickets = [];
    this.projects = [];
    this.currentProjectId = null;
    this.currentStatusFilter = '';
    this.countdownInterval = null;
    this.init();
  }

  init() {
    console.log('TicketsApp: Initializing...');
    this.checkAuth();
    console.log('TicketsApp: Auth check completed, setting up event listeners...');
    this.setupEventListeners();
    console.log('TicketsApp: Event listeners setup completed');
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, but bypassing auth for testing');
      // Temporarily comment out redirect for debugging
      // window.location.href = '/client/';
      // return;
    }

    if (token) {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        this.currentUser = {
          id: tokenData.userId,
          email: tokenData.email,
          role: tokenData.role
        };
        
        // this.loadUserInfo();
        // this.loadTickets();  
        // this.loadProjects();
      } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('token');
        // Temporarily disable redirect for debugging
        // window.location.href = '/client/';
        console.log('Setting dummy user for testing');
        this.currentUser = { id: 1, email: 'test@example.com', role: 'client' };
      }
    } else {
      console.log('Setting dummy user for testing (no token)');
      this.currentUser = { id: 1, email: 'test@example.com', role: 'client' };
    }
    
    // Charger des données de test pour démonstration
    this.loadTestData();
  }

  loadUserInfo() {
    if (this.currentUser) {
      // Set profile initials
      const initials = this.currentUser.email.substring(0, 2).toUpperCase();
      const initialsEl = document.getElementById('profileInitials');
      if (initialsEl) {
        initialsEl.textContent = initials;
      }

      // Set profile dropdown info
      const profileNameEl = document.getElementById('profileName');
      const profileEmailEl = document.getElementById('profileEmail');
      if (profileNameEl) {
        profileNameEl.textContent = this.currentUser.email.split('@')[0];
      }
      if (profileEmailEl) {
        profileEmailEl.textContent = this.currentUser.email;
      }
    }
  }

  setupEventListeners() {
    console.log('setupEventListeners: Starting...');
    
    // Profile menu toggle
    const profileAvatar = document.getElementById('profileAvatar');
    const profileDropdown = document.getElementById('profileDropdown');
    
    if (profileAvatar && profileDropdown) {
      profileAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        profileDropdown.classList.remove('active');
      });

      profileDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Profile and logout buttons
    const profileBtn = document.getElementById('profileBtn');
    const confidentialFileBtn = document.getElementById('confidentialFileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.location.href = '/client/profile.html';
      });
    }

    if (confidentialFileBtn) {
      confidentialFileBtn.addEventListener('click', () => {
        window.location.href = '/mon-fichier-confidentiel.html';
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.handleLogout();
      });
    }

    // Project selector
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        this.currentProjectId = e.target.value;
        if (this.currentProjectId) {
          this.loadTickets();
        }
      });
    }

    // New ticket button
    const newTicketBtn = document.getElementById('newTicketBtn');
    console.log('Looking for newTicketBtn element...', newTicketBtn);
    if (newTicketBtn) {
      console.log('newTicketBtn element found, attaching event listener');
      newTicketBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('New ticket button clicked!');
        this.showNewTicketModal();
      });
      console.log('Event listener attached to new ticket button');
    } else {
      console.error('newTicketBtn element not found in DOM');
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshTickets');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadTickets();
      });
    }

    // Search input
    document.getElementById('ticketSearch').addEventListener('input', () => {
      this.filterTickets();
    });

    // Status filter - check if element exists first
    const statusFilterEl = document.getElementById('ticketStatusFilter');
    if (statusFilterEl) {
      statusFilterEl.addEventListener('change', () => {
        this.filterTickets();
      });
    }

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
      
      // Modal close buttons
      if (target.classList.contains('modal-close') || target.classList.contains('btn-cancel')) {
        e.preventDefault();
        console.log('Closing modal via button click');
        this.closeModal();
        return;
      }
      
      // Click outside modal to close
      if (target.classList.contains('modal')) {
        e.preventDefault();
        console.log('Closing modal via outside click');
        this.closeModal();
        return;
      }

      // View ticket details button
      if (target.classList.contains('view-ticket-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        console.log('View ticket button clicked:', ticketId);
        this.viewTicket(ticketId);
        return;
      }

      // Add comment button
      if (target.classList.contains('add-comment-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        console.log('Add comment button clicked:', ticketId);
        this.addComment(ticketId);
        return;
      }

      // Show comment form button (in modal)
      if (target.classList.contains('show-comment-form-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        console.log('Show comment form button clicked:', ticketId);
        this.showCommentForm(ticketId);
        return;
      }

      // Handle spans inside buttons (for styled buttons)
      const parentButton = target.closest('button');
      if (parentButton) {
        // Check if parent button is a modal close button
        if (parentButton.classList.contains('modal-close')) {
          e.preventDefault();
          console.log('Closing modal via parent button click');
          this.closeModal();
          return;
        }
        
        // Check if parent button is a show comment form button
        if (parentButton.classList.contains('show-comment-form-btn')) {
          e.preventDefault();
          const ticketId = parseInt(parentButton.dataset.ticketId);
          console.log('Show comment form parent button clicked:', ticketId);
          this.showCommentForm(ticketId);
          return;
        }
      }

      // Status filter items
      if (target.classList.contains('status-filter-item')) {
        e.preventDefault();
        const status = target.dataset.status;
        console.log('Status filter clicked:', status);
        this.setStatusFilter(status);
        return;
      }
      
      // Also handle elements inside status filter items (like spans)
      const statusFilterParent = target.closest('.status-filter-item');
      if (statusFilterParent) {
        e.preventDefault();
        const status = statusFilterParent.dataset.status;
        console.log('Status filter parent clicked:', status);
        this.setStatusFilter(status);
        return;
      }
      
      
      // Handle dropdown toggle
      if (target.classList.contains('dropdown-toggle') || target.closest('.dropdown-toggle')) {
        e.preventDefault();
        const dropdown = target.closest('.dropdown');
        if (dropdown) {
          console.log('Dropdown toggle clicked');
          this.toggleDropdown(dropdown);
        }
        return;
      }
      
      // Close dropdowns when clicking outside
      if (!target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
      }
    };
    
    document.addEventListener('click', this.handleDelegatedClicks);
  }

  async loadProjects() {
    try {
      const response = await api.getProjects({ client_id: this.currentUser.id });
      this.projects = response.data.projects;
      
      // Populate project selector
      const projectSelect = document.getElementById('projectSelect');
      if (projectSelect && this.projects.length > 0) {
        projectSelect.innerHTML = '<option value="">Tous les projets</option>';
        
        this.projects.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.name;
          projectSelect.appendChild(option);
        });
        
        // Auto-select first project if available
        if (this.projects.length === 1) {
          projectSelect.value = this.projects[0].id;
          this.currentProjectId = this.projects[0].id;
        }
      } else if (projectSelect) {
        projectSelect.innerHTML = '<option value="">Aucun projet disponible</option>';
      }
    } catch (error) {
      console.error('Projects load error:', error);
      const projectSelect = document.getElementById('projectSelect');
      if (projectSelect) {
        projectSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      }
    }
  }

  async loadTickets() {
    const container = document.getElementById('ticketsList');
    container.innerHTML = '<div class="loading">Chargement des tickets...</div>';

    try {
      const response = await api.getTickets({ client_id: this.currentUser.id });
      this.tickets = response.data.tickets;
      this.filterTickets();
    } catch (error) {
      console.error('Tickets load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des tickets</div>';
    }
  }

  filterTickets() {
    const searchTerm = document.getElementById('ticketSearch').value.toLowerCase();

    this.filteredTickets = this.tickets.filter(ticket => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchTerm) ||
                           (ticket.description && ticket.description.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !this.currentStatusFilter || ticket.status === this.currentStatusFilter;
      
      // Filter by selected project
      const matchesProject = !this.currentProjectId || ticket.project_id == this.currentProjectId;

      return matchesSearch && matchesStatus && matchesProject;
    });

    this.renderTickets();
  }

  renderTickets() {
    const container = document.getElementById('ticketsList');
    
    if (!container) {
      console.error('Element ticketsList not found');
      return;
    }
    
    if (this.filteredTickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket trouvé</div>';
      return;
    }

    container.innerHTML = this.filteredTickets.map(ticket => `
      <div class="ticket-item">
        <div class="ticket-header">
          <div class="ticket-info">
            <h3 class="ticket-title">#${ticket.id} - ${ticket.title}</h3>
            <p class="ticket-description">${ticket.description}</p>
          </div>
          <div class="ticket-meta">
            <span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span>
            <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
          </div>
          <div class="ticket-countdown">
            <div class="countdown-label">${this.getDelayDescription(ticket.priority)}</div>
            <div class="countdown-timer ${this.getDelayClass(ticket.created_at, ticket.priority)}" data-ticket-id="${ticket.id}">
               ${this.getCountdown(ticket.created_at, ticket.priority)}
            </div>
          </div>
        </div>
        <div class="ticket-details">
          <span class="ticket-project"> Projet: ${this.getProjectName(ticket.project_id)}</span>
          <span class="ticket-date"> ${api.formatDateTime(ticket.created_at)}</span>
        </div>
        <div class="ticket-actions">
          <button class="btn btn-sm btn-outline view-ticket-btn" data-ticket-id="${ticket.id}">Voir détails</button>
          ${ticket.status === 'open' || ticket.status === 'waiting_client' ? 
            `<button class="btn btn-sm btn-primary add-comment-btn" data-ticket-id="${ticket.id}">Ajouter commentaire</button>` : ''
          }
        </div>
      </div>
    `).join('');
    
    // Start countdown updates
    this.startCountdownUpdates();
  }

  startCountdownUpdates() {
    // Clear existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    // Update countdowns every minute
    this.countdownInterval = setInterval(() => {
      this.updateCountdowns();
    }, 60000); // Update every minute
  }

  updateCountdowns() {
    this.filteredTickets.forEach(ticket => {
      const countdownElement = document.querySelector(`[data-ticket-id="${ticket.id}"].countdown-timer`);
      if (countdownElement) {
        const newCountdown = this.getCountdown(ticket.created_at, ticket.priority);
        const newClass = this.getDelayClass(ticket.created_at, ticket.priority);
        
        countdownElement.innerHTML = ` ${newCountdown}`;
        countdownElement.className = `countdown-timer ${newClass}`;
      }
    });
  }

  showNewTicketModal() {
    console.log('=== showNewTicketModal called ===');
    console.log('Projects loaded:', this.projects.length);
    console.log('Current projects:', this.projects);
    
    // For testing, add dummy projects if none exist
    if (this.projects.length === 0) {
      console.log('No projects found, adding dummy projects for testing');
      this.projects = [
        { id: 1, name: 'Projet Test 1' },
        { id: 2, name: 'Projet Test 2' },
        { id: 3, name: 'Projet Test 3' }
      ];
      console.log('Dummy projects added:', this.projects);
    }

    const modalHtml = `
    <div id="newTicketModal" style="display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.7) !important; z-index: 99999 !important;">
      <div style="position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; background: white !important; border-radius: 0.5rem !important; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3) !important; max-width: 550px !important; width: 95% !important; max-height: 90vh !important; overflow-y: auto !important;">
        <div class="modal-header new-ticket-header" style="background: linear-gradient(135deg, #0e2433 0%, #1a3547 100%) !important; color: white !important; padding: 1.5rem !important; border-radius: 0.5rem 0.5rem 0 0 !important; margin: 0 !important;">
          <div class="modal-title">
            <h2 style="color: white !important; font-size: 1.375rem !important; font-weight: 700 !important; margin: 0 !important;">Nouveau Ticket de Support</h2>
            <p class="modal-subtitle" style="color: rgba(255, 255, 255, 0.8) !important; font-size: 0.875rem !important; margin: 0.25rem 0 0 0 !important;">Décrivez votre demande ou problème</p>
          </div>
          <button class="modal-close" style="color: white !important; background: none !important; border: none !important; font-size: 1.5rem !important; cursor: pointer !important; padding: 0.5rem !important; border-radius: 50% !important;">&times;</button>
        </div>
        
        <div class="modal-body new-ticket-body" style="padding: 2rem !important; background: #fafbfc !important;">
          <form id="newTicketForm" class="new-ticket-form">
            <div class="form-group">
              <label class="form-label">Projet concerné *</label>
              <select name="project_id" required class="form-select">
                <option value="">-- Sélectionner un projet --</option>
                ${this.projects.map(project => `<option value="${project.id}">${project.name}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Titre du ticket *</label>
              <input type="text" name="title" required class="form-input" placeholder="Ex: Problème de connexion, Nouvelle fonctionnalité...">
            </div>
            
            <div class="form-group">
              <label class="form-label">Description *</label>
              <textarea name="description" required class="form-textarea" placeholder="Décrivez brièvement votre demande ou problème..."></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">Priorité</label>
              <select name="priority" class="form-select">
                <option value="normal">Normale - Dans les temps</option>
                <option value="high">Élevée - Urgent</option>
                <option value="urgent">Urgente - Critique</option>
                <option value="low">Faible - Quand possible</option>
              </select>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-cancel">Annuler</button>
              <button type="submit" class="btn btn-primary">Créer le ticket</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

    console.log('=== Injecting modal HTML ===');
    console.log('Modal HTML content:', modalHtml.substring(0, 200) + '...');
    
    try {
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      console.log('Modal HTML injected successfully');
      
      // Check if modal was actually added to DOM
      const injectedModal = document.getElementById('newTicketModal');
      console.log('Modal found in DOM after injection:', injectedModal);
      
      if (injectedModal) {
        console.log('Modal display style:', injectedModal.style.display);
        console.log('Modal visibility:', getComputedStyle(injectedModal).display);
      }
      
      // Setup form submission
      const form = document.getElementById('newTicketForm');
      console.log('Form found:', form);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          console.log('Form submitted');
          this.createTicket();
        });
        console.log('Form submission event listener attached');
      } else {
        console.error('Form newTicketForm not found after modal injection');
      }
      
      // Test si le modal existe encore dans 1 seconde
      setTimeout(() => {
        const modalStillThere = document.getElementById('newTicketModal');
        console.log('Modal still exists after 1 second:', modalStillThere);
        if (modalStillThere) {
          console.log('Modal computed style:', getComputedStyle(modalStillThere).display);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error injecting modal HTML:', error);
    }
  }

  async createTicket() {
    const formData = new FormData(document.getElementById('newTicketForm'));
    const ticketData = {
      project_id: parseInt(formData.get('project_id')),
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority')
    };

    try {
      const response = await api.createTicket(ticketData);
      
      if (response.success) {
        this.closeModal();
        this.loadTickets(); // Refresh the list
        alert('Ticket créé avec succès !');
      } else {
        alert('Erreur lors de la création du ticket: ' + response.message);
      }
    } catch (error) {
      console.error('Create ticket error:', error);
      alert('Erreur lors de la création du ticket');
    }
  }

  closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
    
    // Also remove specific modals by ID if they exist
    const newTicketModal = document.getElementById('newTicketModal');
    if (newTicketModal) {
      newTicketModal.remove();
    }
    
    // Also clear modal container if it exists
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.innerHTML = '';
    }
  }

  getProjectName(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : 'Projet inconnu';
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

  getStatusIcon(status) {
    const icons = {
      'open': 'Open',
      'in_progress': '',
      'waiting_client': '',
      'resolved': 'Resolved',
      'closed': 'Closed'
    };
    return icons[status] || 'Unknown';
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': 'Basse',
      'normal': 'Normale',
      'high': 'Haute',
      'urgent': 'Urgente'
    };
    return labels[priority] || priority;
  }

  getPriorityIcon(priority) {
    const icons = {
      'low': '',
      'normal': '',
      'high': '',
      'urgent': ''
    };
    return icons[priority] || 'Unknown';
  }

  getTimeAgo(dateString) {
    // Utiliser la fonction globale de timezone-utils.js qui gère correctement Paris
    return getTimeAgo(dateString);
  }

  getDelayClass(dateString, priority) {
    const created = new Date(dateString);
    return businessHours.getBusinessDelayClass(created, priority);
  }

  getCountdown(dateString, priority) {
    const created = new Date(dateString);
    return businessHours.getBusinessCountdown(created, priority);
  }

  getDelayDescription(priority) {
    const thresholds = {
      'urgent': 'Réponse attendue sous 2h ouvrables',
      'high': 'Réponse attendue sous 8h ouvrables',
      'normal': 'Réponse attendue sous 24h ouvrables',
      'low': 'Réponse attendue sous 72h ouvrables'
    };
    return thresholds[priority] || 'Délai de réponse (heures ouvrables)';
  }

  viewTicket(ticketId) {
    this.showTicketModal(ticketId);
  }

  addComment(ticketId) {
    this.showCommentModal(ticketId);
  }

  showTicketModal(ticketId) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const modalHtml = `
      <div class="modal" style="display: flex;">
        <div class="modal-content modal-extra-large">
          <div class="modal-header">
            <div class="modal-title">
              <h2> Ticket #${ticket.id}</h2>
              <p class="modal-subtitle">${ticket.title}</p>
            </div>
            <button class="modal-close">&times;</button>
          </div>
          
          <div class="modal-body">
            <div class="ticket-detail-grid">
              <div class="detail-section">
                <h3 class="section-title"> Informations</h3>
                <div class="detail-cards">
                  <div class="detail-card">
                    <span class="detail-label">Statut</span>
                    <span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span>
                  </div>
                  <div class="detail-card">
                    <span class="detail-label">Priorité</span>
                    <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
                  </div>
                  <div class="detail-card">
                    <span class="detail-label">Projet</span>
                    <span class="detail-value">${this.getProjectName(ticket.project_id)}</span>
                  </div>
                </div>
                <div class="detail-cards">
                  <div class="detail-card">
                    <span class="detail-label">Créé le</span>
                    <span class="detail-value">${api.formatDateTime(ticket.created_at)}</span>
                  </div>
                  <div class="detail-card">
                    <span class="detail-label">Temps écoulé</span>
                    <span class="detail-value">${this.getTimeAgo(ticket.created_at)}</span>
                  </div>
                  <div class="detail-card countdown-detail">
                    <span class="detail-label">${this.getDelayDescription(ticket.priority)}</span>
                    <span class="countdown-timer ${this.getDelayClass(ticket.created_at, ticket.priority)}" data-ticket-id="${ticket.id}">
                       ${this.getCountdown(ticket.created_at, ticket.priority)}
                    </span>
                  </div>
                </div>
              </div>

              <div class="description-section">
                <h3 class="section-title"> Description initiale</h3>
                <div class="description-card">
                  <p class="description-text">${ticket.description}</p>
                </div>
              </div>

              <div class="comments-section">
                <div id="ticketComments-${ticket.id}" class="comments-container">
                  <div class="loading">Chargement des commentaires...</div>
                </div>
              </div>
            </div>
          </div>
          
          ${ticket.status === 'open' || ticket.status === 'waiting_client' ? 
            `<div class="modal-footer">
              <div class="footer-actions">
                <button class="btn btn-primary btn-large show-comment-form-btn" data-ticket-id="${ticket.id}" type="button">
                   Ajouter un commentaire
                </button>
              </div>
            </div>` : ''
          }
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.loadTicketComments(ticketId);
  }

  showCommentModal(ticketId) {
    const ticket = this.tickets.find(t => t.id === ticketId);
    
    const modalHtml = `
      <div class="modal" style="display: flex;">
        <div class="modal-content" style="max-width: 90vw; width: 800px;">
          <div class="modal-header">
            <div class="modal-title">
              <h2> Ajouter un commentaire</h2>
              <p class="modal-subtitle">Ticket #${ticketId} - ${ticket ? ticket.title : 'Ticket'}</p>
            </div>
            <button class="modal-close" type="button">&times;</button>
          </div>
          
          <div class="modal-body comment-modal-body" style="padding: 30px;">
            <form id="commentForm" class="comment-form">
              <div class="form-section">
                <div class="form-group">
                  <label class="form-label" for="commentText" style="margin-bottom: 15px; display: block; font-size: 16px;">
                    <span class="label-text">Votre message</span>
                    <span class="label-required">*</span>
                  </label>
                  <div class="textarea-container">
                    <textarea id="commentText" name="comment" class="form-textarea" 
                              style="width: 100%; min-width: 700px; height: 300px; padding: 20px; font-size: 14px; line-height: 1.6; border: 2px solid #e1e5e9; border-radius: 8px; resize: vertical; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" 
                              rows="15" placeholder="Décrivez votre problème, ajoutez des détails ou posez une question...&#10;&#10;Notre équipe vous répondra dans les plus brefs délais." required></textarea>
                    <div class="textarea-help" style="margin-top: 10px;">
                      <span class="help-text" style="color: #6c757d; font-size: 13px;"> Plus vous donnez de détails, plus nous pourrons vous aider efficacement</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="form-footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9;">
                <div class="form-actions" style="display: flex; gap: 15px; justify-content: flex-end;">
                  <button type="submit" class="btn btn-primary btn-large" style="padding: 12px 24px; font-size: 14px;">
                     Publier le commentaire
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Auto-focus on textarea
    setTimeout(() => {
      document.getElementById('commentText').focus();
    }, 100);
    
    document.getElementById('commentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitComment(ticketId);
    });
  }


  async loadTicketComments(ticketId) {
    const container = document.getElementById(`ticketComments-${ticketId}`);
    
    try {
      const response = await api.getTicketComments(ticketId);
      const comments = response.data.comments || [];
      
      if (comments.length === 0) {
        container.innerHTML = `
          <h3 class="section-title"> Commentaires</h3>
          <div class="empty-comments">
            <div class="empty-icon"></div>
            <p class="empty-text">Aucun commentaire pour le moment</p>
            <p class="empty-subtext">Les échanges avec notre équipe apparaîtront ici</p>
          </div>
        `;
        return;
      }

      const commentsHtml = comments.map(comment => `
        <div class="comment-bubble">
          <div class="comment-meta">
            <div class="comment-author">
              <span class="author-icon">${comment.author_name === this.currentUser.email ? 'You' : 'Support'}</span>
              <span class="author-name">${comment.author_name === this.currentUser.email ? 'Vous' : 'Support'}</span>
            </div>
            <div class="comment-date" data-date="${comment.created_at}">${api.formatDateTime(comment.created_at)}</div>
          </div>
          <div class="comment-message">${comment.content}</div>
        </div>
      `).join('');

      container.innerHTML = `
        <h3 class="section-title"> Commentaires (${comments.length})</h3>
        <div class="comments-list">
          ${commentsHtml}
        </div>
      `;
      
      // Mettre à jour les dates avec le bon fuseau horaire après injection DOM
      // Utiliser setTimeout pour s'assurer que le DOM est complètement rendu
      setTimeout(() => {
        updateAllDatesInDOM();
      }, 10);
    } catch (error) {
      console.error('Error loading comments:', error);
      container.innerHTML = `
        <h3>Commentaires</h3>
        <div class="error-message">Erreur lors du chargement des commentaires</div>
      `;
    }
  }

  async submitComment(ticketId) {
    const commentText = document.getElementById('commentText').value.trim();
    
    if (!commentText) {
      alert('Veuillez saisir un commentaire');
      return;
    }

    try {
      const response = await api.createComment(ticketId, { content: commentText });
      
      if (response.success) {
        this.closeModal();
        alert('Commentaire ajouté avec succès');
        this.loadTickets();
      } else {
        alert('Erreur lors de l\'ajout du commentaire: ' + response.message);
      }
    } catch (error) {
      console.error('Comment submission error:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    }
  }

  showCommentForm(ticketId) {
    this.showCommentModal(ticketId);
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

  async handleLogout() {
    // Clear countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    await api.logout();
    window.location.href = '/';
  }

  toggleDropdown(dropdown) {
    // Close all other dropdowns first
    document.querySelectorAll('.dropdown').forEach(d => {
      if (d !== dropdown) {
        d.classList.remove('active');
      }
    });
    
    // Toggle current dropdown
    dropdown.classList.toggle('active');
  }

  setStatusFilter(status) {
    console.log('Setting status filter to:', status);
    this.currentStatusFilter = status;
    
    // Close dropdown
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
    
    // Update dropdown button text
    const dropdownToggle = document.querySelector('.dropdown-toggle span');
    if (dropdownToggle) {
      if (status === '') {
        dropdownToggle.textContent = 'Filtrer par statut';
      } else {
        const statusText = {
          'open': 'Nouveau',
          'in_progress': 'En cours', 
          'waiting_client': 'En attente client',
          'resolved': 'Résolu'
        }[status] || status;
        dropdownToggle.textContent = `Statut: ${statusText}`;
      }
    }
    
    // Close dropdown
    const dropdown = document.querySelector('.dropdown');
    if (dropdown) {
      dropdown.classList.remove('active');
    }
    
    // Apply filter
    this.filterTickets();
  }

  loadTestData() {
    // Charger des données de test pour les tickets statiques
    this.tickets = [
      {
        id: 1,
        title: "Problème de connexion sur l'espace admin",
        description: "Impossible de se connecter à l'interface d'administration depuis hier. L'erreur affichée est \"Identifiants incorrects\" même avec les bons identifiants.",
        status: 'in_progress',
        priority: 'urgent',
        project_id: 1,
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: 2,
        title: "Demande de modification du design de la page d'accueil",
        description: "Nous souhaitons modifier l'apparence de la section héro de notre page d'accueil pour la rendre plus moderne et attractive.",
        status: 'waiting_client',
        priority: 'normal',
        project_id: 2,
        created_at: '2024-01-10T14:15:00Z'
      },
      {
        id: 3,
        title: "Bug sur le processus de commande mobile",
        description: "Les utilisateurs rencontrent une erreur lors de la validation de leur commande sur l'application mobile Android.",
        status: 'resolved',
        priority: 'high',
        project_id: 3,
        created_at: '2024-01-08T09:45:00Z'
      }
    ];

    this.projects = [
      { id: 1, name: 'Site Web E-commerce' },
      { id: 2, name: 'Refonte Interface' },
      { id: 3, name: 'Application Mobile' }
    ];

    this.filteredTickets = this.tickets;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing TicketsApp');
  window.ticketsApp = new TicketsApp();
  // Alias for backward compatibility with clientApp references
  window.clientApp = window.ticketsApp;
});