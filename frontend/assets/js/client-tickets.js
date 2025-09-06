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
      console.log('No token found, redirecting to login');
      window.location.href = '/connexion.html';
      return;
    }

    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      
      // Vérifier si le token n'est pas expiré
      const now = Math.floor(Date.now() / 1000);
      if (tokenData.exp && tokenData.exp < now) {
        console.log('Token expired, redirecting to login');
        localStorage.removeItem('token');
        window.location.href = '/connexion.html';
        return;
      }
      
      this.currentUser = {
        id: tokenData.id,  // Correction: utiliser 'id' au lieu de 'userId'
        email: tokenData.email,
        role: tokenData.role
      };
      
      console.log('User authenticated:', this.currentUser);
      
      // Charger les données réelles depuis l'API
      this.loadRealData();
      
      // Debug: expose this pour les tests en console
      window.debugTicketsApp = this;
      
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('token');
      window.location.href = '/connexion.html';
    }
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
    console.log('🔍 Début filtrage des tickets...');
    console.log('📊 Tickets bruts disponibles:', this.tickets?.length || 0);
    
    try {
      const searchInput = document.getElementById('ticketSearch');
      const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
      const statusFilter = document.getElementById('statusFilter');
      const currentStatus = statusFilter ? statusFilter.value : this.currentStatusFilter;

      this.filteredTickets = this.tickets.filter(ticket => {
        const matchesSearch = !searchTerm || ticket.title.toLowerCase().includes(searchTerm) ||
                             (ticket.description && ticket.description.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !currentStatus || ticket.status === currentStatus;
        const matchesProject = !this.currentProjectId || ticket.project_id === this.currentProjectId;
        
        return matchesSearch && matchesStatus && matchesProject;
      });

      // Trier les tickets par SLA et statut
      this.filteredTickets.sort((a, b) => {
        // D'abord, placer les tickets terminés en fin de liste
        const aCompleted = ['resolved', 'closed'].includes(a.status);
        const bCompleted = ['resolved', 'closed'].includes(b.status);
        
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        
        // Pour les tickets non terminés, trier par SLA (plus urgent en premier)
        if (!aCompleted && !bCompleted) {
          const aSLA = this.calculateSLATimeRemaining(a);
          const bSLA = this.calculateSLATimeRemaining(b);
          
          if (!aSLA && !bSLA) return 0;
          if (!aSLA) return 1;
          if (!bSLA) return -1;
          
          // Les tickets dépassés en premier
          if (aSLA.expired && !bSLA.expired) return -1;
          if (!aSLA.expired && bSLA.expired) return 1;
          
          // Trier par temps restant (moins de temps = plus urgent)
          return aSLA.remaining - bSLA.remaining;
        }
        
        // Pour les tickets terminés, trier par date de création (plus récent en premier)
        return new Date(b.created_at) - new Date(a.created_at);
      });

      console.log('📋 Tickets filtrés:', this.filteredTickets?.length || 0);
      
      this.renderTickets();
      this.updateStatsDisplay();
      
      console.log('✅ Filtrage terminé avec succès');
    } catch (error) {
      console.error('❌ Erreur dans filterTickets:', error);
      throw error;
    }
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
    console.log('🎨 Début du rendu des tickets...');
    const container = document.getElementById('ticketsList');
    
    if (!container) {
      console.error('❌ Element ticketsList not found');
      return;
    }
    
    console.log('📋 Rendu de', this.filteredTickets?.length || 0, 'tickets filtrés');
    
    if (this.filteredTickets.length === 0) {
      console.log('📝 Affichage du message "Aucun ticket"');
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucun ticket trouvé</p></div>';
      return;
    }
    
    // Trier les tickets selon la priorité client
    const sortedTickets = this.sortTicketsForClient(this.filteredTickets);
    
    console.log('🎯 Construction HTML pour', sortedTickets.length, 'tickets triés');

    try {
      const htmlContent = sortedTickets.map((ticket, index) => {
        console.log(`🎫 Rendu du ticket ${index + 1}/${sortedTickets.length}:`, ticket.id, ticket.title);
        
        try {
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
              console.warn('Error formatting date:', dateStr, e);
              return dateStr;
            }
          };
          
          const projectName = this.getProjectName(ticket.project_id);
          const formattedDate = formatDate(ticket.created_at);
          
          console.log(`✅ Ticket ${ticket.id} rendu avec succès`);
          
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
                    ${projectName} • ${formattedDate}
                  </div>
                  <div style="margin-top: 8px;">
                    ${this.formatSLADisplay(this.calculateSLATimeRemaining(ticket))}
                  </div>
                </div>
                <div style="display: flex; gap: 8px; margin-left: 16px;">
                  <button class="btn btn-primary btn-sm view-ticket-btn" data-ticket-id="${ticket.id}" style="padding: 6px 12px; font-size: 13px; background: #0e2433; border: 1px solid #0e2433; color: white; border-radius: 6px;">💬 Conversation</button>
                </div>
              </div>
            </div>
          `;
        } catch (ticketError) {
          console.error(`❌ Erreur rendu ticket ${ticket.id}:`, ticketError);
          return `<div class="error-ticket">Erreur affichage ticket #${ticket.id}</div>`;
        }
      }).join('');
      
      console.log('✅ HTML content généré, longueur:', htmlContent.length);
      container.innerHTML = htmlContent;
      
      // Start countdown updates
      this.startCountdownUpdates();
      
      console.log('🎉 Rendu des tickets terminé avec succès !');
      
    } catch (error) {
      console.error('❌ Erreur fatale dans renderTickets:', error);
      container.innerHTML = '<div class="error-state">Erreur lors de l\'affichage des tickets</div>';
      throw error;
    }
  }

  sortTicketsForClient(tickets) {
    return tickets.sort((a, b) => {
      // Priorité par statut pour les clients
      const statusPriority = {
        'waiting_client': 1,  // En attente client (priorité max pour le client)
        'in_progress': 2,     // En cours
        'open': 3,            // Ouverts
        'resolved': 4,        // Résolus
        'closed': 5           // Fermés
      };

      const statusA = statusPriority[a.status] || 999;
      const statusB = statusPriority[b.status] || 999;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      // Tri secondaire par date de création (plus récent en premier)
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
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
    console.log('=== CRÉATION TICKET CLIENT ===');
    const formData = new FormData(document.getElementById('newTicketForm'));
    const ticketData = {
      project_id: parseInt(formData.get('project_id')),
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      priority: formData.get('priority')
    };

    console.log('Données du formulaire:', ticketData);

    // Client-side validation
    if (!ticketData.project_id) {
      console.log('Erreur de validation: Projet requis');
      alert('Veuillez sélectionner un projet');
      return;
    }
    if (!ticketData.title || ticketData.title.length < 3) {
      console.log('Erreur de validation: Titre requis');
      alert('Le titre doit contenir au moins 3 caractères');
      return;
    }
    if (!ticketData.description || ticketData.description.length < 10) {
      console.log('Erreur de validation: Description requise');
      alert('La description doit contenir au moins 10 caractères');
      return;
    }

    try {
      const submitBtn = document.querySelector('#newTicketForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création...';
      }

      console.log('Appel API createTicket...');
      const response = await api.createTicket(ticketData);
      console.log('Réponse API:', response);
      
      if (response.success) {
        console.log('Ticket créé avec succès');
        this.closeModal();
        this.loadTickets(); // Refresh the list
        alert('Ticket créé avec succès !');
      } else {
        console.log('Erreur API:', response.message);
        alert('Erreur lors de la création du ticket: ' + response.message);
      }
    } catch (error) {
      console.error('Create ticket error:', error);
      alert('Erreur lors de la création du ticket');
    } finally {
      const submitBtn = document.querySelector('#newTicketForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Créer le ticket';
      }
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
    if (!this.projects || !Array.isArray(this.projects)) {
      console.warn('⚠️ Projects not loaded yet, returning default name');
      return `Projet #${projectId}`;
    }
    
    const project = this.projects.find(p => p.id == projectId); // == au lieu de === pour gérer string/number
    const result = project ? project.name : `Projet inconnu #${projectId}`;
    
    if (!project) {
      console.warn(`⚠️ Project not found for ID: ${projectId}, available:`, this.projects.map(p => p.id));
    }
    
    return result;
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
      // Charger les commentaires du ticket (incluant les commentaires de test)
      const comments = await this.loadComments(ticketId);
      console.log('Comments loaded for modal:', comments);
      
      // Attendre les labels asynchrones
      const statusLabel = await this.getStatusLabel(ticket.status);
      const priorityLabel = await this.getPriorityLabel(ticket.priority);

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
                  <div><strong>Statut:</strong> <span class="status-badge status-${ticket.status}">${statusLabel}</span></div>
                  <div><strong>Priorité:</strong> <span class="priority-badge priority-${ticket.priority}">${priorityLabel}</span></div>
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
                      <label for="fileInput" style="display: flex; align-items: center; gap: 6px; color: #6b7280; cursor: pointer; font-size: 14px; transition: color 0.2s;" onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
                        📎 Joindre un fichier
                      </label>
                      <input type="file" id="fileInput" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt" style="display: none;">
                      <div id="fileList" style="font-size: 12px; color: #6b7280;"></div>
                    </div>
                    <button type="submit" id="submitBtn" style="background: #0e2433; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#1e3a8a'" onmouseout="this.style.background='#0e2433'">
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
      
      // Gestionnaire de changement de fichier
      const fileInput = modal.querySelector('#fileInput');
      const fileList = modal.querySelector('#fileList');
      
      fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          const fileNames = Array.from(files).map(file => file.name).join(', ');
          fileList.textContent = `${files.length} fichier(s) sélectionné(s): ${fileNames}`;
          fileList.style.color = '#059669';
        } else {
          fileList.textContent = '';
        }
      });

      // Gestionnaire de soumission de commentaire
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addCommentToTicket(ticketId, e.target);
      });
      
      // Scroller automatiquement vers le bas de la conversation
      setTimeout(() => {
        const commentsList = document.getElementById('commentsList');
        if (commentsList) {
          commentsList.scrollTop = commentsList.scrollHeight;
        }
      }, 100); // Petit délai pour s'assurer que le contenu est rendu
      
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
              ${this.renderAttachments(comment.attachments, isFromClient)}
              ${comment.is_internal ? '<div style="margin-top: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px;">Message interne équipe</div>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderAttachments(attachments, isFromClient) {
    if (!attachments || attachments.length === 0) {
      return '';
    }

    return `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isFromClient ? 'rgba(255,255,255,0.2)' : '#e5e7eb'};">
        ${attachments.map(attachment => {
          const isImage = attachment.mime_type && attachment.mime_type.startsWith('image/');
          const fileIcon = isImage ? '🖼️' : '📎';
          const fileSize = this.formatFileSize(attachment.file_size);
          
          if (attachment.isTestFile) {
            // Mode test - pas de téléchargement possible
            return `
              <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0; padding: 6px 8px; background: ${isFromClient ? 'rgba(255,255,255,0.1)' : '#f3f4f6'}; border-radius: 4px; font-size: 12px;">
                <span>${fileIcon}</span>
                <span style="color: ${isFromClient ? '#d1d5db' : '#6b7280'};">${attachment.original_filename}</span>
                <span style="color: ${isFromClient ? '#9ca3af' : '#9ca3af'};">(${fileSize}) - Test</span>
              </div>
            `;
          } else {
            // Mode production - téléchargement possible
            return `
              <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0; padding: 6px 8px; background: ${isFromClient ? 'rgba(255,255,255,0.1)' : '#f3f4f6'}; border-radius: 4px; font-size: 12px;">
                <span>${fileIcon}</span>
                <a href="javascript:void(0)" 
                   onclick="window.ticketsApp.downloadAttachment(${attachment.id})"
                   style="color: ${isFromClient ? '#93c5fd' : '#3b82f6'}; text-decoration: none; font-weight: 500; cursor: pointer;"
                   onmouseover="this.style.textDecoration='underline'"
                   onmouseout="this.style.textDecoration='none'">
                  ${attachment.original_filename}
                </a>
                <span style="color: ${isFromClient ? '#9ca3af' : '#9ca3af'};">(${fileSize})</span>
              </div>
            `;
          }
        }).join('')}
      </div>
    `;
  }

  downloadAttachment(attachmentId) {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Vous devez être connecté pour télécharger des fichiers');
      return;
    }

    // Créer un lien temporaire avec le token dans les headers
    const url = `/api/attachments/download/${attachmentId}`;
    
    // Utiliser fetch pour télécharger avec authentification
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }
      
      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'fichier';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      return response.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      // Créer un lien de téléchargement temporaire
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(error => {
      console.error('Erreur téléchargement:', error);
      alert('Erreur lors du téléchargement du fichier');
    });
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  calculateSLATimeRemaining(ticket) {
    if (!ticket.created_at || !ticket.priority) {
      return null;
    }

    // Ne calculer les SLA que pour les tickets en cours et en attente client
    if (!['in_progress', 'waiting_client'].includes(ticket.status)) {
      return null;
    }

    // Définir les SLA en heures selon la priorité
    const slaHours = {
      'urgent': 4,
      'high': 24,
      'normal': 72,
      'low': 168
    };

    const slaHour = slaHours[ticket.priority] || 72;
    const createdAt = new Date(ticket.created_at);
    const now = new Date();
    
    // Si le ticket est en attente client, le SLA est en pause
    if (ticket.status === 'waiting_client') {
      return {
        deadline: null,
        remaining: null,
        expired: false,
        paused: true,
        hours: 0,
        minutes: 0
      };
    }
    
    const slaDeadline = new Date(createdAt.getTime() + (slaHour * 60 * 60 * 1000));
    const timeRemaining = slaDeadline.getTime() - now.getTime();
    
    return {
      deadline: slaDeadline,
      remaining: timeRemaining,
      expired: timeRemaining <= 0,
      paused: false,
      hours: Math.floor(Math.abs(timeRemaining) / (1000 * 60 * 60)),
      minutes: Math.floor((Math.abs(timeRemaining) % (1000 * 60 * 60)) / (1000 * 60))
    };
  }

  formatSLADisplay(slaInfo) {
    if (!slaInfo) return '';
    
    if (slaInfo.paused) {
      return `<span style="color: #f59e0b; font-weight: 500;">⏸️ SLA en pause (attente client)</span>`;
    }
    
    if (slaInfo.expired) {
      return `<span style="color: #dc2626; font-weight: 600;">⚠️ Dépassé de ${slaInfo.hours}h${slaInfo.minutes > 0 ? ` ${slaInfo.minutes}min` : ''}</span>`;
    }
    
    let color = '#10b981'; // Vert par défaut
    if (slaInfo.remaining < 2 * 60 * 60 * 1000) { // Moins de 2h
      color = '#dc2626'; // Rouge
    } else if (slaInfo.remaining < 8 * 60 * 60 * 1000) { // Moins de 8h
      color = '#f59e0b'; // Orange
    }
    
    return `<span style="color: ${color}; font-weight: 500;">⏱️ ${slaInfo.hours}h${slaInfo.minutes > 0 ? ` ${slaInfo.minutes}min` : ''}</span>`;
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
    const fileInput = form.querySelector('#fileInput');
    const files = fileInput ? fileInput.files : null;
    
    if (!content && (!files || files.length === 0)) {
      alert('Veuillez saisir un commentaire ou ajouter un fichier');
      return;
    }

    const submitBtn = form.querySelector('#submitBtn');
    const originalText = submitBtn.textContent;
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      // Toujours utiliser l'API maintenant que nous avons un système complet
      try {
        // 1. Créer le commentaire
        const commentResponse = await api.createComment(ticketId, { content });
        
        if (!commentResponse.success) {
          throw new Error(commentResponse.message || 'Erreur lors de la création du commentaire');
        }

        // 2. Uploader les fichiers si présents
        if (files && files.length > 0) {
          const commentId = commentResponse.data.comment.id;
          
          for (let i = 0; i < files.length; i++) {
            try {
              await api.uploadAttachment(commentId, files[i]);
            } catch (uploadError) {
              console.warn(`Erreur upload fichier ${files[i].name}:`, uploadError);
              alert(`Attention: Le fichier "${files[i].name}" n'a pas pu être uploadé`);
            }
          }
        }

        // Success - nettoyer le formulaire et refresh modal
        form.querySelector('#commentContent').value = '';
        if (fileInput) {
          fileInput.value = '';
          const fileList = form.querySelector('#fileList');
          if (fileList) fileList.textContent = '';
        }
        
        this.closeModal();
        this.showTicketModal(ticketId);
      } catch (apiError) {
        console.warn('API comment creation failed, using fallback:', apiError);
        
        // Fallback: ajouter localement en cas d'échec API
        this.addTestComment(ticketId, content, files);
        alert('Commentaire ajouté localement (problème de connexion API)');
        
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

  async getStatusLabel(status) {
    try {
      return await configService.getStatusLabel(status);
    } catch (error) {
      console.error('Erreur récupération label statut:', error);
      return status;
    }
  }

  async getPriorityLabel(priority) {
    try {
      return await configService.getPriorityLabel(priority);
    } catch (error) {
      console.error('Erreur récupération label priorité:', error);
      return priority;
    }
  }

  async loadRealData() {
    try {
      console.log('🔄 Chargement des données en cours...');
      
      // Afficher un indicateur de chargement
      this.updateLoadingState(true);
      
      // Charger la configuration globale d'abord
      await configService.load();
      console.log('✅ Configuration chargée');
      
      // Charger les données de l'utilisateur
      this.loadUserInfo();
      console.log('✅ Informations utilisateur chargées');
      
      // Charger les projets et tickets depuis l'API
      await Promise.all([
        this.loadProjects(),
        this.loadTickets()
      ]);
      
      console.log('✅ Toutes les données réelles chargées avec succès');
      
      // Masquer l'indicateur de chargement
      this.updateLoadingState(false);
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données réelles:', error);
      this.updateLoadingState(false);
      this.showError('Erreur de chargement des données. Veuillez rafraîchir la page.');
    }
  }

  updateLoadingState(isLoading) {
    const ticketsList = document.getElementById('ticketsList');
    if (ticketsList) {
      if (isLoading) {
        ticketsList.innerHTML = '<div class="loading">🔄 Chargement des données...</div>';
      } else if (!this.tickets || this.tickets.length === 0) {
        ticketsList.innerHTML = '<div class="no-data">📋 Aucun ticket trouvé</div>';
      }
      // Sinon les tickets seront affichés par filterTickets()
    }
  }

  async loadProjects() {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/projects', { headers });
      
      if (response.ok) {
        const result = await response.json();
        // L'API retourne {success: true, data: {projects}}
        this.projects = result.success ? (result.data?.projects || result.data || result) : [];
        console.log('Projets chargés:', this.projects);
        this.populateProjectSelector();
      } else {
        const errorText = await response.text();
        console.warn('Erreur chargement projets:', response.status, errorText);
        this.projects = [];
        if (response.status === 401) {
          // Token expiré ou invalide
          localStorage.removeItem('token');
          window.location.href = '/connexion.html';
          return;
        }
        this.showError(`Erreur ${response.status}: Impossible de charger les projets`);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      this.projects = [];
      this.showError('Erreur de connexion lors du chargement des projets.');
    }
  }

  async loadTickets() {
    console.log('🎫 Début du chargement des tickets...');
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token présent:', !!token);
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      let url = '/api/tickets';
      if (this.currentProjectId) {
        url += `?project_id=${this.currentProjectId}`;
      }
      console.log('📡 URL de requête:', url);
      
      const response = await fetch(url, { headers });
      console.log('📨 Réponse reçue, status:', response.status, 'ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📋 Données brutes reçues:', result);
        
        // L'API retourne {success: true, data: {tickets: []}}
        let tickets = [];
        if (result.success && result.data) {
          if (result.data.tickets) {
            tickets = result.data.tickets;
          } else if (Array.isArray(result.data)) {
            tickets = result.data;
          } else {
            tickets = [];
          }
        } else if (Array.isArray(result)) {
          tickets = result;
        }
        
        this.tickets = tickets;
        console.log('✅ Tickets finaux extraits:', this.tickets.length, 'tickets');
        
        this.filterTickets();
        this.updateStatsDisplay();
      } else {
        const errorText = await response.text();
        console.error('❌ Erreur HTTP chargement tickets:', response.status, errorText);
        this.tickets = [];
        if (response.status === 401) {
          // Token expiré ou invalide
          localStorage.removeItem('token');
          window.location.href = '/connexion.html';
          return;
        }
        this.showError(`Erreur ${response.status}: Impossible de charger les tickets`);
      }
    } catch (error) {
      console.error('❌ Exception lors du chargement des tickets:', error);
      console.error('Stack trace:', error.stack);
      this.tickets = [];
      this.showError('Erreur de connexion. Vérifiez votre connexion internet.');
    }
  }

  populateProjectSelector() {
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect && this.projects) {
      projectSelect.innerHTML = '<option value="">Tous les projets</option>';
      this.projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (project.id == this.currentProjectId) {
          option.selected = true;
        }
        projectSelect.appendChild(option);
      });
    }
  }

  showError(message) {
    // Afficher un message d'erreur à l'utilisateur
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <div class="error-content">
        <i class="error-icon">⚠️</i>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    // Auto-supprimer après 5 secondes
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
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

  async loadComments(ticketId) {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/comments/ticket/${ticketId}`, { headers });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Réponse API commentaires pour ticket ${ticketId}:`, result);
        
        // Extraire les commentaires selon le format de réponse de l'API
        let apiComments = [];
        if (result.success && result.data) {
          if (Array.isArray(result.data)) {
            apiComments = result.data;
          } else if (result.data.comments && Array.isArray(result.data.comments)) {
            apiComments = result.data.comments;
          }
        } else if (Array.isArray(result)) {
          apiComments = result;
        }
        
        console.log(`Commentaires API extraits pour ticket ${ticketId}:`, apiComments);
        
        // Charger les pièces jointes pour chaque commentaire API
        for (let comment of apiComments) {
          try {
            const attachmentsResponse = await fetch(`/api/attachments/comment/${comment.id}`, { headers });
            if (attachmentsResponse.ok) {
              const attachmentsResult = await attachmentsResponse.json();
              comment.attachments = attachmentsResult.success ? attachmentsResult.data.attachments : [];
            } else {
              comment.attachments = [];
            }
          } catch (error) {
            console.warn(`Erreur chargement pièces jointes pour commentaire ${comment.id}:`, error);
            comment.attachments = [];
          }
        }
        
        // Ajouter les commentaires de test s'ils existent
        let allComments = [...apiComments];
        if (this.testComments[ticketId]) {
          console.log(`Commentaires de test trouvés pour ticket ${ticketId}:`, this.testComments[ticketId]);
          allComments = [...allComments, ...this.testComments[ticketId]];
        }
        
        // Trier par date de création
        allComments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        console.log(`Tous les commentaires pour ticket ${ticketId}:`, allComments);
        return allComments;
      } else {
        console.warn('Erreur chargement commentaires:', response.status);
        
        // Retourner seulement les commentaires de test en cas d'erreur API
        if (this.testComments[ticketId]) {
          console.log(`Retour des commentaires de test seulement pour ticket ${ticketId}:`, this.testComments[ticketId]);
          return this.testComments[ticketId];
        }
        
        return [];
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
      
      // Retourner seulement les commentaires de test en cas d'erreur
      if (this.testComments[ticketId]) {
        console.log(`Retour des commentaires de test en cas d'erreur pour ticket ${ticketId}:`, this.testComments[ticketId]);
        return this.testComments[ticketId];
      }
      
      return [];
    }
  }

  async addComment(ticketId, content) {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ticket_id: ticketId,
          content: content
        })
      });
      
      if (response.ok) {
        const newComment = await response.json();
        console.log('Commentaire ajouté:', newComment);
        return newComment;
      } else {
        console.error('Erreur ajout commentaire:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      return null;
    }
  }

  addTestComment(ticketId, content, files = null) {
    if (!this.testComments[ticketId]) {
      this.testComments[ticketId] = [];
    }
    
    const comment = {
      id: Date.now(),
      ticket_id: ticketId,
      content: content,
      created_at: new Date().toISOString(),
      user_name: this.currentUser?.email || 'Client',
      role: 'client', // Important: indiquer que c'est un commentaire client
      first_name: 'Vous', // Nom à afficher
      last_name: '',
      attachments: [] // Placeholder pour les pièces jointes en mode test
    };
    
    // En mode test, on simule les pièces jointes (pas d'upload réel)
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        comment.attachments.push({
          id: Date.now() + i,
          original_filename: files[i].name,
          file_size: files[i].size,
          mime_type: files[i].type,
          isTestFile: true // Marquer comme fichier de test
        });
      }
    }
    
    this.testComments[ticketId].push(comment);
    console.log(`Commentaire de test ajouté pour ticket ${ticketId}:`, comment);
  }
}

// Initialiser l'application
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing TicketsApp...');
  window.ticketsApp = new TicketsApp();
});
