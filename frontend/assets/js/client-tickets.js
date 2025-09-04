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

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.filterTickets();
      });
    }

    // Search input (if exists)
    const searchInput = document.getElementById('ticketSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterTickets();
      });
    }

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
      
      // Click outside modal to close (only for modal overlay, not content)
      if (target.classList.contains('modal-overlay')) {
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
        console.log('Target element:', target);
        console.log('Dataset:', target.dataset);
        this.viewTicket(ticketId);
        return;
      }

      // Add comment button
      if (target.classList.contains('add-comment-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        console.log('Add comment button clicked:', ticketId);
        console.log('Target element:', target);
        console.log('Dataset:', target.dataset);
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
    const searchInput = document.getElementById('ticketSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilter = document.getElementById('statusFilter');
    const currentStatus = statusFilter ? statusFilter.value : this.currentStatusFilter;

    this.filteredTickets = this.tickets.filter(ticket => {
      const matchesSearch = !searchTerm || ticket.title.toLowerCase().includes(searchTerm) ||
                           (ticket.description && ticket.description.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !currentStatus || ticket.status === currentStatus;
      
      // Filter by selected project
      const matchesProject = !this.currentProjectId || ticket.project_id == this.currentProjectId;

      return matchesSearch && matchesStatus && matchesProject;
    });

    this.renderTickets();
    this.updateStatsDisplay();
  }

  updateStatsDisplay() {
    // Calculer les statistiques basées sur tous les tickets (pas seulement filtrés)
    const totalCount = this.tickets.length;
    const inProgressCount = this.tickets.filter(ticket => ticket.status === 'in_progress').length;
    const waitingClientCount = this.tickets.filter(ticket => ticket.status === 'waiting_client').length;
    const resolvedCount = this.tickets.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed').length;
    
    // Calculer les tickets actifs (non terminés) pour le badge sidebar
    const activeTicketsCount = this.tickets.filter(ticket => 
      ticket.status !== 'resolved' && ticket.status !== 'closed'
    ).length;

    // Mettre à jour les compteurs dans l'interface
    this.updateElementText('totalTicketsCount', totalCount);
    this.updateElementText('inProgressCount', inProgressCount);
    this.updateElementText('waitingClientCount', waitingClientCount);
    this.updateElementText('resolvedCount', resolvedCount);
    this.updateElementText('ticketCount', activeTicketsCount); // Badge sidebar - tickets actifs uniquement
  }

  updateElementText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  renderTickets() {
    const container = document.getElementById('ticketsList');
    
    if (!container) {
      console.error('Element ticketsList not found');
      return;
    }
    
    if (this.filteredTickets.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucun ticket trouvé</p></div>';
      return;
    }

    container.innerHTML = this.filteredTickets.map(ticket => {
      const statusText = {
        'open': 'Ouvert',
        'in_progress': 'En cours',
        'waiting_client': 'En attente',
        'resolved': 'Résolu',
        'closed': 'Fermé'
      }[ticket.status] || ticket.status;
      
      const priorityText = {
        'low': 'Faible',
        'normal': 'Normal',
        'high': 'Élevé', 
        'urgent': 'Urgent'
      }[ticket.priority] || ticket.priority;
      
      const statusColor = {
        'open': '#2563eb',
        'in_progress': '#f59e0b', 
        'waiting_client': '#06b6d4',
        'resolved': '#10b981',
        'closed': '#6b7280'
      }[ticket.status] || '#6b7280';
      
      const formatDate = (dateStr) => {
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          return dateStr;
        }
      };
      
      return `
        <div class="list-item" style="border-bottom: 1px solid #e5e7eb; padding: 20px; transition: background-color 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #6b7280;">#${ticket.id}</span>
                <span style="width: 8px; height: 8px; background: ${statusColor}; border-radius: 50%; display: inline-block;" title="${statusText}"></span>
                <span style="font-size: 12px; color: #9ca3af;">${priorityText}</span>
              </div>
              <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0; line-height: 1.4;">${ticket.title}</h4>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.4; margin: 0 0 8px 0;">${ticket.description}</p>
              <div style="font-size: 12px; color: #9ca3af;">
                ${this.getProjectName(ticket.project_id)} • ${formatDate(ticket.created_at)}
              </div>
            </div>
            <div style="display: flex; gap: 8px; margin-left: 16px;">
              <button class="btn btn-outline btn-sm view-ticket-btn" data-ticket-id="${ticket.id}" style="padding: 6px 12px; font-size: 13px; background: #f9fafb; border: 1px solid #d1d5db; color: #374151; border-radius: 6px;">Voir</button>
              <button class="btn btn-primary btn-sm add-comment-btn" data-ticket-id="${ticket.id}" style="padding: 6px 12px; font-size: 13px; background: #0e2433; border: 1px solid #0e2433; color: white; border-radius: 6px;">Répondre</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
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
      priority: formData.get('priority') || 'normal'
    };

    try {
      // En mode test/développement, ajouter directement aux données locales
      const token = localStorage.getItem('token');
      const isTestMode = !token || token === 'test' || window.location.hostname === 'localhost';
      
      if (isTestMode) {
        console.log('Mode test: ajout du ticket localement');
        
        // Créer un nouveau ticket avec un ID unique
        const newTicket = {
          id: this.tickets.length + 1,
          title: ticketData.title,
          description: ticketData.description,
          status: 'open', // Nouveau ticket
          priority: ticketData.priority,
          project_id: ticketData.project_id,
          created_at: new Date().toISOString()
        };
        
        // Ajouter aux données locales
        this.tickets.push(newTicket);
        
        // Mettre à jour l'affichage
        this.filterTickets();
        
        // Mettre à jour le badge sidebar sur toutes les pages
        updateTicketBadge();
        
        this.closeModal();
        alert('Ticket créé avec succès !');
        
      } else {
        // Mode production : utiliser l'API réelle
        const response = await api.createTicket(ticketData);
        
        if (response.success) {
          this.closeModal();
          this.loadTickets(); // Refresh the list
          alert('Ticket créé avec succès !');
        } else {
          alert('Erreur lors de la création du ticket: ' + response.message);
        }
      }
      
    } catch (error) {
      console.error('Create ticket error:', error);
      alert('Erreur lors de la création du ticket');
    }
  }

  closeModal() {
    console.log('closeModal called');
    
    // Fermer toutes les modales avec les nouvelles classes
    const modals = document.querySelectorAll('.modal, .modal-overlay');
    console.log('Found modals to close:', modals.length);
    
    modals.forEach(modal => {
      console.log('Removing modal:', modal);
      modal.remove();
    });
    
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
    
    console.log('Modals closed');
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
    if (typeof businessHours !== 'undefined') {
      const created = new Date(dateString);
      return businessHours.getBusinessDelayClass(created, priority);
    }
    return 'sla-good';
  }

  getCountdown(dateString, priority) {
    if (typeof businessHours !== 'undefined') {
      const created = new Date(dateString);
      return businessHours.getBusinessCountdown(created, priority);
    }
    return 'Dans les délais';
  }

  formatSLACountdown(ticket) {
    const countdown = this.getCountdown(ticket.created_at, ticket.priority);
    const delayClass = this.getDelayClass(ticket.created_at, ticket.priority);
    return `<span class="sla-status ${delayClass}">${countdown}</span>`;
  }

  getStatusClass(status) {
    return `status-${status}`;
  }

  getPriorityClass(priority) {
    return `priority-${priority}`;
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
    console.log('viewTicket called with ID:', ticketId);
    console.log('Available tickets:', this.tickets);
    this.showTicketModal(ticketId);
  }

  addComment(ticketId) {
    console.log('addComment called with ID:', ticketId);
    this.showCommentModal(ticketId);
  }

  showTicketModal(ticketId) {
    console.log('showTicketModal called with ID:', ticketId);
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error('Ticket not found with ID:', ticketId);
      return;
    }
    console.log('Found ticket:', ticket);

    console.log('Creating modal HTML...');
    
    // Version simplifiée et plus lisible
    const modalHtml = `
      <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="modal-content" style="background: white; border-radius: 8px; width: 100%; max-width: 800px; max-height: 90%; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          
          <!-- Header -->
          <div style="padding: 20px 20px 15px 20px; border-bottom: 1px solid #eee; background: #f8f9fa; border-radius: 8px 8px 0 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h2 style="margin: 0 0 5px 0; color: #333; font-size: 20px;">Ticket #${ticket.id}</h2>
                <p style="margin: 0; color: #666; font-size: 14px;">${ticket.title}</p>
              </div>
              <button class="modal-close" style="background: #f1f3f4; border: none; font-size: 18px; cursor: pointer; color: #5f6368; padding: 8px; line-height: 1; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-weight: bold;">×</button>
            </div>
          </div>
          
          <!-- Body -->
          <div style="padding: 20px;">
            
            <!-- Informations -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Informations du ticket</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                <div><strong>Statut:</strong> <span style="color: #0066cc;">${ticket.status}</span></div>
                <div><strong>Priorité:</strong> <span style="color: #dc3545;">${ticket.priority}</span></div>
                <div><strong>Projet:</strong> ${this.getProjectName(ticket.project_id)}</div>
                <div><strong>Créé le:</strong> ${new Date(ticket.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
            </div>

            <!-- Description -->
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Description</h3>
              <div style="background: white; border: 1px solid #ddd; padding: 15px; border-radius: 6px; line-height: 1.5; color: #333;">
                ${ticket.description}
              </div>
            </div>

            <!-- Commentaires -->
            <div style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Historique des échanges</h3>
              <div id="ticketComments-${ticket.id}" style="min-height: 100px;">
                <div style="text-align: center; color: #666; padding: 20px;">Chargement des commentaires...</div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="padding: 15px 20px; background: #f8f9fa; border-top: 1px solid #eee; border-radius: 0 0 8px 8px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 12px; color: #666;">
              Ticket créé le ${new Date(ticket.created_at).toLocaleDateString('fr-FR')}
            </div>
            <div>
              <button class="show-comment-form-btn" data-ticket-id="${ticket.id}" style="padding: 8px 16px; background: #0e2433; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 14px;">
                Répondre
              </button>
              <button class="modal-close" style="padding: 10px 20px; background: #ffffff; color: #374151; border: 2px solid #d1d5db; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; min-width: 80px;">
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    console.log('Injecting modal...');
    
    // Ajouter les styles pour les boutons si pas déjà fait
    if (!document.getElementById('modal-button-styles')) {
      const styles = document.createElement('style');
      styles.id = 'modal-button-styles';
      styles.textContent = `
        /* Boutons fermer ronds */
        button[style*="border-radius: 50%"]:hover {
          background: #e8eaed !important;
          color: #202124 !important;
          transform: scale(1.05);
        }
        
        /* Boutons annuler/fermer */
        button[style*="background: #ffffff"]:hover {
          background: #f9fafb !important;
          border-color: #9ca3af !important;
          color: #111827 !important;
        }
        
        /* Boutons primaires Shape */
        button[style*="background: #0e2433"]:hover {
          background: #1a3547 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(14, 36, 51, 0.3) !important;
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    console.log('Modal injected');
    
    // Attendre un peu avant d'ajouter les event listeners pour éviter les fermetures immédiates
    setTimeout(() => {
      console.log('Setting up modal event listeners...');
      
      // Vérifier que la modale existe encore
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        console.log('Modal still exists, loading comments...');
        this.loadTicketComments(ticketId);
      } else {
        console.log('Modal was closed before event listeners could be set up');
      }
    }, 100);
  }

  showCommentModal(ticketId) {
    console.log('showCommentModal called with ID:', ticketId);
    const ticket = this.tickets.find(t => t.id === ticketId);
    
    console.log('Creating comment modal HTML...');
    
    const modalHtml = `
      <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90%; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
            <h2 style="margin: 0;">Ajouter un commentaire</h2>
            <button class="modal-close" style="background: #f1f3f4; border: none; font-size: 18px; cursor: pointer; color: #5f6368; padding: 8px; line-height: 1; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-weight: bold;">×</button>
          </div>
          
          <div style="margin-bottom: 15px;">
            <p style="color: #666; margin: 0;"><strong>Ticket #${ticketId}:</strong> ${ticket ? ticket.title : 'Ticket'}</p>
          </div>
          
          <form id="commentForm">
            <div style="margin-bottom: 20px;">
              <label for="commentText" style="display: block; margin-bottom: 10px; font-weight: bold;">Votre message *</label>
              <textarea 
                id="commentText" 
                style="width: 100%; height: 150px; padding: 15px; border: 2px solid #ddd; border-radius: 4px; resize: vertical; font-family: inherit;" 
                placeholder="Décrivez votre problème ou ajoutez des détails..." 
                required
              ></textarea>
              <small style="color: #666; font-size: 12px;">Plus vous donnez de détails, plus nous pourrons vous aider efficacement</small>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 10px; font-weight: bold;">Pièce jointe (optionnelle)</label>
              <div style="border: 2px dashed #ddd; border-radius: 4px; padding: 20px; text-align: center; background: #fafafa;">
                <input 
                  type="file" 
                  id="attachmentFile" 
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip"
                  style="display: none;"
                >
                <div id="fileDropZone" style="cursor: pointer;">
                  <div style="margin-bottom: 10px; color: #666;">
                    Cliquez pour choisir un fichier ou glissez-déposez ici
                  </div>
                  <div style="font-size: 12px; color: #999;">
                    Formats acceptés: Images, PDF, Word, texte, ZIP (10MB max)
                  </div>
                </div>
                <div id="selectedFile" style="display: none; margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <span id="fileName" style="font-weight: bold;"></span>
                      <span id="fileSize" style="color: #666; font-size: 12px; margin-left: 10px;"></span>
                    </div>
                    <button type="button" id="removeFile" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 12px;">
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #eee;">
              <button type="button" class="modal-close" style="padding: 10px 20px; background: #ffffff; color: #374151; border: 2px solid #d1d5db; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.15s; min-width: 100px;">
                Annuler
              </button>
              <button type="submit" style="padding: 10px 20px; background: #0e2433; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.15s; min-width: 140px; box-shadow: 0 2px 4px rgba(14, 36, 51, 0.2);">
                Publier le commentaire
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    console.log('Injecting comment modal...');
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    console.log('Comment modal injected');
    
    // Attendre un peu avant de configurer pour éviter les fermetures immédiates
    setTimeout(() => {
      console.log('Setting up comment form...');
      
      const modal = document.querySelector('.modal-overlay');
      if (!modal) {
        console.log('Comment modal was closed before setup');
        return;
      }
      
      const form = document.getElementById('commentForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitComment(ticketId);
        });
        console.log('Comment form event listener added');
      }
      
      // Gestion des pièces jointes
      this.setupFileHandling();
      
      // Auto-focus
      const textarea = document.getElementById('commentText');
      if (textarea) {
        textarea.focus();
        console.log('Textarea focused');
      }
    }, 100);
  }

  setupFileHandling() {
    console.log('Setting up file handling...');
    
    const fileInput = document.getElementById('attachmentFile');
    const dropZone = document.getElementById('fileDropZone');
    const selectedFileDiv = document.getElementById('selectedFile');
    const fileNameSpan = document.getElementById('fileName');
    const fileSizeSpan = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFile');

    if (!fileInput || !dropZone) {
      console.log('File elements not found');
      return;
    }

    // Clic sur la zone de dépôt
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Sélection de fichier
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelection(file);
      }
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#007bff';
      dropZone.style.background = '#f0f8ff';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#ddd';
      dropZone.style.background = '#fafafa';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#ddd';
      dropZone.style.background = '#fafafa';
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelection(files[0]);
      }
    });

    // Supprimer le fichier
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', () => {
        this.removeSelectedFile();
      });
    }
  }

  handleFileSelection(file) {
    console.log('File selected:', file.name, file.size);
    
    // Vérifier la taille (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Le fichier est trop volumineux. Taille maximale: 10MB');
      return;
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'text/plain', 'application/zip'];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Type de fichier non autorisé. Veuillez choisir une image, PDF, Word, texte ou ZIP.');
      return;
    }

    // Afficher le fichier sélectionné
    const fileNameSpan = document.getElementById('fileName');
    const fileSizeSpan = document.getElementById('fileSize');
    const selectedFileDiv = document.getElementById('selectedFile');
    const dropZone = document.getElementById('fileDropZone');

    if (fileNameSpan && fileSizeSpan && selectedFileDiv && dropZone) {
      fileNameSpan.textContent = file.name;
      fileSizeSpan.textContent = `(${this.formatFileSize(file.size)})`;
      
      dropZone.style.display = 'none';
      selectedFileDiv.style.display = 'block';
    }
  }

  removeSelectedFile() {
    console.log('Removing selected file');
    
    const fileInput = document.getElementById('attachmentFile');
    const selectedFileDiv = document.getElementById('selectedFile');
    const dropZone = document.getElementById('fileDropZone');

    if (fileInput) fileInput.value = '';
    if (selectedFileDiv) selectedFileDiv.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async loadTicketComments(ticketId) {
    const container = document.getElementById(`ticketComments-${ticketId}`);
    
    try {
      // Données de test pour les commentaires
      const testComments = [
        {
          id: 1,
          content: "Nous avons pris en compte votre demande et analysons le problème.",
          author_name: "support@shape.fr",
          created_at: "2024-01-15T11:30:00Z"
        },
        {
          id: 2,
          content: "Merci pour votre retour rapide. J'attends vos nouvelles.",
          author_name: this.currentUser.email,
          created_at: "2024-01-15T12:00:00Z"
        }
      ];

      let comments = [];
      
      // Utiliser les données de test par défaut (mode démo)
      console.log('Mode démo activé, utilisation des données de test');
      comments = ticketId <= 2 ? testComments : [];
      
      // Optionnel : essayer l'API seulement si explicitement demandé
      // if (window.api && localStorage.getItem('useRealAPI') === 'true') {
      //   try {
      //     const response = await api.getTicketComments(ticketId);
      //     comments = response.data.comments || [];
      //   } catch (apiError) {
      //     console.log('API non disponible, retour aux données de test');
      //     comments = ticketId <= 2 ? testComments : [];
      //   }
      // }
      
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

      const safeFormatDateTime = (dateTime) => {
        try {
          return window.api ? api.formatDateTime(dateTime) : new Date(dateTime).toLocaleDateString('fr-FR');
        } catch (e) {
          return new Date(dateTime).toLocaleDateString('fr-FR');
        }
      };

      const commentsHtml = comments.map(comment => `
        <div class="comment-bubble">
          <div class="comment-meta">
            <div class="comment-author">
              <span class="author-icon">${comment.author_name === this.currentUser.email ? 'You' : 'Support'}</span>
              <span class="author-name">${comment.author_name === this.currentUser.email ? 'Vous' : 'Support'}</span>
            </div>
            <div class="comment-date" data-date="${comment.created_at}">${safeFormatDateTime(comment.created_at)}</div>
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
      
      // Mettre à jour les dates avec le bon fuseau horaire après injection DOM si disponible
      setTimeout(() => {
        if (typeof updateAllDatesInDOM === 'function') {
          updateAllDatesInDOM();
        }
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
    const fileInput = document.getElementById('attachmentFile');
    const selectedFile = fileInput ? fileInput.files[0] : null;
    
    if (!commentText) {
      alert('Veuillez saisir un commentaire');
      return;
    }

    try {
      // Mode démo : simuler l'ajout du commentaire avec pièce jointe
      const submitData = { 
        ticketId, 
        commentText,
        hasAttachment: !!selectedFile,
        attachmentName: selectedFile ? selectedFile.name : null,
        attachmentSize: selectedFile ? this.formatFileSize(selectedFile.size) : null
      };
      
      console.log('Mode démo : simulation ajout commentaire', submitData);
      
      // Simuler un délai d'API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.closeModal();
      
      if (selectedFile) {
        alert(`Commentaire et pièce jointe "${selectedFile.name}" ajoutés avec succès (mode démo)`);
      } else {
        alert('Commentaire ajouté avec succès (mode démo)');
      }
      
      // Optionnel : essayer l'API réelle si demandée
      // if (window.api && localStorage.getItem('useRealAPI') === 'true') {
      //   const formData = new FormData();
      //   formData.append('content', commentText);
      //   if (selectedFile) {
      //     formData.append('attachment', selectedFile);
      //   }
      //   
      //   const response = await api.createComment(ticketId, formData);
      //   if (response.success) {
      //     this.closeModal();
      //     alert('Commentaire ajouté avec succès');
      //     this.loadTickets();
      //   } else {
      //     alert('Erreur lors de l\'ajout du commentaire: ' + response.message);
      //   }
      // }
      
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
    // Charger des données de test pour les tickets avec des dates récentes
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    
    this.tickets = [
      {
        id: 1,
        title: "Problème de connexion sur l'espace admin",
        description: "Impossible de se connecter à l'interface d'administration depuis hier. L'erreur affichée est \"Identifiants incorrects\" même avec les bons identifiants.",
        status: 'in_progress',
        priority: 'urgent',
        project_id: 1,
        created_at: yesterday.toISOString()
      },
      {
        id: 2,
        title: "Demande de modification du design de la page d'accueil",
        description: "Nous souhaitons modifier l'apparence de la section héro de notre page d'accueil pour la rendre plus moderne et attractive.",
        status: 'waiting_client',
        priority: 'normal',
        project_id: 2,
        created_at: twoDaysAgo.toISOString()
      },
      {
        id: 3,
        title: "Bug sur le processus de commande mobile",
        description: "Les utilisateurs rencontrent une erreur lors de la validation de leur commande sur l'application mobile Android.",
        status: 'resolved',
        priority: 'high',
        project_id: 3,
        created_at: threeDaysAgo.toISOString()
      }
    ];

    this.projects = [
      { id: 1, name: 'Site Web E-commerce' },
      { id: 2, name: 'Refonte Interface' },
      { id: 3, name: 'Application Mobile' }
    ];

    this.filteredTickets = this.tickets;
    this.renderTickets();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing TicketsApp');
  window.ticketsApp = new TicketsApp();
  // Alias for backward compatibility with clientApp references
  window.clientApp = window.ticketsApp;
});