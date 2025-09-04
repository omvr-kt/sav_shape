class TicketsApp {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.filteredTickets = [];
    this.projects = [];
    this.currentProjectId = null;
    this.currentStatusFilter = '';
    this.countdownInterval = null;
    this.testComments = {}; // Stockage des commentaires de test
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
    
    // Synchroniser le badge avec les autres pages
    if (typeof window.refreshTicketBadge === 'function') {
      window.refreshTicketBadge();
    }
  }

  updateElementText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
      console.log(`Updated ${elementId} to ${value}`);
    } else {
      console.warn(`Element ${elementId} not found!`);
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
              <button class="btn btn-primary btn-sm view-ticket-btn" data-ticket-id="${ticket.id}" style="padding: 6px 12px; font-size: 13px; background: #0e2433; border: 1px solid #0e2433; color: white; border-radius: 6px;">💬 Conversation</button>
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
        if (typeof window.refreshTicketBadge === 'function') {
          window.refreshTicketBadge();
        }
        
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

  async showTicketModal(ticketId) {
    console.log('showTicketModal called with ID:', ticketId);
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error('Ticket not found with ID:', ticketId);
      return;
    }

    try {
      // Charger les commentaires du ticket
      let comments = [];
      try {
        const response = await api.getTicketComments(ticketId);
        if (response.success) {
          comments = response.data.comments || [];
        }
      } catch (error) {
        console.warn('Could not load comments from API:', error);
        // Utiliser des données de test pour les commentaires
        comments = this.getTestComments(ticketId);
      }

      const modalHtml = `
        <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div class="modal-content" style="background: white; border-radius: 8px; width: 100%; max-width: 1000px; max-height: 90%; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            
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
              
              <!-- Informations principales du ticket -->
              <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Informations du ticket</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                  <div><strong>Statut:</strong> <span class="status-badge status-${ticket.status}">${this.getStatusLabel(ticket.status)}</span></div>
                  <div><strong>Priorité:</strong> <span class="priority-badge priority-${ticket.priority}">${this.getPriorityLabel(ticket.priority)}</span></div>
                  <div><strong>Projet:</strong> ${this.getProjectName(ticket.project_id)}</div>
                  <div><strong>Créé le:</strong> ${new Date(ticket.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
              </div>

              <!-- Description -->
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Description du problème</h3>
                <div style="background: white; border: 1px solid #ddd; padding: 15px; border-radius: 6px; line-height: 1.5; color: #333;">
                  ${ticket.description}
                </div>
              </div>
              
              <!-- Conversation avec l'équipe -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
                <div style="padding: 20px; border-bottom: 1px solid #f3f4f6;">
                  <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0;">Conversation avec l'équipe (<span id="commentsCount">${comments.length}</span>)</h3>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 4px;" id="lastCommentTime">
                    ${comments.length > 0 ? 'Dernière réponse ' + this.formatTimeAgo(comments[comments.length - 1].created_at) : 'Tous les échanges entre vous et notre équipe support'}
                  </div>
                </div>
                <div id="commentsList" style="max-height: 500px; overflow-y: auto; padding: 16px;">
                  ${this.renderComments(comments)}
                </div>
              </div>

              <!-- Zone d'ajout de commentaire -->
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">Ajouter un commentaire</h3>
                    
                <form id="commentForm" style="display: flex; flex-direction: column; gap: 16px;">
                  <textarea 
                    id="commentContent"
                    placeholder="Écrivez votre commentaire ou question ici..."
                    rows="4"
                    style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; line-height: 1.5; resize: vertical; font-family: inherit;"
                    required
                  ></textarea>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <label for="fileInput" style="display: flex; align-items: center; gap: 6px; color: #6b7280; cursor: pointer; font-size: 14px;">
                        📎 Joindre un fichier
                      </label>
                      <input type="file" id="fileInput" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt" style="display: none;">
                    </div>
                    <button type="submit" id="submitBtn" style="background: #0e2433; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;">
                      Envoyer le commentaire
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Injecter dans le DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Gestionnaires d'événements
      const modal = document.querySelector('.modal-overlay');
      const closeBtn = modal.querySelector('.modal-close');
      const commentForm = modal.querySelector('#commentForm');
      
      closeBtn.addEventListener('click', () => this.closeModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
      
      // Gestionnaire de soumission de commentaire
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addCommentToTicket(ticketId, e.target);
      });
      
    } catch (error) {
      console.error('Error showing ticket modal:', error);
      alert('Erreur lors de l\'affichage du ticket');
    }
  }

  renderComments(comments) {
    if (comments.length === 0) {
      return `
        <div style="padding: 40px; text-align: center; color: #9ca3af;">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">💬</div>
          <p>Aucun commentaire pour le moment</p>
          <p style="font-size: 14px;">Soyez le premier à ajouter un commentaire !</p>
        </div>
      `;
    }
    
    return comments.map((comment, index) => {
      // Determine if this is from client or support team
      const isFromClient = comment.role === 'client';
      
      // Get author initials
      const initials = comment.first_name 
          ? comment.first_name.charAt(0).toUpperCase()
          : (isFromClient ? 'V' : 'S'); // V=Vous, S=Support
      
      return `
        <div style="display: flex; ${isFromClient ? 'justify-content: flex-end' : 'justify-content: flex-start'}; margin-bottom: 16px;">
          <div style="max-width: 70%; ${isFromClient ? 'margin-left: auto' : 'margin-right: auto'};">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; ${isFromClient ? 'flex-direction: row-reverse;' : ''}">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isFromClient ? '#0e2433' : '#e3f2fd'}; display: flex; align-items: center; justify-content: center;">
                <span style="color: ${isFromClient ? 'white' : '#1565c0'}; font-weight: 600; font-size: 11px;">
                  ${initials}
                </span>
              </div>
              <span style="font-size: 12px; color: #6b7280; font-weight: 500;">
                ${isFromClient ? 'Vous' : (comment.first_name || 'Équipe support')} ${!isFromClient && comment.last_name ? comment.last_name : ''}
              </span>
              <span style="font-size: 11px; color: #9ca3af;">
                ${this.formatTimeAgo(comment.created_at)}
              </span>
            </div>
            <div style="background: ${isFromClient ? '#0e2433' : '#ffffff'}; color: ${isFromClient ? 'white' : '#374151'}; padding: 12px 16px; border-radius: 12px; ${isFromClient ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: ${isFromClient ? 'none' : '1px solid #e5e7eb'};">
              <div style="line-height: 1.4; font-size: 14px;">
                ${comment.content.replace(/\n/g, '<br>')}
              </div>
              ${comment.is_internal ? '<div style="margin-top: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px;">Message interne équipe</div>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  formatTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'à l\'instant';
    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return this.formatDateTime(dateString);
  }
  
  formatDateTime(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async addCommentToTicket(ticketId, form) {
    const content = form.querySelector('#commentContent').value.trim();
    if (!content) {
      alert('Le commentaire ne peut pas être vide');
      return;
    }

    const submitBtn = form.querySelector('#submitBtn');
    const originalText = submitBtn.textContent;
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      // En mode test, simuler l'ajout du commentaire
      const token = localStorage.getItem('token');
      const isTestMode = !token || token === 'test' || window.location.hostname === 'localhost';

      if (isTestMode) {
        // Simuler un délai d'envoi
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ajouter le nouveau commentaire aux données de test
        this.addTestComment(ticketId, content);
        
        // Afficher une notification de succès
        alert('Commentaire ajouté avec succès !');
        
        // Success - refresh modal avec les nouvelles données
        this.closeModal();
        this.showTicketModal(ticketId);
      } else {
        // Mode production - utiliser l'API
        const commentResponse = await api.createComment(ticketId, { content });
        
        if (!commentResponse.success) {
          throw new Error(commentResponse.message || 'Erreur lors de la création du commentaire');
        }

        // Success - refresh modal
        this.closeModal();
        this.showTicketModal(ticketId);
      }
      
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  getStatusLabel(status) {
    const labels = {
      'open': 'Nouveau',
      'in_progress': 'En cours',
      'waiting_client': 'En attente client',
      'resolved': 'Résolu',
      'closed': 'Fermé'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': 'Basse',
      'normal': 'Normale',
      'high': 'Élevée',
      'urgent': 'Urgente'
    };
    return labels[priority] || priority;
  }

  loadTestData() {
    // Charger des données de test pour la démonstration
    this.projects = [
      { id: 1, name: 'Site Web E-commerce' },
      { id: 2, name: 'Application Mobile' },
      { id: 3, name: 'Refonte Interface' }
    ];
    
    this.tickets = [
      {
        id: 1,
        title: 'Problème de connexion sur l\'espace admin',
        description: 'Depuis hier soir, il m\'est impossible de me connecter à l\'interface d\'administration.',
        status: 'in_progress',
        priority: 'urgent',
        project_id: 1,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // Il y a 2h
      },
      {
        id: 2, 
        title: 'Nouvelle fonctionnalité de recherche',
        description: 'Souhait d\'ajouter un filtre avancé dans la recherche de produits.',
        status: 'open',
        priority: 'normal',
        project_id: 1,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Il y a 1 jour
      },
      {
        id: 3,
        title: 'Bug affichage mobile',
        description: 'Le menu ne s\'affiche pas correctement sur les écrans de téléphone.',
        status: 'resolved',
        priority: 'high',
        project_id: 2,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // Il y a 3 jours
      }
    ];
    
    this.filterTickets();
    this.updateStatsDisplay();
    
    // Populate project selector
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
      projectSelect.innerHTML = '<option value="">Tous les projets</option>';
      this.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
      });
    }
  }

  async handleLogout() {
    localStorage.removeItem('token');
    window.location.href = '/connexion.html';
  }

  setStatusFilter(status) {
    this.currentStatusFilter = status;
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.value = status;
    }
    this.filterTickets();
  }

  toggleDropdown(dropdown) {
    dropdown.classList.toggle('active');
  }

  showCommentForm(ticketId) {
    console.log('showCommentForm called with ID:', ticketId);
    // Cette fonction pourrait ouvrir un formulaire de commentaire séparé
    // Pour l'instant, on redirige vers la vue complète
    this.viewTicket(ticketId);
  }

  initializeTestComments() {
    // Initialiser les commentaires de test si pas déjà fait
    if (Object.keys(this.testComments).length === 0) {
      this.testComments = {
        1: [
          {
            id: 1,
            content: "Bonjour, j'ai bien reçu votre signalement. Je vais investiguer le problème de connexion immédiatement.",
            role: 'admin',
            first_name: 'Thomas',
            last_name: 'Martin',
            is_internal: false,
            created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString() // Il y a 1h30
          },
          {
            id: 2,
            content: "J'ai identifié le problème. Il s'agit d'un souci de cache côté serveur. Je procède à la correction.",
            role: 'admin',
            first_name: 'Thomas',
            last_name: 'Martin',
            is_internal: false,
            created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // Il y a 1h
          },
          {
            id: 3,
            content: "Le client signale un problème critique sur l'admin. Priorité absolue.",
            role: 'admin',
            first_name: 'Sophie',
            last_name: 'Durand',
            is_internal: true, // Message interne entre admins
            created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() // Il y a 45min
          },
          {
            id: 4,
            content: "Merci pour votre réactivité ! Le problème semble maintenant résolu de mon côté.",
            role: 'client',
            first_name: 'Marie',
            last_name: 'Dubois',
            is_internal: false,
            created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() // Il y a 30min
          },
          {
            id: 5,
            content: "Parfait ! Je marque le ticket comme résolu. N'hésitez pas si vous rencontrez d'autres difficultés.",
            role: 'admin',
            first_name: 'Thomas',
            last_name: 'Martin',
            is_internal: false,
            created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() // Il y a 15min
          }
        ],
        2: [
          {
            id: 6,
            content: "Votre demande de nouvelle fonctionnalité a été reçue. Nous allons l'étudier avec l'équipe.",
            role: 'admin',
            first_name: 'Julie',
            last_name: 'Bernard',
            is_internal: false,
            created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() // Il y a 20h
          },
          {
            id: 7,
            content: "Cette fonctionnalité nécessite une analyse approfondie de l'UX. À prévoir pour la v2.1.",
            role: 'admin',
            first_name: 'Marc',
            last_name: 'Lefort',
            is_internal: true, // Message interne
            created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() // Il y a 18h
          }
        ],
        3: [
          {
            id: 8,
            content: "Bug reproduit et corrigé ! La mise à jour sera déployée dans la journée.",
            role: 'admin',
            first_name: 'Alex',
            last_name: 'Moreau',
            is_internal: false,
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // Il y a 2 jours
          }
        ]
      };
    }
  }

  getTestComments(ticketId) {
    this.initializeTestComments();
    return this.testComments[ticketId] || [];
  }

  addTestComment(ticketId, content) {
    this.initializeTestComments();
    
    if (!this.testComments[ticketId]) {
      this.testComments[ticketId] = [];
    }
    
    // Générer un nouvel ID basé sur le nombre total de commentaires
    let maxId = 0;
    Object.values(this.testComments).forEach(comments => {
      comments.forEach(comment => {
        if (comment.id > maxId) maxId = comment.id;
      });
    });
    
    const newComment = {
      id: maxId + 1,
      content: content,
      role: 'client',
      first_name: 'Marie', // Client de test
      last_name: 'Dubois',
      is_internal: false,
      created_at: new Date().toISOString()
    };
    
    this.testComments[ticketId].push(newComment);
    console.log(`Ajouté nouveau commentaire de test pour le ticket ${ticketId}:`, newComment);
  }
}

// Initialiser l'application
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing TicketsApp...');
  window.ticketsApp = new TicketsApp();
});
