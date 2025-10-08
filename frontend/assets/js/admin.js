class AdminApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'dashboard';
    this.projects = []; // Initialiser la liste des projets
    this.currentProject = null; // Projet actuellement affiché dans le kanban
    this.sortableInstances = {}; // Pour le drag & drop du kanban
    this.movingTasks = new Set(); // Verrou pour moves en cours
    this.debug = false; // Active les logs DnD si true
    this.init();
  }

  init() {
    this.checkAuth();
    this.setupEventListeners();
    this.loadDashboard();
    // Initialiser le badge tickets pour l'admin
    if (typeof initTicketBadge === 'function') {
      initTicketBadge();
    }
    // Précharger Sortable pour éviter tout délai lors de l'ouverture du Kanban
    this.ensureSortableLoaded().catch(() => {});
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      // Rediriger vers la page de connexion
      window.location.href = '/connexion.html';
      return;
    }

    this.loadUserProfile();
  }

  async loadUserProfile() {
    try {
      const response = await api.getProfile();
      this.currentUser = response.data.user;
      
      if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'team') {
        alert('Accès non autorisé - Vous n\'êtes pas administrateur');
        window.location.href = '/connexion.html';
        return;
      }

      this.showMainApp();
    } catch (error) {
      console.error('Profile load error:', error);
      // Token invalide, rediriger vers la connexion
      localStorage.removeItem('token');
      window.location.href = '/connexion.html';
    }
  }

  showMainApp() {
    // App is now visible by default with sidebar structure
    document.getElementById('currentUser').textContent = 
      `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    
    // Afficher le lien Kanban Dev pour admins et développeurs
    const devKanbanLink = document.getElementById('devKanbanLink');
    console.log('Lien Kanban Dev trouvé:', devKanbanLink);
    console.log('Rôle utilisateur:', this.currentUser.role);
    if (devKanbanLink && (this.currentUser.role === 'admin' || this.currentUser.role === 'developer')) {
      devKanbanLink.style.display = 'block';
      console.log('Lien Kanban Dev affiché');
    } else if (devKanbanLink) {
      devKanbanLink.style.display = 'none';
      console.log('Lien Kanban Dev caché');
    }
    
    // Set initial title based on current tab
    this.updateTitle();
  }

  updateTitle() {
    // Title mapping for each tab
    const tabTitles = {
      'dashboard': 'Tableau de bord',
      'tickets': 'Gestion des Tickets',
      'projects': 'Gestion des Projets',
      'clients': 'Gestion des Clients',
      'invoices': 'Gestion de la Facturation'
    };

    const mainTitle = document.querySelector('.main-title');
    if (mainTitle && tabTitles[this.currentTab]) {
      mainTitle.textContent = tabTitles[this.currentTab];
    }

    // Update header actions
    this.updateHeaderActions();
  }

  updateHeaderActions() {
    const headerActions = document.getElementById('mainHeaderActions');
    if (!headerActions) return;

    // Clear existing actions
    headerActions.innerHTML = '';

    // Define actions for each tab
    const tabActions = {
      'tickets': `
        <div class="header-filters">
          <select id="statusFilter" class="filter-select">
            <option value="">Tous les statuts</option>
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="waiting_client">Attente client</option>
            <option value="resolved">Résolu</option>
          </select>
          <select id="priorityFilter" class="filter-select">
            <option value="">Toutes les priorités</option>
            <option value="urgent">Urgent</option>
            <option value="high">Élevée</option>
            <option value="normal">Normale</option>
            <option value="low">Faible</option>
          </select>
          <button id="refreshTickets" class="btn btn-secondary btn-sm">Actualiser</button>
        </div>
      `,
      'projects': `
        <button id="addProjectBtn" class="btn btn-primary">+ Nouveau Projet</button>
      `,
      'clients': `
        <button id="addClientBtn" class="btn btn-primary">+ Nouveau Client</button>
      `,
      'invoices': `
        <div class="header-filters">
          <select id="invoiceStatusFilter" class="filter-select">
            <option value="">Tous les statuts</option>
            <option value="sent">Envoyée</option>
            <option value="paid">Payée</option>
            <option value="overdue">En retard</option>
            <option value="cancelled">Annulée</option>
          </select>
          <button id="refreshInvoices" class="btn btn-secondary btn-sm">Actualiser</button>
          <button id="newInvoiceBtn" class="btn btn-primary">+ Nouvelle Facture</button>
        </div>
      `,
      'project-kanban': `
        <button id="backToProjectsBtn" class="btn btn-secondary">← Retour aux projets</button>
        <button id="createTaskBtn" class="btn btn-primary">+ Nouvelle tâche</button>
      `
    };

    // Add actions for current tab
    if (tabActions[this.currentTab]) {
      headerActions.innerHTML = tabActions[this.currentTab];
      
      // Re-bind event listeners for the new elements
      this.bindHeaderActionEvents();
    }
  }

  bindHeaderActionEvents() {
    // Rebind events for moved elements
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const refreshTickets = document.getElementById('refreshTickets');
    const addProjectBtn = document.getElementById('addProjectBtn');
    const addClientBtn = document.getElementById('addClientBtn');
    const newInvoiceBtn = document.getElementById('newInvoiceBtn');
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    const refreshInvoices = document.getElementById('refreshInvoices');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadTickets());
    }
    if (priorityFilter) {
      priorityFilter.addEventListener('change', () => this.loadTickets());
    }
    if (refreshTickets) {
      refreshTickets.addEventListener('click', () => this.loadTickets());
    }
    if (addProjectBtn) {
      addProjectBtn.addEventListener('click', () => this.showAddProjectModal());
    }
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => this.showAddClientModal());
    }
    if (newInvoiceBtn) {
      newInvoiceBtn.addEventListener('click', () => this.showNewInvoiceModal());
    }
    if (invoiceStatusFilter) {
      invoiceStatusFilter.addEventListener('change', () => this.loadInvoices());
    }
    if (refreshInvoices) {
      refreshInvoices.addEventListener('click', () => this.loadInvoices());
    }
  }

  setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    // Navigation tabs (sidebar items)
    document.querySelectorAll('.sidebar__nav-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Ne pas empêcher le comportement par défaut pour le lien Kanban Dev
        if (tab.id === 'devKanbanLink') {
          console.log('Clic sur Kanban Dev - navigation autorisée vers:', tab.href);
          return;
        }
        
        console.log('Clic sur onglet:', tab.dataset.tab);
        e.preventDefault();
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Refresh buttons
    document.getElementById('refreshTickets')?.addEventListener('click', () => {
      this.loadTickets();
    });

    document.getElementById('refreshInvoices')?.addEventListener('click', () => {
      this.loadInvoices();
    });

    // Add buttons - removed duplicates as they are handled in setupEventListeners()

    document.getElementById('newInvoiceBtn')?.addEventListener('click', () => {
      this.showNewInvoiceModal();
    });

    // Filters
    document.getElementById('statusFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });

    document.getElementById('priorityFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });

    document.getElementById('invoiceStatusFilter')?.addEventListener('change', () => {
      this.loadInvoices();
    });
  }


  async logout() {
    await api.logout();
    this.currentUser = null;
    window.location.href = '/connexion.html';
  }

  switchTab(tabName) {
    // Reset kanban view if currently in project kanban mode
    if (this.currentTab === 'project-kanban') {
      const projectKanban = document.getElementById('projectKanban');
      const projectsList = document.getElementById('projects');
      
      if (projectKanban) {
        projectKanban.style.display = 'none';
      }
      
      // Only show projects list if we're switching to the projects tab
      if (projectsList && tabName === 'projects') {
        projectsList.style.display = 'block';
      } else if (projectsList) {
        projectsList.style.display = 'none';
      }
      
      this.currentProject = null;
    }

    // Update navigation
    document.querySelectorAll('.sidebar__nav-item').forEach(tab => {
      tab.classList.remove('sidebar__nav-item--active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('sidebar__nav-item--active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // Update main title
    this.updateTitle();

    // Load data for the tab
    switch (tabName) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'tickets':
        this.loadTickets();
        break;
      case 'projects':
        this.loadProjects();
        break;
      case 'clients':
        this.loadClients();
        break;
      case 'invoices':
        this.loadInvoices();
        break;
    }
  }

  async loadDashboard() {
    try {
      const [statsResponse, clientsResponse, recentResponse] = await Promise.all([
        api.getTicketStats(),
        api.getUsers({ role: 'client' }),
        api.getTickets({ limit: 5 })
      ]);

      const stats = statsResponse.data.stats;
      const clients = clientsResponse.data.users;
      
      // Update stats cards
      document.getElementById('totalTickets').textContent = stats.total;
      document.getElementById('urgentTickets').textContent = 
        (await api.getTickets({ priority: 'urgent', status: 'open' })).data.tickets.length;
      document.getElementById('totalClients').textContent = clients.length;
      document.getElementById('resolvedTickets').textContent = stats.resolved;

      // Update recent clients
      this.renderRecentClients(clients.slice(0, 5));

      // Update recent tickets
      this.renderRecentTickets(recentResponse.data.tickets.slice(0, 5));

    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }

  renderRecentClients(clients) {
    const container = document.getElementById('recentClientsList');
    
    if (clients.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun client</div>';
      return;
    }

    container.innerHTML = clients.map(client => `
      <div class="client-item">
        <div class="client-title">${client.first_name} ${client.last_name}</div>
        <div class="client-meta">
          <span>${client.company || client.email}</span>
          <div class="client-badges">
            <span class="status-badge ${client.is_active ? 'status-active' : 'status-inactive'}">
              ${client.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderRecentTickets(tickets) {
    const container = document.getElementById('recentTicketsList');
    
    if (tickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket récent</div>';
      return;
    }

    container.innerHTML = tickets.map(ticket => `
      <div class="ticket-item">
        <div class="ticket-title">${ticket.title}</div>
        <div class="ticket-meta">
          <span>${api.formatDate(ticket.created_at)}</span>
          <div class="ticket-badges">
            <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
            <span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  async loadTickets() {
    const container = document.getElementById('ticketsList');
    container.innerHTML = '<div class="loading">Chargement des tickets...</div>';

    try {
      const filters = {};
      const statusFilter = document.getElementById('statusFilter')?.value;
      const priorityFilter = document.getElementById('priorityFilter')?.value;

      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;

      console.log('Admin - Chargement tickets avec filtres:', filters);
      const response = await api.getTickets(filters);
      console.log('Admin - Réponse API tickets:', response);
      
      if (response.data && response.data.tickets) {
        console.log('Admin - Nombre de tickets reçus:', response.data.tickets.length);
        console.log('Admin - Détail des tickets:', response.data.tickets.map(t => ({id: t.id, title: t.title, status: t.status})));
        this.renderTicketsTable(response.data.tickets);
      } else {
        console.error('Invalid response format:', response);
        container.innerHTML = '<div class="error-message">Format de réponse invalide</div>';
      }
    } catch (error) {
      console.error('Tickets load error:', error);
      container.innerHTML = `<div class="error-message">Erreur lors du chargement des tickets: ${error.message}</div>`;
    }
  }

  renderTicketsTable(tickets) {
    const container = document.getElementById('ticketsList');
    
    if (!tickets || tickets.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucun ticket trouvé</p></div>';
      return;
    }

    // Trier les tickets selon la priorité admin
    const sortedTickets = this.sortTicketsForAdmin(tickets);

    const tableHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Client</th>
            <th>Projet</th>
            <th>Priorité</th>
            <th>Statut</th>
            <th>SLA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sortedTickets.map(ticket => `
            <tr>
              <td>${ticket.title}</td>
              <td>${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</td>
              <td>${ticket.project_name}</td>
              <td><span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span></td>
              <td><span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span></td>
              <td>${this.formatSLADisplay(this.calculateSLATimeRemaining(ticket))}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-ticket-id="${ticket.id}" data-action="view"> Voir</button>
                  <button class="btn-action btn-edit" data-ticket-id="${ticket.id}" data-action="edit"> Éditer</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
    
    // Ajouter les event listeners pour les boutons
    const viewButtons = container.querySelectorAll('.btn-view');
    const editButtons = container.querySelectorAll('.btn-edit');
    
    // Event listeners pour les boutons Voir
    viewButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const ticketId = parseInt(e.target.dataset.ticketId);
        this.viewTicket(ticketId);
      });
    });
    
    // Event listeners pour les boutons Éditer
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const ticketId = parseInt(e.target.dataset.ticketId);
        this.editTicket(ticketId);
      });
    });
  }

  async loadProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '<div class="loading">Chargement des projets...</div>';

    try {
      const response = await api.getProjects();
      this.projects = response.data.projects; // Stocker les projets pour utilisation dans viewProject
      this.renderProjectsTable(response.data.projects);
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des projets</div>';
    }
  }

  renderProjectsTable(projects) {
    const container = document.getElementById('projectsList');
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucun projet trouvé</p></div>';
      return;
    }

    const tableHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Client</th>
            <th>Statut</th>
            <th>Tickets</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${projects.map(project => `
            <tr>
              <td>${project.name}</td>
              <td>${project.client_company || project.client_first_name + ' ' + project.client_last_name}</td>
              <td><span class="status-badge status-${project.status}">${project.status}</span></td>
              <td>${project.ticket_count || 0} (${project.active_ticket_count || 0} actifs)</td>
              <td>${api.formatDate(project.created_at)}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-project-id="${project.id}" data-action="view-project"> Voir</button>
                  <button class="btn-action btn-edit" data-project-id="${project.id}" data-action="edit-project"> Éditer</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
    
    // Event listeners pour les boutons d'action des projets
    const viewProjectButtons = document.querySelectorAll('[data-action="view-project"]');
    const editProjectButtons = document.querySelectorAll('[data-action="edit-project"]');
    
    viewProjectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = parseInt(e.target.dataset.projectId);
        this.viewProject(projectId);
      });
    });
    
    editProjectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = parseInt(e.target.dataset.projectId);
        this.editProject(projectId);
      });
    });
  }

  async loadClients() {
    const container = document.getElementById('clientsList');
    container.innerHTML = '<div class="loading">Chargement des clients...</div>';

    try {
      const response = await api.getClients();
      this.renderClientsTable(response.data.clients);
    } catch (error) {
      console.error('Clients load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des clients</div>';
    }
  }

  renderClientsTable(clients) {
    const container = document.getElementById('clientsList');
    
    if (clients.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">Clients</div><p>Aucun client trouvé</p></div>';
      return;
    }

    const tableHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Entreprise</th>
            <th>Projets</th>
            <th>Tickets</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(client => `
            <tr>
              <td>${client.first_name} ${client.last_name}</td>
              <td>${client.email}</td>
              <td>${client.company || '-'}</td>
              <td>${client.project_count || 0}</td>
              <td>${client.ticket_count || 0}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-client-id="${client.id}" data-action="view-client"> Voir</button>
                  <button class="btn-action btn-edit" data-client-id="${client.id}" data-action="edit-client"> Éditer</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
    
    // Event listeners pour les boutons d'action des clients
    const viewClientButtons = document.querySelectorAll('[data-action="view-client"]');
    const editClientButtons = document.querySelectorAll('[data-action="edit-client"]');
    
    viewClientButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientId = parseInt(e.target.dataset.clientId);
        this.viewClient(clientId);
      });
    });
    
    editClientButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientId = parseInt(e.target.dataset.clientId);
        this.editClient(clientId);
      });
    });
  }


  // Placeholder methods for actions
  async viewTicket(id) {
    try {
      const response = await api.getTicket(id);
      const ticket = response.data.ticket;
      const comments = response.data.comments || [];
      
      // Charger les pièces jointes pour chaque commentaire
      for (let comment of comments) {
        try {
          const attachmentsResponse = await api.getCommentAttachments(comment.id);
          comment.attachments = attachmentsResponse.success ? attachmentsResponse.data.attachments : [];
        } catch (error) {
          console.warn(`Erreur chargement pièces jointes pour commentaire ${comment.id}:`, error);
          comment.attachments = [];
        }
      }
      
      const modal = this.createModal(`Ticket - ${ticket.title}`, `
        <div class="ticket-view">
          <!-- En-tête du ticket -->
          <div class="ticket-header">
            <div class="ticket-meta">
              <div class="meta-row">
                <span class="meta-label">Projet:</span>
                <span class="meta-value">${ticket.project_name}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Client:</span>
                <span class="meta-value">${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Statut:</span>
                <span class="status-badge status-${ticket.status}">${this.getStatusLabel(ticket.status)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Priorité:</span>
                <span class="priority-badge priority-${ticket.priority}">${this.getPriorityLabel(ticket.priority)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Créé le:</span>
                <span class="meta-value">${api.formatDateTime(ticket.created_at)}</span>
              </div>
              ${ticket.assigned_to ? `
                <div class="meta-row">
                  <span class="meta-label">Assigné à:</span>
                  <span class="meta-value">${ticket.assigned_to_name}</span>
                </div>
              ` : ''}
            </div>
            
            <div class="ticket-actions">
              <select id="ticketStatus" class="form-input-sm">
                <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Ouvert</option>
                <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>En cours</option>
                <option value="waiting_client" ${ticket.status === 'waiting_client' ? 'selected' : ''}>En attente client</option>
                <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Résolu</option>
              </select>
              <button type="button" class="btn btn-sm btn-primary update-ticket-status" data-ticket-id="${id}">
                Mettre à jour
              </button>
            </div>
          </div>
          
          <!-- Description du ticket -->
          <div class="ticket-content">
            <h4>Description</h4>
            <div class="ticket-description">
              ${ticket.description.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <!-- SLA Info -->
          ${ticket.sla_hours ? `
            <div class="sla-info">
              <h4>SLA</h4>
              <div class="sla-details">
                <div class="sla-item">
                  <span>Durée SLA:</span>
                  <span>${ticket.sla_hours}h</span>
                </div>
                <div class="sla-item ${ticket.is_overdue ? 'overdue' : ''}">
                  <span>Échéance:</span>
                  <span>${api.formatDateTime(ticket.sla_deadline)}</span>
                  ${ticket.is_overdue ? '<span class="overdue-badge">DÉPASSÉ</span>' : ''}
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- Pièces jointes -->
          ${ticket.attachments && ticket.attachments.length > 0 ? `
            <div class="ticket-attachments">
              <h4>Pièces jointes</h4>
              <div class="attachment-list">
                ${ticket.attachments.map(att => `
                  <div class="attachment-item">
                    <span class="attachment-icon"></span>
                    <a href="/api/attachments/${att.id}" target="_blank" class="attachment-link">
                      ${att.filename}
                    </a>
                    <span class="attachment-size">(${this.formatFileSize(att.size)})</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Conversation avec le client -->
          <div class="ticket-comments" style="margin-bottom: 20px;">
            <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">Conversation avec le client (${comments.length})</h4>
            
            <div class="comments-list" id="commentsList" style="max-height: 400px; overflow-y: auto; padding: 16px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
              ${comments.map(comment => {
                const isFromClient = comment.role === 'client';
                
                // Get author initials
                const initials = comment.first_name 
                    ? comment.first_name.charAt(0).toUpperCase()
                    : (isFromClient ? 'C' : 'S'); // C=Client, S=Support
                
                return `
                  <div style="display: flex; ${isFromClient ? 'justify-content: flex-start' : 'justify-content: flex-end'}; margin-bottom: 16px;">
                    <div style="max-width: 70%; ${isFromClient ? 'margin-right: auto' : 'margin-left: auto'};">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; ${isFromClient ? '' : 'flex-direction: row-reverse;'}">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isFromClient ? '#e3f2fd' : '#0e2433'}; display: flex; align-items: center; justify-content: center;">
                          <span style="color: ${isFromClient ? '#1565c0' : 'white'}; font-weight: 600; font-size: 11px;">
                            ${initials}
                          </span>
                        </div>
                        <span style="font-size: 12px; color: #6b7280; font-weight: 500;">
                          ${isFromClient ? (comment.first_name || 'Client') : (comment.first_name || 'Équipe support')} ${!isFromClient && comment.last_name ? comment.last_name : ''}
                        </span>
                        <span style="font-size: 11px; color: #9ca3af;">
                          ${api.formatDateTime(comment.created_at)}
                        </span>
                      </div>
                      <div style="background: ${isFromClient ? '#ffffff' : '#0e2433'}; color: ${isFromClient ? '#374151' : 'white'}; padding: 12px 16px; border-radius: 12px; ${isFromClient ? 'border-bottom-left-radius: 4px;' : 'border-bottom-right-radius: 4px;'} box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: ${isFromClient ? '1px solid #e5e7eb' : 'none'};">
                        <div style="line-height: 1.4; font-size: 14px;">
                          ${comment.content.replace(/\n/g, '<br>')}
                        </div>
                        ${this.renderAttachments(comment.attachments, isFromClient)}
                        ${comment.is_internal ? '<div style="margin-top: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px;">Message interne</div>' : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
            
            <!-- Ajouter un commentaire -->
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 20px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">Ajouter un commentaire</h3>
              <form id="addCommentForm">
                <textarea id="commentContent" name="content" placeholder="Écrivez votre commentaire ou question ici..." 
                          style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; line-height: 1.5; resize: vertical; min-height: 80px; font-family: inherit;" required></textarea>
                
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 12px;">
                  <button type="button" id="attachFileBtn" style="display: flex; align-items: center; gap: 6px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 13px; cursor: pointer;">
                    📎 Joindre fichiers
                  </button>
                  <input type="file" id="fileInput" multiple accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar" style="display: none;">
                </div>
                
                <!-- Selected files display -->
                <div id="selectedFilesSection" style="display: none; margin-top: 8px;">
                  <small style="color: #6b7280; display: block; margin-bottom: 4px;">Fichiers sélectionnés:</small>
                  <div id="selectedFilesList"></div>
                </div>
                
                <div style="margin: 12px 0; display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" id="commentInternal" name="is_internal" style="margin: 0;">
                  <label for="commentInternal" style="font-size: 13px; color: #6b7280; cursor: pointer;">
                    Commentaire interne (invisible pour le client)
                  </label>
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
                  <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer;">
                    Annuler
                  </button>
                  <button type="submit" id="submitCommentBtn" style="background: #0e2433; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;">
                    Envoyer le commentaire
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary close-modal-btn">Fermer</button>
            <button type="button" class="btn btn-primary edit-ticket-btn" data-ticket-id="${id}">
               Modifier le ticket
            </button>
          </div>
        </div>
      `, 'large');
      
      // Gérer l'ajout de commentaire
      const ticketId = id; // Sauvegarder l'ID du ticket pour le closure
      
      // File attachment functionality
      let selectedFiles = [];
      window.currentSelectedFiles = selectedFiles; // Make it globally accessible for removal
      const attachFileBtn = document.getElementById('attachFileBtn');
      const fileInput = document.getElementById('fileInput');
      const selectedFilesSection = document.getElementById('selectedFilesSection');
      const selectedFilesList = document.getElementById('selectedFilesList');

      attachFileBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
          // Check file size (10MB max)
          if (file.size > 10 * 1024 * 1024) {
            alert(`Le fichier "${file.name}" est trop volumineux (max 10MB)`);
            return;
          }
          
          // Check if file is already selected
          const existingFile = selectedFiles.find(f => f.name === file.name && f.size === file.size);
          if (existingFile) {
            alert(`Le fichier "${file.name}" est déjà sélectionné`);
            return;
          }
          
          selectedFiles.push(file);
        });
        
        window.currentSelectedFiles = selectedFiles; // Update global reference
        this.updateFileDisplay(selectedFiles, selectedFilesSection, selectedFilesList);
        fileInput.value = ''; // Clear input for next selection
      });
      
      document.getElementById('addCommentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addComment(ticketId, e.target, selectedFiles);
      });
      
      // Event listener pour le bouton éditer (le bouton fermer est géré par createModal)
      document.querySelector('.edit-ticket-btn').addEventListener('click', (e) => {
        const ticketId = parseInt(e.target.dataset.ticketId);
        this.closeModal();
        this.editTicket(ticketId);
      });
      
      // Event listener pour le bouton de mise à jour du statut
      document.querySelector('.update-ticket-status')?.addEventListener('click', (e) => {
        const ticketId = parseInt(e.target.dataset.ticketId);
        this.updateTicketStatus(ticketId);
      });
      
    } catch (error) {
      this.showNotification(`Erreur lors du chargement du ticket: ${error.message}`, 'error');
    }
  }

  async updateTicketStatus(ticketId) {
    const newStatus = document.getElementById('ticketStatus').value;
    
    try {
      await api.updateTicket(ticketId, { status: newStatus });
      
      // Mettre à jour immédiatement le badge de statut dans la modal
      this.updateModalDisplay(ticketId, { status: newStatus });
      
      this.showNotification('Statut du ticket mis à jour', 'success');
      
      // Recharger la vue en arrière-plan pour maintenir la cohérence
      if (this.currentTab === 'dashboard') {
        this.loadDashboard();
      } else if (this.currentTab === 'tickets') {
        this.loadTickets();
      }
      
    } catch (error) {
      this.showNotification('Erreur lors de la mise à jour', 'error');
    }
  }

  async addComment(ticketId, form, attachments = []) {
    const formData = new FormData(form);
    const commentData = {
      ticket_id: ticketId,
      content: formData.get('content').trim(),
      is_internal: formData.get('is_internal') === 'on'
    };

    if (!commentData.content) {
      this.showNotification('Le commentaire ne peut pas être vide', 'error');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Ajout en cours...';

      // Create comment first
      const commentResponse = await api.createComment(ticketId, commentData);
      
      if (!commentResponse.success) {
        throw new Error(commentResponse.message || 'Erreur lors de la création du commentaire');
      }

      const commentId = commentResponse.data.comment.id;

      // Upload attachments if any
      if (attachments.length > 0) {
        submitBtn.textContent = `Upload ${attachments.length} fichier(s)...`;
        
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          try {
            await api.uploadAttachment(commentId, file);
          } catch (uploadError) {
            console.error(`Erreur upload fichier ${file.name}:`, uploadError);
            this.showNotification(`Erreur lors de l'upload du fichier "${file.name}": ${uploadError.message}`, 'error');
          }
        }
      }
      
      // Réinitialiser le formulaire
      form.reset();
      
      // Recharger la vue du ticket
      this.viewTicket(ticketId);
      
    } catch (error) {
      this.showNotification('Erreur lors de l\'ajout du commentaire', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajouter le commentaire';
    }
  }

  getStatusLabel(status) {
    const labels = {
      'open': ' Ouvert',
      'in_progress': ' En cours',
      'waiting_client': 'En attente client',
      'resolved': ' Résolu',
      'closed': ' Fermé'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': ' Faible',
      'normal': ' Normale',
      'high': 'Élevée',
      'urgent': ' Urgente'
    };
    return labels[priority] || priority;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async editTicket(id) {
    try {
      const response = await api.getTicket(id);
      const ticket = response.data.ticket;
      
      // Charger les utilisateurs pour l'assignation
      const usersResponse = await api.getUsers({ role: 'team,admin' });
      const users = usersResponse.data.users || [];
      
      const modal = this.createModal(`Modifier Ticket - ${ticket.title}`, `
        <form id="editTicketForm" class="form">
          <input type="hidden" name="id" value="${ticket.id}">
          
          <div class="form-group">
            <label class="form-label" for="editTicketTitle">Titre *</label>
            <input type="text" id="editTicketTitle" name="title" 
                   class="form-input" value="${ticket.title}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editTicketDescription">Description *</label>
            <textarea id="editTicketDescription" name="description" 
                      class="form-input" rows="4" required>${ticket.description}</textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="editTicketPriority">Priorité</label>
              <select id="editTicketPriority" name="priority" class="form-input">
                <option value="low" ${ticket.priority === 'low' ? 'selected' : ''}> Faible</option>
                <option value="normal" ${ticket.priority === 'normal' ? 'selected' : ''}> Normale</option>
                <option value="high" ${ticket.priority === 'high' ? 'selected' : ''}>Élevée</option>
                <option value="urgent" ${ticket.priority === 'urgent' ? 'selected' : ''}> Urgente</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="editTicketStatus">Statut</label>
              <select id="editTicketStatus" name="status" class="form-input">
                <option value="open" ${ticket.status === 'open' ? 'selected' : ''}> Ouvert</option>
                <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}> En cours</option>
                <option value="waiting_client" ${ticket.status === 'waiting_client' ? 'selected' : ''}>En attente client</option>
                <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}> Résolu</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editTicketAssigned">Assigné à</label>
            <select id="editTicketAssigned" name="assigned_to" class="form-input">
              <option value="">Non assigné</option>
              ${users.map(user => `
                <option value="${user.id}" ${user.id === ticket.assigned_to ? 'selected' : ''}>
                  ${user.first_name} ${user.last_name} (${user.role})
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="ticket-info">
            <p><strong>Projet :</strong> ${ticket.project_name}</p>
            <p><strong>Client :</strong> ${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</p>
            <p><strong>Créé le :</strong> ${api.formatDateTime(ticket.created_at)}</p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </form>
      `, 'large');

      document.getElementById('editTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditTicket(e.target);
      });
      
    } catch (error) {
      this.showNotification(`Erreur lors du chargement du ticket: ${error.message}`, 'error');
    }
  }

  async handleEditTicket(form) {
    const formData = new FormData(form);
    const ticketId = formData.get('id');
    
    const updateData = {
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      priority: formData.get('priority'),
      status: formData.get('status'),
      assigned_to: formData.get('assigned_to') || null
    };



    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';

      const response = await api.updateTicket(ticketId, updateData);
      
      // Mettre à jour les éléments visuels dans la modal en cours
      this.updateModalDisplay(ticketId, updateData);
      
      this.showNotification('Ticket modifié avec succès', 'success');
      
      // Fermer la modal d'édition
      this.closeModal();
      
      // Recharger la vue en arrière-plan pour maintenir la cohérence
      if (this.currentTab === 'dashboard') {
        this.loadDashboard();
      } else if (this.currentTab === 'tickets') {
        this.loadTickets();
      }
      
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la modification', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer les modifications';
    }
  }

  updateModalDisplay(ticketId, updateData) {
    // Si la modal viewTicket est ouverte, mettre à jour ses éléments
    const statusBadge = document.querySelector('.status-badge');
    const priorityBadge = document.querySelector('.priority-badge');
    
    if (statusBadge && updateData.status) {
      statusBadge.className = `status-badge status-${updateData.status}`;
      statusBadge.textContent = this.getStatusLabel(updateData.status);
    }
    
    if (priorityBadge && updateData.priority) {
      priorityBadge.className = `priority-badge priority-${updateData.priority}`;
      priorityBadge.textContent = this.getPriorityLabel(updateData.priority);
    }
    
    // Mettre à jour le select de statut rapide dans viewTicket si présent
    const quickStatusSelect = document.getElementById('ticketStatus');
    if (quickStatusSelect && updateData.status) {
      quickStatusSelect.value = updateData.status;
    }
    
    // Si c'est la modal editTicket, garder les valeurs à jour dans les champs
    const editForm = document.getElementById('editTicketForm');
    if (editForm) {
      const titleInput = editForm.querySelector('input[name="title"]');
      const descTextarea = editForm.querySelector('textarea[name="description"]');
      const statusSelect = editForm.querySelector('select[name="status"]');
      const prioritySelect = editForm.querySelector('select[name="priority"]');
      const assignSelect = editForm.querySelector('select[name="assigned_to"]');
      
      if (titleInput && updateData.title) titleInput.value = updateData.title;
      if (descTextarea && updateData.description) descTextarea.value = updateData.description;
      if (statusSelect && updateData.status) statusSelect.value = updateData.status;
      if (prioritySelect && updateData.priority) prioritySelect.value = updateData.priority;
      if (assignSelect && updateData.hasOwnProperty('assigned_to')) {
        assignSelect.value = updateData.assigned_to || '';
      }
    }
  }

  async viewProject(id) {
    try {
      const project = this.projects.find(p => p.id === id);
      if (!project) {
        this.showNotification('Projet non trouvé', 'error');
        return;
      }

      // Stocker le projet actuel
      this.currentProject = project;

      // Cacher la liste des projets et afficher le kanban
      document.getElementById('projects').style.display = 'none';
      document.getElementById('projectKanban').style.display = 'block';
      
      // Changer l'état du tab pour afficher les bons boutons dans le header
      this.currentTab = 'project-kanban';
      this.updateHeaderActions();
      
      // Mettre à jour les titres
      document.getElementById('kanbanProjectTitle').textContent = project.name;
      document.querySelector('.main-title').textContent = `Projet : ${project.name}`;
      
      // Pré-initialiser le drag & drop et les clics pour éviter d'attendre le chargement réseau
      this.setupTaskClickHandlers();
      this.initKanbanDragDrop();

      // Afficher l'état de chargement visuel
      this.setKanbanLoading(true);

      // Charger les tâches du projet (les instances Sortable prendront en compte les éléments insérés)
      await this.loadProjectTasks(id);
      this.setKanbanLoading(false);
      
      // Configurer les événements du kanban (header)
      this.setupKanbanEvents(id);
      
    } catch (error) {
      console.error('Erreur viewProject:', error);
      this.showNotification('Erreur lors de l\'affichage du projet', 'error');
    }
  }

  setKanbanLoading(isLoading) {
    const statuses = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
    statuses.forEach(status => {
      const column = document.getElementById(`column-${status}`);
      if (!column) return;
      if (isLoading) {
        column.setAttribute('data-loading', 'true');
        if (!column.querySelector('.kanban-loading')) {
          const placeholder = document.createElement('div');
          placeholder.className = 'kanban-loading';
          placeholder.textContent = 'Chargement…';
          column.prepend(placeholder);
        }
      } else {
        column.removeAttribute('data-loading');
        column.querySelector('.kanban-loading')?.remove();
      }
    });
  }

  async loadProjectTasks(projectId) {
    try {
      console.log('Chargement des tâches pour le projet:', projectId);
      const response = await fetch(`/api/dev/projects/${projectId}/tasks`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      console.log('Réponse du serveur:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur serveur:', errorText);
        throw new Error(`Erreur lors du chargement des tâches: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Tâches chargées:', result);
      const tasks = result.data || [];
      
      // Vider toutes les colonnes
      const columns = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
      columns.forEach(status => {
        document.getElementById(`column-${status}`).innerHTML = '';
        document.getElementById(`count-${status}`).textContent = '0';
      });
      
      // Mapping des statuts de la base vers les colonnes kanban
      const statusMapping = {
        'todo': 'todo_back',
        'in_progress': 'in_progress', 
        'ready_for_review': 'ready_for_review',
        'done': 'done'
      };

      // Grouper les tâches par statut
      const tasksByStatus = {};
      columns.forEach(status => tasksByStatus[status] = []);
      
      tasks.forEach(task => {
        const kanbanStatus = statusMapping[task.status] || 'todo_back';
        if (tasksByStatus[kanbanStatus]) {
          tasksByStatus[kanbanStatus].push(task);
        }
      });
      
      // Afficher les tâches dans chaque colonne
      columns.forEach(status => {
        const tasks = tasksByStatus[status];
        const column = document.getElementById(`column-${status}`);
        const count = document.getElementById(`count-${status}`);
        
        count.textContent = tasks.length;
        
        column.innerHTML = tasks.map(task => `
          <div class="task-card" data-task-id="${task.id}">
            <div class="task-header">
              <h4>${task.title}</h4>
              <span class="task-urgency ${task.urgency || 'medium'}">${this.getPriorityLabel(task.urgency || 'medium')}</span>
            </div>
            <p class="task-description">${task.description || ''}</p>
            <div class="task-footer">
              <span class="task-assignee">${task.assignee_name || 'Non assigné'}</span>
              <span class="task-date">${api.formatDate(task.created_at)}</span>
            </div>
          </div>
        `).join('');
      });
      
      // Initialiser les event listeners immédiatement
      this.setupTaskClickHandlers();
      
      // Initialiser le drag & drop immédiatement
      this.initKanbanDragDrop();
      
    } catch (error) {
      console.error('Erreur loadProjectTasks:', error);
      this.showNotification('Erreur lors du chargement des tâches', 'error');
    }
  }

  setupTaskClickHandlers() {
    console.log('Configuration des event listeners pour les tâches...');
    
    // Event delegation pour les clics sur les tâches
    const kanbanBoard = document.getElementById('projectKanban');
    if (kanbanBoard && !this.taskClickHandlerAttached) {
      // Ajouter le nouvel event listener
      this.taskClickHandler = (e) => {
        const taskCard = e.target.closest('.task-card');
        if (taskCard && !e.target.closest('button')) {
          const taskId = taskCard.dataset.taskId;
          console.log('Clic sur tâche:', taskId);
          this.openTaskModal(taskId);
        }
      };
      
      kanbanBoard.addEventListener('click', this.taskClickHandler);
      this.taskClickHandlerAttached = true;
      console.log('Event listeners attachés');
    }
  }

  async openTaskModal(taskId) {
    try {
      console.log('Ouverture modal pour tâche:', taskId);
      
      // Récupérer les détails de la tâche
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la tâche');
      }
      
      const result = await response.json();
      const task = result.data;
      
      // Créer et afficher le modal en respectant unified-modals.css
      const modalHtml = `
        <div class="modal" id="taskModal" role="dialog" aria-modal="true">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">Détails de la tâche</h3>
              <button class="modal-close" type="button" aria-label="Fermer">&times;</button>
            </div>
            <div class="task-detail-tabs">
              <button class="tab-btn active" data-tab="details">Détails</button>
              <button class="tab-btn" data-tab="discussions">Discussions</button>
              <button class="tab-btn" data-tab="attachments">Pièces jointes</button>
              <button class="tab-btn" data-tab="tickets">Tickets liés</button>
            </div>
            <div class="modal-body">
              <section id="taskTab-details" class="task-tab active">
                <div class="form-group">
                  <label>Titre</label>
                  <input type="text" id="taskTitle" value="${task.title}">
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea id="taskDescription">${task.description || ''}</textarea>
                </div>
                <div class="form-group">
                  <label>Statut</label>
                  <select id="taskStatus">
                    <option value="todo_back" ${task.status === 'todo_back' ? 'selected' : ''}>À faire (Back)</option>
                    <option value="todo_front" ${task.status === 'todo_front' ? 'selected' : ''}>À faire (Front)</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>En cours</option>
                    <option value="ready_for_review" ${task.status === 'ready_for_review' ? 'selected' : ''}>Prêt pour révision</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>Terminé</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Priorité</label>
                  <select id="taskUrgency">
                    <option value="low" ${task.urgency === 'low' ? 'selected' : ''}>Faible</option>
                    <option value="medium" ${task.urgency === 'medium' ? 'selected' : ''}>Moyenne</option>
                    <option value="high" ${task.urgency === 'high' ? 'selected' : ''}>Élevée</option>
                    <option value="urgent" ${task.urgency === 'urgent' ? 'selected' : ''}>Urgente</option>
                  </select>
                </div>
              </section>
              <section id="taskTab-discussions" class="task-tab" hidden>
                <div id="taskComments" class="comments-list" style="max-height: 360px; overflow-y: auto; padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px;">Chargement…</div>
                <form id="taskCommentForm" class="form-inline">
                  <textarea id="taskCommentBody" placeholder="Votre message…" rows="3" required style="width:100%;"></textarea>
                  <div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end;">
                    <button type="submit" class="btn btn-primary">Envoyer</button>
                  </div>
                </form>
              </section>
              
              <section id="taskTab-attachments" class="task-tab" hidden>
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                  <input type="file" id="taskAttachmentInput" multiple />
                  <button class="btn btn-primary" id="taskAttachmentUploadBtn">Uploader</button>
                </div>
                <div id="taskAttachments" style="min-height:120px;">Chargement…</div>
              </section>
              <section id="taskTab-tickets" class="task-tab" hidden>
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="linkTicketSearch" placeholder="Rechercher ticket (titre, numéro, ID)" />
                    <button class="btn btn-primary" id="linkTicketBtn">Lier</button>
                  </div>
                  <div id="linkTicketResults" style="border:1px solid #e5e7eb; border-radius:6px; max-height:220px; overflow:auto; display:none;"></div>
                </div>
                <div id="taskTickets" style="min-height:120px;">Chargement…</div>
              </section>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-close-modal>Annuler</button>
              <button class="btn btn-primary" id="taskSaveBtn">Sauvegarder</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');

      const modalEl = document.getElementById('taskModal');
      const close = () => {
        modalEl?.remove();
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
      };
      // Boutons de fermeture
      modalEl.querySelector('.modal-close')?.addEventListener('click', close);
      modalEl.querySelector('[data-close-modal]')?.addEventListener('click', close);
      modalEl.querySelector('#taskSaveBtn')?.addEventListener('click', () => this.saveTask(taskId));
      // Fermer en cliquant en dehors du contenu
      modalEl.addEventListener('click', (e) => {
        if (!e.target.closest('.modal-content')) close();
      });
      // Fermer avec ESC
      const escHandler = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', escHandler); } };
      window.addEventListener('keydown', escHandler);
      
      // Tabs logic + lazy loading
      const tabButtons = Array.from(modalEl.querySelectorAll('.tab-btn'));
      const sections = {
        details: modalEl.querySelector('#taskTab-details'),
        discussions: modalEl.querySelector('#taskTab-discussions'),
        attachments: modalEl.querySelector('#taskTab-attachments'),
        tickets: modalEl.querySelector('#taskTab-tickets'),
      };
      const showTab = (name) => {
        tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        Object.entries(sections).forEach(([k, el]) => {
          if (!el) return;
          if (k === name) { el.hidden = false; el.classList.add('active'); } else { el.hidden = true; el.classList.remove('active'); }
        });
        if (name === 'discussions') this.loadTaskComments(taskId);
        if (name === 'attachments') this.loadTaskAttachments(taskId);
        if (name === 'tickets') this.loadTaskTickets(taskId);
      };
      tabButtons.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
      // Default is details

      // Comment form
      const form = modalEl.querySelector('#taskCommentForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const textarea = modalEl.querySelector('#taskCommentBody');
          const val = textarea.value;
          await this.postTaskComment(taskId, val);
          textarea.value = '';
          await this.loadTaskComments(taskId);
        });
      }

      // Attachment upload
      const uploadBtn = modalEl.querySelector('#taskAttachmentUploadBtn');
      const fileInput = modalEl.querySelector('#taskAttachmentInput');
      if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', async () => {
          if (!fileInput.files || fileInput.files.length === 0) {
            this.showNotification('Sélectionnez un fichier', 'warning');
            return;
          }
          try {
            // Multi-upload: envoyer tous les fichiers
            await this.uploadTaskAttachments(taskId, Array.from(fileInput.files));
            fileInput.value = '';
            await this.loadTaskAttachments(taskId);
            this.showNotification('Fichier uploadé', 'success');
          } catch (e) {
            this.showNotification('Échec upload fichier', 'error');
          }
        });
      }

      // Link ticket
      const linkBtn = modalEl.querySelector('#linkTicketBtn');
      const searchInput = modalEl.querySelector('#linkTicketSearch');
      const resultsBox = modalEl.querySelector('#linkTicketResults');
      let searchTimer;
      const renderResults = (tickets) => {
        if (!tickets || tickets.length === 0) {
          resultsBox.style.display = 'none';
          resultsBox.innerHTML = '';
          return;
        }
        resultsBox.style.display = 'block';
        resultsBox.innerHTML = tickets.map(t => `
          <div class="result-item" data-id="${t.id}" style="padding:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600;">#${t.ticket_number || t.id} — ${t.title}</div>
              <div style="font-size:12px; color:#6b7280;">${t.status} · ${t.priority}</div>
            </div>
            <button class="btn btn-secondary" data-action="choose-ticket" data-id="${t.id}">Choisir</button>
          </div>
        `).join('');
        resultsBox.querySelectorAll('[data-action="choose-ticket"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.dataset.id, 10);
            try { await this.linkTaskTicket(taskId, id); await this.loadTaskTickets(taskId); this.showNotification('Ticket lié', 'success'); }
            catch { this.showNotification('Échec liaison ticket', 'error'); }
          });
        });
      };
      const doSearch = async (q) => {
        if (!q || q.trim().length < 2) { renderResults([]); return; }
        try {
          const res = await fetch(`/api/dev/tickets/search?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) throw new Error('search_failed');
          const data = await res.json();
          renderResults(data.data || []);
        } catch { renderResults([]); }
      };
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(searchTimer);
          const q = searchInput.value;
          searchTimer = setTimeout(() => doSearch(q), 250);
        });
      }
      if (linkBtn && searchInput) {
        linkBtn.addEventListener('click', async () => {
          const q = searchInput.value;
          if (/^\d+$/.test(q)) {
            // Liaison directe par ID si numérique
            try { await this.linkTaskTicket(taskId, parseInt(q, 10)); await this.loadTaskTickets(taskId); this.showNotification('Ticket lié', 'success'); }
            catch { this.showNotification('Échec liaison ticket', 'error'); }
          } else {
            await doSearch(q);
          }
        });
      }

    } catch (error) {
      console.error('Erreur ouverture modal tâche:', error);
      this.showNotification('Erreur lors de l\'ouverture de la tâche', 'error');
    }
  }

  async loadTaskComments(taskId) {
    const container = document.querySelector('#taskModal #taskComments');
    if (!container) return;
    try {
      const res = await fetch(`/api/dev/tasks/${taskId}/comments`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Erreur chargement commentaires');
      const data = await res.json();
      const comments = data.data || [];
      if (comments.length === 0) { container.innerHTML = '<div style="color:#6b7280;">Aucun message</div>'; return; }
      container.innerHTML = comments.map(c => `
        <div class="comment-item" style="margin-bottom:12px;">
          <div style="font-weight:600; font-size:13px; color:#111827;">${c.author_first_name || ''} ${c.author_last_name || ''} <span style="color:#6b7280; font-weight:400;">(${api.formatDateTime ? api.formatDateTime(c.created_at) : c.created_at})</span></div>
          <div style="white-space:pre-wrap; font-size:13px; color:#374151;">${(c.body || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>
      `).join('');
      container.scrollTop = container.scrollHeight;
    } catch (e) {
      container.textContent = 'Erreur lors du chargement des commentaires';
    }
  }

  async postTaskComment(taskId, body) {
    if (!body || !body.trim()) return;
    await fetch(`/api/dev/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ body: body.trim() })
    });
  }

  async loadTaskActivity(taskId) {
    const container = document.querySelector('#taskModal #taskActivity');
    if (!container) return;
    try {
      const res = await fetch(`/api/dev/tasks/${taskId}/activity`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Erreur activité');
      const data = await res.json();
      const items = data.data || [];
      if (items.length === 0) { container.innerHTML = '<div style="color:#6b7280;">Aucune activité</div>'; return; }
      container.innerHTML = items.map(a => `
        <div class="activity-item" style="padding:8px 0; border-bottom:1px solid #eee; font-size:13px;">
          <div style="color:#111827; font-weight:600;">${a.action || a.type || 'activité'}</div>
          <div style="color:#374151;">${(a.details ? JSON.stringify(a.details) : '')}</div>
          <div style="color:#6b7280;">${api.formatDateTime ? api.formatDateTime(a.created_at) : a.created_at}</div>
        </div>
      `).join('');
    } catch (e) {
      container.textContent = 'Erreur lors du chargement de l\'activité';
    }
  }

  async loadTaskAttachments(taskId) {
    const container = document.querySelector('#taskModal #taskAttachments');
    if (!container) return;
    try {
      const res = await fetch(`/api/dev/tasks/${taskId}/attachments`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Erreur pièces jointes');
      const data = await res.json();
      const files = data.data || [];
      if (files.length === 0) { container.innerHTML = '<div style="color:#6b7280;">Aucune pièce jointe</div>'; return; }
      container.innerHTML = `
        <div class="attachments-list">
          ${files.map(f => `
            <div class="attachment-item" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee;">
              <div>
                <div style="font-size:13px; font-weight:600; color:#111827;">${f.filename}</div>
                <div style="font-size:12px; color:#6b7280;">${(f.size || 0)} octets — ${f.uploader_first_name || ''} ${f.uploader_last_name || ''}</div>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" data-action="download-attachment" data-id="${f.id}">Télécharger</button>
                <button class="btn btn-secondary" data-action="delete-attachment" data-id="${f.id}">Supprimer</button>
              </div>
            </div>
          `).join('')}
        </div>`;

      // Delegation for delete
      container.querySelectorAll('[data-action="download-attachment"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt(e.currentTarget.dataset.id, 10);
          try {
            await this.downloadTaskAttachment(id);
          } catch (err) {
            this.showNotification('Échec téléchargement', 'error');
          }
        });
      });

      container.querySelectorAll('[data-action="delete-attachment"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt(e.currentTarget.dataset.id, 10);
          if (!id) return;
          try {
            await this.deleteTaskAttachment(id);
            await this.loadTaskAttachments(taskId);
            this.showNotification('Pièce jointe supprimée', 'success');
          } catch (err) {
            this.showNotification('Échec suppression', 'error');
          }
        });
      });
    } catch (e) {
      container.textContent = 'Erreur lors du chargement des pièces jointes';
    }
  }

  async uploadTaskAttachments(taskId, files) {
    const formData = new FormData();
    files.forEach(f => formData.append('attachments', f));
    const res = await fetch(`/api/dev/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    });
    if (!res.ok) throw new Error('upload_failed');
    return res.json();
  }

  async deleteTaskAttachment(attachmentId) {
    const res = await fetch(`/api/dev/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('delete_failed');
    return res.json();
  }

  async downloadTaskAttachment(attachmentId) {
    const res = await fetch(`/api/dev/attachments/download/${attachmentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('download_failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    a.download = match ? match[1] : `attachment-${attachmentId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async loadTaskTickets(taskId) {
    const container = document.querySelector('#taskModal #taskTickets');
    if (!container) return;
    try {
      const res = await fetch(`/api/dev/tasks/${taskId}/tickets`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Erreur tickets liés');
      const data = await res.json();
      const tickets = data.data || [];
      if (tickets.length === 0) { container.innerHTML = '<div style="color:#6b7280;">Aucun ticket lié</div>'; return; }
      container.innerHTML = tickets.map(t => `
        <div class="ticket-link" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee; font-size:13px;">
          <div>
            <div style="font-weight:600; color:#111827;">#${t.id} — ${t.title}</div>
            <div style="color:#6b7280;">${t.status} · ${t.priority}</div>
          </div>
          <div>
            <button class="btn btn-secondary" data-action="unlink-ticket" data-id="${t.id}">Délier</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('[data-action="unlink-ticket"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const ticketId = parseInt(e.currentTarget.dataset.id, 10);
          try {
            await this.unlinkTaskTicket(taskId, ticketId);
            await this.loadTaskTickets(taskId);
            this.showNotification('Ticket délié', 'success');
          } catch (err) {
            this.showNotification('Échec délier ticket', 'error');
          }
        });
      });
    } catch (e) {
      container.textContent = 'Erreur lors du chargement des tickets liés';
    }
  }

  async linkTaskTicket(taskId, ticketId) {
    const res = await fetch(`/api/dev/tasks/${taskId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ ticket_id: ticketId })
    });
    if (!res.ok) throw new Error('link_failed');
    return res.json();
  }

  async unlinkTaskTicket(taskId, ticketId) {
    const res = await fetch(`/api/dev/tasks/${taskId}/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('unlink_failed');
    return res.json();
  }

  async saveTask(taskId) {
    try {
      const updates = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        status: document.getElementById('taskStatus').value,
        urgency: document.getElementById('taskUrgency').value
      };
      
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }
      
      // Fermer le modal
      document.getElementById('taskModal')?.remove();
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      
      // Recharger les tâches
      if (this.currentProject) {
        await this.loadProjectTasks(this.currentProject.id);
      }
      
      this.showNotification('Tâche mise à jour avec succès', 'success');
      
    } catch (error) {
      console.error('Erreur sauvegarde tâche:', error);
      this.showNotification('Erreur lors de la sauvegarde', 'error');
    }
  }

  initKanbanDragDrop() {
    if (this.debug) console.log('Initialisation du drag & drop...');
    
    // Forcer le chargement de Sortable si pas disponible
    this.ensureSortableLoaded().then(() => {
      this.setupSortableDragDrop();
    }).catch((err) => {
      if (this.debug) console.warn('Échec du chargement de Sortable, fallback natif', err);
      this.initNativeDragDrop();
    });
  }

  async ensureSortableLoaded() {
    // Empêcher les tentatives simultanées et fiabiliser la détection
    if (this._sortableLoadPromise) return this._sortableLoadPromise;
    this._sortableLoadPromise = new Promise((resolve, reject) => {
      // Déjà disponible
      if (typeof Sortable !== 'undefined') {
        if (this.debug) console.log('Sortable déjà disponible');
        resolve();
        return;
      }

      if (this.debug) console.log('Tentative de chargement de Sortable...');

      // Rechercher un script existant
      let script = document.querySelector('script[src*="sortablejs"], script[src*="Sortable.min.js"], script[src*="sortable"]');

      // Fonction de polling fiable au cas où onload ne se déclenche pas
      const pollForSortable = () => typeof Sortable !== 'undefined';
      const startPolling = () => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (pollForSortable()) {
            clearInterval(interval);
            clearTimeout(timeout);
            if (this.debug) console.log('Sortable détecté via polling');
            resolve();
          } else if (Date.now() - start > 4000) {
            clearInterval(interval);
            // Laisser le timeout gérer le reject pour messages cohérents
          }
        }, 50);
        return interval;
      };

      const timeout = setTimeout(() => {
        if (typeof Sortable === 'undefined') {
          if (this.debug) console.warn('Timeout chargement Sortable');
          reject(new Error('Timeout chargement Sortable'));
        }
      }, 5000);

      // Si un script existe déjà mais a été chargé avant, onload ne sera pas rappelé.
      if (script) {
        // Si déjà chargé, on résout au polling immédiat
        if (pollForSortable()) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        // Attacher quand même les events et lancer un polling
        script.addEventListener('load', () => {
          if (pollForSortable()) {
            clearTimeout(timeout);
            if (this.debug) console.log('Sortable chargé (event load)');
            resolve();
          }
        });
        script.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Erreur de chargement de Sortable'));
        });
        startPolling();
        return;
      }

      // Créer et charger le script si absent
      script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
      script.async = true;
      script.addEventListener('load', () => {
        if (pollForSortable()) {
          clearTimeout(timeout);
          if (this.debug) console.log('Sortable chargé avec succès');
          resolve();
        }
      });
      script.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Erreur de chargement de Sortable'));
      });
      document.head.appendChild(script);
      startPolling();
    });
    return this._sortableLoadPromise;
  }

  setupSortableDragDrop() {
    if (this.debug) console.log('Configuration du drag & drop avec Sortable...');
    
    // Détruire les instances existantes
    Object.values(this.sortableInstances || {}).forEach(instance => {
      if (instance && instance.destroy) instance.destroy();
    });
    this.sortableInstances = {};
    
    // Créer une instance Sortable pour chaque colonne
    const statuses = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
    
    statuses.forEach(status => {
      const column = document.getElementById(`column-${status}`);
      if (column) {
        if (this.debug) console.log(`Création Sortable pour colonne: ${status}, nombre de tâches: ${column.children.length}`);
        this.sortableInstances[status] = Sortable.create(column, {
          group: 'kanban',
          animation: 120,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'dragging',
          draggable: '.task-card',
          direction: 'vertical',
          handle: '.task-header, .task-title, .task-card',
          filter: 'button, a, .no-drag',
          preventOnFilter: true,
          scroll: true,
          scrollSensitivity: 60,
          scrollSpeed: 10,
          fallbackOnBody: true,
          delay: 0,
          delayOnTouchOnly: true,
          touchStartThreshold: 3,
          
          onStart: (evt) => {
            document.body.classList.add('dragging');
            if (this.debug) console.log('Début drag:', evt.item.dataset.taskId);
          },
          
          onEnd: (evt) => {
            document.body.classList.remove('dragging');

            // Si la tâche a changé de colonne
            if (evt.from !== evt.to) {
              const taskId = evt.item.dataset.taskId;
              const newStatus = evt.to.id.replace('column-', '');
              if (this.debug) console.log(`Déplacement tâche ${taskId} vers ${newStatus}`);

              const oldParent = evt.from;
              const oldIndex = evt.oldIndex;
              const newParent = evt.to;

              // Mettre à jour les compteurs immédiatement
              this.updateKanbanCounts();

              this.moveTask(taskId, newStatus, {
                oldParent,
                oldIndex,
                newParent,
                item: evt.item,
              });
            }
          },
          
          onMove: (evt) => {
            return true;
          }
        });
      }
    });
    
    if (this.debug) console.log('Sortable configuré avec succès');
  }

  initNativeDragDrop() {
    if (this.debug) console.log('Initialisation du drag & drop natif HTML5...');
    
    if (this.nativeDragDropInitialized) {
      if (this.debug) console.log('Drag & drop natif déjà initialisé, mise à jour des tâches uniquement');
      this.makeTasksDraggable();
      return;
    }
    
    const statuses = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
    
    statuses.forEach(status => {
      const column = document.getElementById(`column-${status}`);
      if (column) {
        // Rendre la colonne droppable
        column.addEventListener('dragover', (e) => {
          e.preventDefault();
          column.classList.add('drag-over');
        });
        
        column.addEventListener('dragleave', () => {
          column.classList.remove('drag-over');
        });
        
        column.addEventListener('drop', (e) => {
          e.preventDefault();
          column.classList.remove('drag-over');

          const taskId = e.dataTransfer.getData('text/plain');
          const newStatus = column.id.replace('column-', '');

          if (this.debug) console.log(`Drop tâche ${taskId} vers ${newStatus}`);
          const item = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
          const oldParent = item?.parentElement;
          const oldIndex = item ? Array.from(oldParent.children).indexOf(item) : -1;
          if (item && column && item.parentElement !== column) {
            column.appendChild(item);
          }
          this.updateKanbanCounts();
          this.moveTask(taskId, newStatus, { oldParent, oldIndex, newParent: column, item });
        });
      }
    });
    
    this.nativeDragDropInitialized = true;
    
    // Rendre les tâches draggables
    this.makeTasksDraggable();
    
    if (this.debug) console.log('Drag & drop natif configuré');
  }

  makeTasksDraggable() {
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
      card.draggable = true;
      
      card.addEventListener('dragstart', (e) => {
        const taskId = card.dataset.taskId;
        e.dataTransfer.setData('text/plain', taskId);
        card.classList.add('dragging');
        if (this.debug) console.log('Début drag natif:', taskId);
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });
  }


  updateKanbanCounts() {
    const statuses = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
    statuses.forEach(status => {
      const column = document.getElementById(`column-${status}`);
      const count = document.getElementById(`count-${status}`);
      if (column && count) {
        count.textContent = column.children.length;
      }
    });
  }

  async moveTask(taskId, newStatus, revertCtx) {
    try {
      if (this.debug) console.log(`moveTask: tâche ${taskId} vers ${newStatus}`);
      if (this.movingTasks.has(taskId)) {
        if (this.debug) console.warn('Move déjà en cours pour', taskId);
        return;
      }
      this.movingTasks.add(taskId);
      
      // Mapper les colonnes kanban vers les statuts DB
      const statusMapping = {
        'todo_back': 'todo',
        'todo_front': 'todo',
        'in_progress': 'in_progress',
        'ready_for_review': 'ready_for_review',
        'done': 'done'
      };
      
      const dbStatus = statusMapping[newStatus] || newStatus;
      if (this.debug) console.log(`Mapping ${newStatus} vers ${dbStatus}`);
      
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: dbStatus })
      });
      
      if (response.ok) {
        // Succès: pas de reload, maintenir l'état optimiste
        this.updateKanbanCounts();
        this.showNotification('Tâche déplacée', 'success');
      } else {
        throw new Error('Erreur lors du déplacement');
      }
    } catch (error) {
      console.error('Erreur moveTask:', error);
      this.showNotification('Déplacement annulé (erreur)', 'error');
      // Revenir à l'état précédent sans recharger tout
      if (revertCtx && revertCtx.oldParent && revertCtx.item) {
        const { oldParent, oldIndex, item } = revertCtx;
        const refNode = oldParent.children[oldIndex] || null;
        oldParent.insertBefore(item, refNode);
      }
      this.updateKanbanCounts();
    } finally {
      this.movingTasks.delete(taskId);
    }
  }

  setupKanbanEvents(projectId) {
    console.log('setupKanbanEvents appelé avec projectId:', projectId);
    
    // Utiliser event delegation pour les boutons du header qui peuvent être recréés
    const headerActions = document.getElementById('mainHeaderActions');
    if (headerActions) {
      // Supprimer les anciens event listeners pour éviter les doublons
      headerActions.removeEventListener('click', this.kanbanHeaderClickHandler);
      
      // Créer le handler avec le projectId en closure
      this.kanbanHeaderClickHandler = (e) => {
        if (e.target.id === 'backToProjectsBtn') {
          console.log('Clic sur retour aux projets');
          document.getElementById('projectKanban').style.display = 'none';
          document.getElementById('projects').style.display = 'block';
          document.querySelector('.main-title').textContent = 'Espace Agence';
          this.currentProject = null;
          this.currentTab = 'projects';
          this.updateHeaderActions();
        } else if (e.target.id === 'createTaskBtn') {
          console.log('Clic sur nouvelle tâche, projectId:', projectId);
          this.showCreateTaskModal(projectId);
        }
      };
      
      // Attacher l'event listener
      headerActions.addEventListener('click', this.kanbanHeaderClickHandler);
      console.log('Event delegation configurée pour les boutons du header');
    }
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': 'Faible',
      'medium': 'Moyenne',
      'high': 'Haute',
      'urgent': 'Urgente'
    };
    return labels[priority] || priority;
  }

  async showCreateTaskModal(projectId) {
    console.log('showCreateTaskModal appelée avec projectId:', projectId);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Nouvelle tâche</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createTaskForm">
            <div class="form-group">
              <label>Titre *</label>
              <input type="text" id="taskTitle" required>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="taskDescription"></textarea>
            </div>
            <div class="form-group">
              <label>Priorité</label>
              <select id="taskPriority">
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div class="form-group">
              <label>Statut</label>
              <select id="taskStatus">
                <option value="todo_back">To-do Back</option>
                <option value="todo_front">To-do Front</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary modal-close">Annuler</button>
          <button type="submit" class="btn btn-primary" form="createTaskForm">Créer</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Événements
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.onclick = () => modal.remove();
    });
    
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    
    document.getElementById('createTaskForm').onsubmit = async (e) => {
      e.preventDefault();
      await this.createTask(projectId, modal);
    };
  }

  async createTask(projectId, modal) {
    try {
      const title = document.getElementById('taskTitle').value;
      const description = document.getElementById('taskDescription').value;
      const priority = document.getElementById('taskPriority').value;
      const status = document.getElementById('taskStatus').value;
      
      const response = await fetch(`/api/dev/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title,
          description,
          urgency: priority, // Le backend attend 'urgency' au lieu de 'priority'
          status
        })
      });
      
      if (!response.ok) throw new Error('Erreur lors de la création de la tâche');
      
      this.showNotification('Tâche créée avec succès', 'success');
      modal.remove();
      await this.loadProjectTasks(projectId);
      
    } catch (error) {
      console.error('Erreur createTask:', error);
      this.showNotification('Erreur lors de la création de la tâche', 'error');
    }
  }

  async viewClient(id) {
    try {
      const response = await api.getUser(id);
      const client = response.data.user;
      
      const modal = this.createModal(`Client - ${client.first_name} ${client.last_name}`, `
        <div class="client-view">
          <div class="client-header">
            <div class="client-meta">
              <div class="meta-row">
                <span class="meta-label">Nom complet:</span>
                <span class="meta-value">${client.first_name} ${client.last_name}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Email:</span>
                <span class="meta-value">${client.email}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Entreprise:</span>
                <span class="meta-value">${client.company || 'Aucune'}</span>
              </div>
              ${client.address ? `<div class="meta-row">
                <span class="meta-label">Adresse:</span>
                <span class="meta-value">${client.address}</span>
              </div>` : ''}
              ${client.city ? `<div class="meta-row">
                <span class="meta-label">Ville:</span>
                <span class="meta-value">${client.city}</span>
              </div>` : ''}
              ${client.country ? `<div class="meta-row">
                <span class="meta-label">Pays:</span>
                <span class="meta-value">${client.country}</span>
              </div>` : ''}
              <div class="meta-row">
                <span class="meta-label">Inscrit le:</span>
                <span class="meta-value">${api.formatDate(client.created_at)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Projets:</span>
                <span class="meta-value">${client.project_count || 0}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Tickets:</span>
                <span class="meta-value">${client.ticket_count || 0}</span>
              </div>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="adminApp.closeModal()">Fermer</button>
            <button type="button" class="btn btn-primary" onclick="adminApp.editClient(${client.id}); adminApp.closeModal();">Modifier</button>
          </div>
        </div>
      `);
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement du client', 'error');
    }
  }

  async editProject(id) {
    try {
      // Charger le projet et les clients
      const [projectResponse, clientsResponse] = await Promise.all([
        api.getProject(id),
        api.getClients()
      ]);
      
      const project = projectResponse.data.project;
      const clients = clientsResponse.data.clients;
      
      const modal = this.createModal('Modifier Projet', `
        <form id="editProjectForm" class="form">
          <input type="hidden" name="id" value="${project.id}">
          
          <div class="form-group">
            <label class="form-label" for="editProjectClient">Client *</label>
            <select id="editProjectClient" name="client_id" class="form-input" required disabled>
              ${clients.map(client => `
                <option value="${client.id}" ${client.id === project.client_id ? 'selected' : ''}>
                  ${client.company || `${client.first_name} ${client.last_name}`}
                </option>
              `).join('')}
            </select>
            <small>Le client ne peut pas être modifié après création</small>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editProjectName">Nom du projet *</label>
            <input type="text" id="editProjectName" name="name" 
                   class="form-input" value="${project.name}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editProjectDescription">Description</label>
            <textarea id="editProjectDescription" name="description" 
                      class="form-input" rows="4">${project.description || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editProjectStatus">Statut</label>
            <select id="editProjectStatus" name="status" class="form-input">
              <option value="active" ${project.status === 'active' ? 'selected' : ''}> Actif</option>
              <option value="paused" ${project.status === 'paused' ? 'selected' : ''}> En pause</option>
              <option value="completed" ${project.status === 'completed' ? 'selected' : ''}> Terminé</option>
              <option value="archived" ${project.status === 'archived' ? 'selected' : ''}>Archivé</option>
            </select>
          </div>
          
          
          ${project.status !== 'archived' ? `
            <div class="form-warning">
              <p> Archiver un projet masquera tous ses tickets associés</p>
            </div>
          ` : ''}
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </form>
      `);

      document.getElementById('editProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditProject(e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement du projet', 'error');
    }
  }

  async handleEditProject(form) {
    const formData = new FormData(form);
    const projectId = formData.get('id');
    
    const updateData = {
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      status: formData.get('status')
    };

    // Confirmation si archivage
    if (updateData.status === 'archived') {
      if (!confirm('Êtes-vous sûr de vouloir archiver ce projet ? Les tickets ne seront plus visibles.')) {
        return;
      }
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';

      const response = await api.updateProject(projectId, updateData);
      
      if (response.success) {
        this.showNotification('Projet modifié avec succès', 'success');
        this.closeModal();
        
        // Recharger la liste appropriée
        if (this.currentTab === 'projects') {
          this.loadProjects();
        } else if (this.currentTab === 'dashboard') {
          this.loadDashboard();
        }
      }
      
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la modification', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer les modifications';
    }
  }

  async deleteProject(id) {
    try {
      // Charger les infos du projet
      const response = await api.getProject(id);
      const project = response.data.project;
      const stats = response.data.stats;
      
      // Modal de confirmation
      const modal = this.createModal(' Confirmer la suppression du projet', `
        <div class="delete-confirmation">
          <div class="delete-warning">
            <p><strong>Vous êtes sur le point de supprimer le projet :</strong></p>
            <div class="project-info-box">
              <h3>${project.name}</h3>
              <p>Client : ${project.client_company || project.client_first_name + ' ' + project.client_last_name}</p>
              ${project.description ? `<p>${project.description}</p>` : ''}
            </div>
          </div>
          
          <div class="delete-impact">
            <h4> Impact de la suppression :</h4>
            <div class="impact-stats">
              <div class="stat-item ${stats.total_tickets > 0 ? 'has-data' : ''}">
                <span class="stat-icon"></span>
                <span class="stat-value">${stats.total_tickets || 0}</span>
                <span class="stat-label">Tickets</span>
              </div>
              <div class="stat-item ${stats.open_tickets > 0 ? 'critical' : ''}">
                <span class="stat-icon"></span>
                <span class="stat-value">${stats.open_tickets || 0}</span>
                <span class="stat-label">Ouverts</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon"></span>
                <span class="stat-value">Tous</span>
                <span class="stat-label">Commentaires</span>
              </div>
            </div>
            
            ${stats.open_tickets > 0 ? `
              <div class="critical-warning">
                <p> <strong>ATTENTION :</strong> Ce projet a encore ${stats.open_tickets} ticket(s) ouvert(s) !</p>
                <p>Considérez plutôt l'archivage du projet.</p>
              </div>
            ` : ''}
          </div>
          
          <div class="delete-alternatives">
            <p><strong>Alternatives à la suppression :</strong></p>
            <button type="button" class="btn btn-warning btn-sm archive-project-btn" data-project-id="${id}">
              Archiver le projet à la place
            </button>
          </div>
          
          <div class="delete-confirm-section">
            <p class="text-danger"><strong>La suppression est définitive et irréversible !</strong></p>
            
            <div class="form-group">
              <label>
                <input type="checkbox" id="confirmUnderstand">
                Je comprends que toutes les données seront perdues
              </label>
            </div>
            
            ${stats.open_tickets > 0 ? `
              <div class="form-group">
                <label>
                  <input type="checkbox" id="confirmOpenTickets">
                  Je confirme vouloir supprimer les ${stats.open_tickets} tickets ouverts
                </label>
              </div>
            ` : ''}
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">
              Annuler
            </button>
            <button type="button" class="btn btn-danger" id="confirmDeleteProjectBtn" disabled>
               Supprimer définitivement
            </button>
          </div>
        </div>
      `);

      // Validation des checkboxes
      const updateDeleteBtn = () => {
        const understand = document.getElementById('confirmUnderstand').checked;
        const openTickets = document.getElementById('confirmOpenTickets');
        const openTicketsOk = !openTickets || openTickets.checked;
        
        document.getElementById('confirmDeleteProjectBtn').disabled = !(understand && openTicketsOk);
      };

      document.getElementById('confirmUnderstand').addEventListener('change', updateDeleteBtn);
      const openTicketsCheckbox = document.getElementById('confirmOpenTickets');
      if (openTicketsCheckbox) {
        openTicketsCheckbox.addEventListener('change', updateDeleteBtn);
      }

      document.getElementById('confirmDeleteProjectBtn').addEventListener('click', async () => {
        await this.performDeleteProject(id, project);
      });
      
      // Event listener pour le bouton d'archivage
      document.querySelector('.archive-project-btn')?.addEventListener('click', (e) => {
        const projectId = parseInt(e.target.dataset.projectId);
        this.archiveProject(projectId);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement du projet', 'error');
    }
  }

  async performDeleteProject(id, project) {
    try {
      const confirmBtn = document.getElementById('confirmDeleteProjectBtn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Suppression en cours...';

      await api.deleteProject(id);
      
      this.showNotification(`Projet "${project.name}" supprimé avec succès`, 'success');
      this.closeModal();
      
      // Recharger la liste
      if (this.currentTab === 'projects') {
        this.loadProjects();
      } else {
        this.loadDashboard();
      }
      
      // Log pour audit
      console.log(`[AUDIT] Projet supprimé : ${project.name} (ID: ${id}) par ${this.currentUser.email}`);
      
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la suppression', 'error');
      this.closeModal();
    }
  }

  // Méthode alternative : Archivage
  async archiveProject(id) {
    this.closeModal();
    
    try {
      await api.updateProject(id, { status: 'archived' });
      this.showNotification('Projet archivé avec succès', 'success');
      this.loadProjects();
    } catch (error) {
      this.showNotification('Erreur lors de l\'archivage', 'error');
    }
  }

  getDefaultSLATime(priority, type) {
    const defaults = {
      'low': { response: 8, resolution: 48 },       // 8h / 2 jours
      'normal': { response: 8, resolution: 32 },    // 8h / 1.3 jours
      'high': { response: 4, resolution: 16 },      // 4h / 16h
      'urgent': { response: 2, resolution: 8 }      // 2h / 8h
    };
    return defaults[priority]?.[type] || 8;
  }

  async editClient(id) {
    try {
      // Charger les données du client
      const response = await api.getUser(id);
      const client = response.data.user;
      
      // Charger les règles SLA du client
      const slaResponse = await api.getSLARules({ client_id: id });
      const slaRules = slaResponse.data.sla_rules || [];
      
      const modal = this.createModal('Modifier Client', `
        <form id="editClientForm" class="form">
          <input type="hidden" name="id" value="${client.id}">
          
          <div class="form-group">
            <label class="form-label" for="editClientEmail">Email *</label>
            <input type="email" id="editClientEmail" name="email" 
                   class="form-input" value="${client.email}" required>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="editClientFirstName">Prénom *</label>
              <input type="text" id="editClientFirstName" name="first_name" 
                     class="form-input" value="${client.first_name}" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="editClientLastName">Nom *</label>
              <input type="text" id="editClientLastName" name="last_name" 
                     class="form-input" value="${client.last_name}" required>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editClientCompany">Entreprise</label>
            <input type="text" id="editClientCompany" name="company" 
                   class="form-input" value="${client.company || ''}">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editClientAddress">Adresse</label>
            <input type="text" id="editClientAddress" name="address" 
                   class="form-input" value="${client.address || ''}">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="editClientCity">Ville</label>
              <input type="text" id="editClientCity" name="city" 
                     class="form-input" value="${client.city || ''}">
            </div>
            <div class="form-group">
              <label class="form-label" for="editClientCountry">Pays</label>
              <input type="text" id="editClientCountry" name="country" 
                     class="form-input" value="${client.country || ''}">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editClientQuote">Devis</label>
            ${(() => {
              // Si c'est un fichier uploadé (JSON)
              if (this.hasValidFile(client.quote_file_decrypted)) {
                try {
                  const fileData = JSON.parse(client.quote_file_decrypted);
                  return `
                    <div class="file-display" style="padding: 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-background);">
                      <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                          <span style="font-weight: 500;">📋 ${fileData.name || 'Devis'}</span>
                          <small style="display: block; color: var(--color-muted); margin-top: 4px;">Devis uploadé</small>
                        </div>
                        <button type="button" class="btn btn-sm btn--primary" onclick="adminApp.downloadQuoteFile('${encodeURIComponent(client.quote_file_decrypted)}')">
                          Télécharger
                        </button>
                      </div>
                    </div>
                    <div style="margin-top: 10px;">
                      <label for="editClientQuote">Remplacer le fichier :</label>
                      <input type="file" id="editClientQuote" name="quote_file" class="form-input">
                    </div>
                  `;
                } catch {
                  // Ancien format texte
                  return `
                    <input type="file" id="editClientQuote" name="quote_file" class="form-input">
                    <small class="form-text text-muted">Aucun devis uploadé</small>
                  `;
                }
              } else {
                return `
                  <input type="file" id="editClientQuote" name="quote_file" class="form-input">
                  <small class="form-text text-muted">Aucun devis uploadé</small>
                `;
              }
            })()}
          </div>

          <div class="form-group">
            <label class="form-label" for="editClientSpecifications">Cahier des charges</label>
            ${(() => {
              // Si c'est un fichier uploadé (JSON)
              if (this.hasValidFile(client.confidential_file_decrypted)) {
                try {
                  const fileData = JSON.parse(client.confidential_file_decrypted);
                  return `
                    <div class="file-display" style="padding: 10px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-background);">
                      <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                          <span style="font-weight: 500;">📄 ${fileData.name || 'Fichier'}</span>
                          <small style="display: block; color: var(--color-muted); margin-top: 4px;">Cahier des charges uploadé</small>
                        </div>
                        <button type="button" class="btn btn-sm btn--primary" onclick="adminApp.downloadConfidentialFile('${encodeURIComponent(client.confidential_file_decrypted)}')">
                          Télécharger
                        </button>
                      </div>
                    </div>
                    <div style="margin-top: 10px;">
                      <label for="editClientSpecifications">Remplacer le fichier :</label>
                      <input type="file" id="editClientSpecifications" name="confidential_file" class="form-input">
                    </div>
                  `;
                } catch {
                  // Ancien format texte - ne pas afficher comme fichier
                  return `
                    <input type="file" id="editClientSpecifications" name="confidential_file" class="form-input">
                    <small class="form-text text-muted">Aucun cahier des charges uploadé</small>
                  `;
                }
              } else {
                return `
                  <input type="file" id="editClientSpecifications" name="confidential_file" class="form-input">
                  <small class="form-text text-muted">Aucun cahier des charges uploadé</small>
                `;
              }
            })()}
          </div>

          <div class="form-group">
            <label class="form-label" for="editClientNotes">Notes internes / Informations confidentielles</label>
            <textarea id="editClientNotes" name="internal_notes"
                     class="form-input" rows="4"
                     placeholder="Notes internes, identifiants, informations sensibles...">${(() => {
                       // Si confidential_file contient du texte simple (pas un fichier JSON)
                       if (client.confidential_file_decrypted && !this.hasValidFile(client.confidential_file_decrypted)) {
                         return client.confidential_file_decrypted;
                       }
                       return '';
                     })()}</textarea>
            <small class="form-text">Ces informations seront chiffrées et stockées de manière sécurisée.</small>
          </div>
          
          
          <div class="form-section">
            <h3>Réinitialisation du mot de passe</h3>
            <div class="form-group">
              <label class="form-label" for="editClientNewPassword">
                Nouveau mot de passe (laisser vide pour ne pas changer)
              </label>
              <input type="password" id="editClientNewPassword" name="new_password" 
                     class="form-input" minlength="6">
              <small>Minimum 6 caractères si renseigné</small>
            </div>
          </div>
          
          <div class="form-section">
            <h3> Configuration SLA</h3>
            <p><small>Définir les délais de réponse et de résolution selon la priorité</small></p>
            
            ${['low', 'normal', 'high', 'urgent'].map(priority => {
              const sla = slaRules.find(s => s.priority === priority);
              const priorityLabels = {
                'low': ' Faible',
                'normal': ' Normale', 
                'high': 'Élevée',
                'urgent': ' Urgente'
              };
              
              return `
                <div class="sla-priority-group">
                  <h4>${priorityLabels[priority]}</h4>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Temps de réponse (heures)</label>
                      <input type="number" name="sla_${priority}_response" 
                             class="form-input" min="1" max="720" 
                             value="${sla ? sla.response_time_hours : this.getDefaultSLATime(priority, 'response')}" required>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Temps de résolution (heures)</label>
                      <input type="number" name="sla_${priority}_resolution" 
                             class="form-input" min="1" max="8760" 
                             value="${sla ? sla.resolution_time_hours : this.getDefaultSLATime(priority, 'resolution')}" required>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          
          <div class="form-info">
            <p><small> ${client.project_count || 0} projets - ${client.ticket_count || 0} tickets</small></p>
            <p><small>Inscrit le ${api.formatDate(client.created_at)}</small></p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </form>
      `);

      document.getElementById('editClientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditClient(e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement du client', 'error');
    }
  }

  async handleEditClient(form) {
    const formData = new FormData(form);
    const clientId = formData.get('id');

    const updateData = {
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      email: formData.get('email'),
      company: formData.get('company'),
      address: formData.get('address'),
      city: formData.get('city'),
      country: formData.get('country'),
      confidential_file: formData.get('confidential_file')
    };

    // Nettoyer les valeurs vides
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '' || updateData[key] === null) {
        updateData[key] = null;
      }
    });

    // Gérer les fichiers uploadés
    const quoteFile = formData.get('quote_file');
    const specificationsFile = formData.get('specifications_file');

    // Convertir les fichiers en base64 si fournis
    if (quoteFile && quoteFile instanceof File && quoteFile.size > 0) {
      try {
        const quoteBase64 = await this.readFileAsBase64(quoteFile);
        updateData.quote_file = this.createFileMetadata(quoteFile, quoteBase64);
      } catch (error) {
        console.error('Erreur lecture fichier devis:', error);
        this.showNotification(`Erreur lors de la lecture du fichier devis: ${error.message}`, 'error');
        return;
      }
    }

    if (specificationsFile && specificationsFile instanceof File && specificationsFile.size > 0) {
      try {
        const specsBase64 = await this.readFileAsBase64(specificationsFile);
        const specsMetadata = this.createFileMetadata(specificationsFile, specsBase64);

        // Stocker le cahier des charges dans confidential_file avec un marqueur
        const currentConfidential = updateData.confidential_file || '';
        updateData.confidential_file = currentConfidential +
          (currentConfidential ? '\n\n--- CAHIER DES CHARGES ---\n\n' : '') +
          specsMetadata;
      } catch (error) {
        console.error('Erreur lecture cahier des charges:', error);
        this.showNotification(`Erreur lors de la lecture du cahier des charges: ${error.message}`, 'error');
        return;
      }
    }

    // Collecter les données SLA
    const slaData = [];
    ['low', 'normal', 'high', 'urgent'].forEach(priority => {
      const responseTime = parseInt(formData.get(`sla_${priority}_response`));
      const resolutionTime = parseInt(formData.get(`sla_${priority}_resolution`));
      
      if (responseTime && resolutionTime) {
        slaData.push({
          client_id: parseInt(clientId),
          priority: priority,
          response_time_hours: responseTime,
          resolution_time_hours: resolutionTime
        });
      }
    });

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';

      // Mise à jour des informations
      await api.updateUser(clientId, updateData);
      
      // Si nouveau mot de passe fourni
      const newPassword = formData.get('new_password');
      if (newPassword && newPassword.length >= 6) {
        await api.updateUser(clientId, { password: newPassword });
        this.showNotification('Mot de passe mis à jour', 'info');
      }
      
      // Mise à jour des règles SLA
      for (const slaRule of slaData) {
        try {
          // Vérifier si une règle existe déjà pour ce client et cette priorité
          const existingRulesResponse = await api.getClientSLARules(clientId);
          const existingRule = existingRulesResponse.data.sla_rules?.find(
            r => r.priority === slaRule.priority
          );
          
          if (existingRule) {
            // Mettre à jour la règle existante
            await api.updateSLARule(existingRule.id, {
              response_time_hours: slaRule.response_time_hours,
              resolution_time_hours: slaRule.resolution_time_hours
            });
          } else {
            // Créer une nouvelle règle
            await api.createSLARule(slaRule);
          }
        } catch (slaError) {
          console.error('SLA update error:', slaError);
        }
      }
      
      this.showNotification('Client et règles SLA modifiés avec succès', 'success');
      this.closeModal();
      this.loadClients();
      
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la modification', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer les modifications';
    }
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      // Vérifier la taille du fichier (limite à 20MB)
      if (file.size > 20 * 1024 * 1024) {
        reject(new Error('Le fichier est trop volumineux (maximum 20MB)'));
        return;
      }

      // Si c'est une image, essayer de la compresser
      if (file.type.startsWith('image/')) {
        this.compressImage(file, 0.7).then(compressedFile => {
          const reader = new FileReader();
          reader.onload = event => resolve(event.target.result);
          reader.onerror = error => reject(new Error(`Erreur lors de la lecture du fichier: ${error.message}`));
          reader.readAsDataURL(compressedFile);
        }).catch(() => {
          // Si la compression échoue, utiliser le fichier original
          const reader = new FileReader();
          reader.onload = event => resolve(event.target.result);
          reader.onerror = error => reject(new Error(`Erreur lors de la lecture du fichier: ${error.message}`));
          reader.readAsDataURL(file);
        });
      } else {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(new Error(`Erreur lors de la lecture du fichier: ${error.message}`));
        reader.readAsDataURL(file);
      }
    });
  }

  compressImage(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions (max 1024px)
        const maxSize = 1024;
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir en blob avec compression
        canvas.toBlob(resolve, file.type, quality);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  createFileMetadata(file, base64Data) {
    // Calculer la taille des données base64 (approximation)
    const base64Size = base64Data.length * 0.75;

    return JSON.stringify({
      name: file.name,
      type: file.type,
      originalSize: file.size,
      compressedSize: base64Size,
      lastModified: file.lastModified,
      data: base64Data
    });
  }

  downloadFileFromMetadata(metadataString, fallbackName = 'fichier') {
    try {
      const metadata = JSON.parse(metadataString);

      // Créer un lien de téléchargement
      const link = document.createElement('a');
      link.href = metadata.data;
      link.download = metadata.name || fallbackName;

      // Déclencher le téléchargement
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      this.showNotification('Erreur lors du téléchargement du fichier', 'error');
      return false;
    }
  }

  async deleteClient(id) {
    try {
      // Charger les infos du client pour confirmation
      const response = await api.getUser(id);
      const client = response.data.user;
      
      // Vérifier les dépendances
      const projectsResponse = await api.getProjects({ client_id: id });
      const projects = projectsResponse.data.projects;
      
      // Modal de confirmation détaillée
      const modal = this.createModal(' Confirmer la suppression', `
        <div class="delete-confirmation">
          <div class="delete-warning">
            <p><strong>Vous êtes sur le point de supprimer le client :</strong></p>
            <div class="client-info-box">
              <p><strong>${client.first_name} ${client.last_name}</strong></p>
              <p>${client.email}</p>
              ${client.company ? `<p>${client.company}</p>` : ''}
            </div>
          </div>
          
          ${projects.length > 0 ? `
            <div class="delete-impact">
              <h4> Impact de la suppression :</h4>
              <ul>
                <li> ${projects.length} projet(s) seront supprimés</li>
                <li> Tous les tickets associés seront supprimés</li>
                <li> Tous les commentaires seront supprimés</li>
                <li> Toutes les pièces jointes seront supprimées</li>
              </ul>
              
              <div class="projects-list">
                <p><strong>Projets qui seront supprimés :</strong></p>
                ${projects.map(p => `
                  <div class="project-item">
                    • ${p.name} (${p.ticket_count || 0} tickets)
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="delete-info">
              <p> Ce client n'a aucun projet associé.</p>
            </div>
          `}
          
          <div class="delete-confirm-section">
            <p class="text-danger"><strong>Cette action est irréversible !</strong></p>
            
            <div class="form-group">
              <label>Pour confirmer, tapez : <strong>SUPPRIMER ${client.email}</strong></label>
              <input type="text" id="deleteConfirmText" class="form-input" 
                     placeholder="Tapez le texte ci-dessus">
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">
              Annuler
            </button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn" disabled>
               Supprimer définitivement
            </button>
          </div>
        </div>
      `);

      // Validation du texte de confirmation
      const confirmText = `SUPPRIMER ${client.email}`;
      const confirmInput = document.getElementById('deleteConfirmText');
      const confirmBtn = document.getElementById('confirmDeleteBtn');
      
      confirmInput.addEventListener('input', (e) => {
        confirmBtn.disabled = e.target.value !== confirmText;
      });

      confirmBtn.addEventListener('click', async () => {
        await this.performDeleteClient(id, client);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement des informations', 'error');
    }
  }

  async performDeleteClient(id, client) {
    try {
      const confirmBtn = document.getElementById('confirmDeleteBtn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Suppression en cours...';

      // Suppression
      await api.deleteUser(id);
      
      this.showNotification(`Client ${client.email} supprimé avec succès`, 'success');
      this.closeModal();
      
      // Recharger la liste
      this.loadClients();
      
      // Log pour audit
      console.log(`[AUDIT] Client supprimé : ${client.email} (ID: ${id}) par ${this.currentUser.email}`);
      
    } catch (error) {
      this.showNotification(
        error.message || 'Erreur lors de la suppression. Le client pourrait avoir des données liées.',
        'error'
      );
      this.closeModal();
    }
  }

  async editSLA(clientId) {
    try {
      // Charger les SLAs du client
      const response = await api.getSLAs(clientId);
      const slas = response.data.slas || [];
      
      // Charger les informations client
      const clientResponse = await api.getUser(clientId);
      const client = clientResponse.data.user;
      
      const modal = this.createModal(`Configuration SLA - ${client.company || client.first_name + ' ' + client.last_name}`, `
        <form id="editSLAForm" class="form">
          <div class="sla-info">
            <p>Configurez les temps de réponse et de résolution garantis pour chaque niveau de priorité.</p>
          </div>
          
          ${['urgent', 'high', 'normal', 'low'].map(priority => {
            const sla = slas.find(s => s.priority === priority) || {
              response_time_hours: this.getDefaultSLAHours(priority).response,
              resolution_time_hours: this.getDefaultSLAHours(priority).resolution
            };
            
            return `
              <div class="sla-priority-section">
                <h4 class="priority-title ${priority}">${this.getPriorityLabel(priority)}</h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="response_${priority}">Temps de réponse (heures)</label>
                    <input type="number" id="response_${priority}" name="response_${priority}" 
                           class="form-input" value="${sla.response_time_hours}" min="1" max="168" required>
                    <small>Délai maximum pour la première réponse</small>
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" for="resolution_${priority}">Temps de résolution (heures)</label>
                    <input type="number" id="resolution_${priority}" name="resolution_${priority}" 
                           class="form-input" value="${sla.resolution_time_hours}" min="1" max="720" required>
                    <small>Délai maximum pour résoudre le ticket</small>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
          
          <div class="sla-preview">
            <h4>Aperçu des SLAs</h4>
            <div class="sla-preview-grid">
              ${['urgent', 'high', 'normal', 'low'].map(priority => `
                <div class="sla-preview-item ${priority}">
                  <span class="preview-priority">${this.getPriorityLabel(priority)}</span>
                  <span class="preview-times" id="preview_${priority}">
                    Réponse: ${slas.find(s => s.priority === priority)?.response_time_hours || this.getDefaultSLAHours(priority).response}h | 
                    Résolution: ${slas.find(s => s.priority === priority)?.resolution_time_hours || this.getDefaultSLAHours(priority).resolution}h
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer les SLAs</button>
          </div>
        </form>
      `, 'large');

      // Mise à jour en temps réel de l'aperçu
      ['urgent', 'high', 'normal', 'low'].forEach(priority => {
        ['response', 'resolution'].forEach(type => {
          document.getElementById(`${type}_${priority}`).addEventListener('input', (e) => {
            this.updateSLAPreview(priority);
          });
        });
      });

      document.getElementById('editSLAForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditSLA(clientId, e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement des SLAs', 'error');
    }
  }

  getDefaultSLAHours(priority) {
    const defaults = {
      'urgent': { response: 2, resolution: 8 },
      'high': { response: 8, resolution: 24 },
      'normal': { response: 24, resolution: 72 },
      'low': { response: 72, resolution: 168 }
    };
    return defaults[priority] || defaults['normal'];
  }

  updateSLAPreview(priority) {
    const response = document.getElementById(`response_${priority}`).value;
    const resolution = document.getElementById(`resolution_${priority}`).value;
    const preview = document.getElementById(`preview_${priority}`);
    
    if (preview) {
      preview.textContent = `Réponse: ${response}h | Résolution: ${resolution}h`;
    }
  }

  async handleEditSLA(clientId, form) {
    const formData = new FormData(form);
    const priorities = ['urgent', 'high', 'normal', 'low'];
    
    const slaUpdates = priorities.map(priority => ({
      priority,
      response_time_hours: parseInt(formData.get(`response_${priority}`)),
      resolution_time_hours: parseInt(formData.get(`resolution_${priority}`))
    }));

    // Validation
    for (const sla of slaUpdates) {
      if (sla.response_time_hours >= sla.resolution_time_hours) {
        this.showNotification(
          `Erreur ${sla.priority}: Le temps de réponse doit être inférieur au temps de résolution`,
          'error'
        );
        return;
      }
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';

      await api.updateClientSLAs(clientId, slaUpdates);
      
      this.showNotification('Configuration SLA mise à jour avec succès', 'success');
      this.closeModal();
      
      // Recharger la liste des clients si on est sur cet onglet
      if (this.currentTab === 'clients') {
        this.loadClients();
      }
      
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la mise à jour des SLAs', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enregistrer les SLAs';
    }
  }

  async showAddProjectModal(preSelectedClientId = null) {
    try {
      const response = await api.getClients();
      const clients = response.data.clients;
      
      if (clients.length === 0) {
        this.showNotification('Aucun client disponible. Créez d\'abord un client.', 'warning');
        return;
      }

      const modal = this.createModal('Nouveau Projet', `
        <form id="addProjectForm" class="form">
          <div class="form-group">
            <label class="form-label" for="projectClient">Client *</label>
            <select id="projectClient" name="client_id" class="form-input" required>
              <option value="">-- Sélectionner un client --</option>
              ${clients.map(client => `
                <option value="${client.id}" ${client.id === preSelectedClientId ? 'selected' : ''}>
                  ${client.company || `${client.first_name} ${client.last_name}`} 
                  (${client.email})
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="projectName">Nom du projet *</label>
            <input type="text" id="projectName" name="name" class="form-input" 
                   placeholder="Ex: Refonte site web, Application mobile..." required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="projectDescription">Description</label>
            <textarea id="projectDescription" name="description" class="form-input" 
                      rows="4" placeholder="Description détaillée du projet..."></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="projectStatus">Statut initial</label>
            <select id="projectStatus" name="status" class="form-input">
              <option value="active" selected>Actif</option>
              <option value="paused">En pause</option>
              <option value="completed">Terminé</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
          
          <div class="form-info">
            <p><small> Une fois le projet créé, vous pourrez y associer des tickets de support.</small></p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Créer le Projet</button>
          </div>
        </form>
      `);

      document.getElementById('addProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddProject(e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement des clients', 'error');
    }
  }

  async handleAddProject(form) {
    const formData = new FormData(form);
    const projectData = {
      client_id: parseInt(formData.get('client_id')),
      name: formData.get('name').trim(),
      description: formData.get('description').trim(),
      status: formData.get('status') || 'active'
    };

    // Validation supplémentaire
    if (!projectData.client_id) {
      this.showNotification('Veuillez sélectionner un client', 'error');
      return;
    }

    if (projectData.name.length < 3) {
      this.showNotification('Le nom du projet doit contenir au moins 3 caractères', 'error');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création en cours...';

      const response = await api.createProject(projectData);
      
      if (response.success) {
        this.showNotification('Projet créé avec succès', 'success');
        this.closeModal();
        
        // Recharger la liste des projets si on est sur cet onglet
        if (this.currentTab === 'projects') {
          this.loadProjects();
        }
        
        // Optionnel : proposer de créer le premier ticket
        if (confirm('Projet créé ! Voulez-vous créer le premier ticket maintenant ?')) {
          this.showAddTicketModal(response.data.project.id);
        }
      }
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la création du projet', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer le Projet';
    }
  }

  async showAddTicketModal(projectId = null) {
    try {
      // Charger les projets
      const projectsResponse = await api.getProjects();
      const projects = projectsResponse.data.projects;
      
      if (projects.length === 0) {
        this.showNotification('Aucun projet disponible', 'warning');
        return;
      }

      const modal = this.createModal('Nouveau Ticket', `
        <form id="addTicketForm" class="form">
          <div class="form-group">
            <label class="form-label" for="ticketProject">Projet *</label>
            <select id="ticketProject" name="project_id" class="form-input" required>
              ${projects.map(project => `
                <option value="${project.id}" ${project.id === projectId ? 'selected' : ''}>
                  ${project.name} (${project.client_company || project.client_first_name})
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="ticketTitle">Titre *</label>
            <input type="text" id="ticketTitle" name="title" class="form-input" 
                   placeholder="Résumé du problème ou de la demande" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="ticketDescription">Description *</label>
            <textarea id="ticketDescription" name="description" class="form-input" 
                      rows="5" placeholder="Description détaillée..." required></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ticketPriority">Priorité *</label>
              <select id="ticketPriority" name="priority" class="form-input" required>
                <option value="low"> Faible</option>
                <option value="normal" selected> Normale</option>
                <option value="high">Élevée</option>
                <option value="urgent"> Urgente</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketAssignee">Assigner à</label>
              <select id="ticketAssignee" name="assigned_to" class="form-input">
                <option value="">Non assigné</option>
                <!-- Charger dynamiquement les membres de l'équipe -->
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Créer le Ticket</button>
          </div>
        </form>
      `);

      document.getElementById('addTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddTicket(e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement', 'error');
    }
  }

  async handleAddTicket(form) {
    const formData = new FormData(form);
    const ticketData = {
      project_id: parseInt(formData.get('project_id')),
      title: formData.get('title').trim(),
      description: formData.get('description').trim(),
      priority: formData.get('priority'),
      assigned_to: formData.get('assigned_to') || null,
      status: 'open'
    };

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création en cours...';

      const response = await api.createTicket(ticketData);
      
      if (response.success) {
        this.showNotification('Ticket créé avec succès', 'success');
        this.closeModal();
        
        // Recharger la vue appropriée
        if (this.currentTab === 'dashboard') {
          this.loadDashboard();
        }
      }
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la création du ticket', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer le Ticket';
    }
  }

  showAddClientModal() {
    const modal = this.createModal('Nouveau Client', `
      <form id="addClientForm" class="form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="clientFirstName">Prénom *</label>
            <input type="text" id="clientFirstName" name="first_name" 
                   class="form-input" placeholder="Jean" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="clientLastName">Nom *</label>
            <input type="text" id="clientLastName" name="last_name" 
                   class="form-input" placeholder="Dupont" required>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientEmail">Email *</label>
          <input type="email" id="clientEmail" name="email" 
                 class="form-input" placeholder="jean.dupont@entreprise.com" required>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientCompany">Entreprise</label>
          <input type="text" id="clientCompany" name="company" 
                 class="form-input" placeholder="Nom de l'entreprise">
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientAddress">Adresse</label>
          <input type="text" id="clientAddress" name="address" 
                 class="form-input" placeholder="123 rue de la Paix">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="clientCity">Ville</label>
            <input type="text" id="clientCity" name="city" 
                   class="form-input" placeholder="Paris">
          </div>
          <div class="form-group">
            <label class="form-label" for="clientCountry">Pays</label>
            <input type="text" id="clientCountry" name="country" 
                   class="form-input" placeholder="France">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientSiren">SIREN</label>
          <input type="text" id="clientSiren" name="siren" 
                 class="form-input" placeholder="123 456 789" maxlength="9">
          <small>Numéro SIREN de l'entreprise (optionnel)</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientQuote">Devis *</label>
          <input type="file" id="clientQuote" name="quote_file"
                 class="form-input" required>
          <small>Tous formats acceptés (max 2MB, images compressées automatiquement)</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientSpecifications">Cahier des charges</label>
          <input type="file" id="clientSpecifications" name="confidential_file"
                 class="form-input">
          <small>Tous formats acceptés (max 2MB, images compressées automatiquement)</small>
        </div>
        
        
        <div class="form-group">
          <label class="form-label" for="clientPassword">Mot de passe temporaire *</label>
          <input type="password" id="clientPassword" name="password" 
                 class="form-input" minlength="6" required>
          <small>Le client pourra le modifier lors de sa première connexion</small>
        </div>
        
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer le Client</button>
        </div>
      </form>
    `);

    document.getElementById('addClientForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted - handleAddClient called');
      await this.handleAddClient(e.target);
    });
  }

  async showNewInvoiceModal() {
    try {
      // Charger la liste des clients
      const response = await api.getClients();
      const clients = response.data.clients;
      
      if (clients.length === 0) {
        this.showNotification('Aucun client disponible. Créez d\'abord un client avant de créer une facture.', 'warning');
        return;
      }
      
      const modal = this.createModal('Nouvelle Facture', `
        <form id="newInvoiceForm" class="form">
          <div class="form-group">
            <label class="form-label" for="invoiceClient">Client *</label>
            <select id="invoiceClient" name="client_id" class="form-select" required>
              <option value="">-- Sélectionner un client --</option>
              ${clients.map(client => 
                `<option value="${client.id}">${client.company || (client.first_name + ' ' + client.last_name)} - ${client.email}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Continuer</button>
          </div>
        </form>
      `);

      document.getElementById('newInvoiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientId = parseInt(document.getElementById('invoiceClient').value);
        if (clientId) {
          this.closeModal();
          this.showCreateInvoiceModal(clientId);
        }
      });
    } catch (error) {
      console.error('Load clients error:', error);
      this.showNotification('Erreur lors du chargement des clients', 'error');
    }
  }

  async handleAddClient(form) {
    console.log('handleAddClient function started');
    const formData = new FormData(form);
    const clientData = {
      first_name: formData.get('first_name').trim(),
      last_name: formData.get('last_name').trim(),
      email: formData.get('email').trim().toLowerCase(),
      company: formData.get('company')?.trim() || null,
      company_address: formData.get('company_address')?.trim() || null,
      siren: formData.get('siren')?.trim() || null,
      password: formData.get('password'),
      role: 'client'
    };
    
    console.log('Data to send:', clientData);

    // Validation
    if (clientData.first_name.length < 2) {
      this.showNotification('Le prénom doit contenir au moins 2 caractères', 'error');
      return;
    }

    if (clientData.last_name.length < 2) {
      this.showNotification('Le nom doit contenir au moins 2 caractères', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientData.email)) {
      this.showNotification('Email invalide - Format requis: nom@domaine.com', 'error');
      return;
    }

    if (clientData.password.length < 6) {
      this.showNotification('Le mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création en cours...';

      console.log('Calling api.createUser...');
      const response = await api.createUser(clientData);
      console.log('API Response:', response);
      
      if (response.success) {
        const clientId = response.data.user.id;
        
        // Traitement des fichiers si présents
        const quoteFile = formData.get('quote_file');
        const specificationsFile = formData.get('specifications_file');

        const fileUpdateData = {};

        try {
          if (quoteFile && quoteFile.size > 0) {
            submitBtn.textContent = 'Traitement du devis...';
            const quoteBase64 = await this.readFileAsBase64(quoteFile);
            fileUpdateData.quote_file = this.createFileMetadata(quoteFile, quoteBase64);
          }

          if (specificationsFile && specificationsFile.size > 0) {
            submitBtn.textContent = 'Traitement du cahier des charges...';
            const specsBase64 = await this.readFileAsBase64(specificationsFile);
            const specsMetadata = this.createFileMetadata(specificationsFile, specsBase64);
            fileUpdateData.confidential_file = specsMetadata;
          }

          // Mettre à jour le client avec les fichiers
          if (Object.keys(fileUpdateData).length > 0) {
            submitBtn.textContent = 'Sauvegarde des fichiers...';
            await api.updateUser(clientId, fileUpdateData);
          }

          this.showNotification('Client créé avec succès (fichiers traités)', 'success');
        } catch (fileError) {
          console.error('File processing error:', fileError);
          this.showNotification('Client créé mais erreur lors du traitement des fichiers', 'warning');
        }
        
        this.closeModal();
        this.loadClients();
        
        // Proposer de créer un projet directement
        if (confirm('Client créé ! Voulez-vous créer un projet pour ce client maintenant ?')) {
          this.showAddProjectModal(clientId);
        }
      }
    } catch (error) {
      console.error('Create client error:', error);
      this.showNotification(error.message || 'Erreur lors de la création du client', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer le Client';
    }
  }

  createModal(title, content, size = 'normal') {
    // Remove existing modal if any
    const existingModal = document.getElementById('modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalSizeClass = size === 'large' ? 'modal-large' : '';

    const modal = document.createElement('div');
    modal.id = 'modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content ${modalSizeClass}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button type="button" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // ULTRA FIX - Capturer la position du scroll et bloquer le défilement
    const scrollY = window.scrollY || window.pageYOffset;
    modal.dataset.scrollPosition = scrollY;
    
    // Ajouter la classe modal-open au html ET body pour empêcher le défilement
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    
    // Forcer le body à rester à la position actuelle
    document.body.style.top = `-${scrollY}px`;
    
    // Mettre à jour les dates avec le bon fuseau horaire après injection DOM
    // Utiliser setTimeout pour s'assurer que le DOM est complètement rendu
    setTimeout(() => {
      updateAllDatesInDOM();
    }, 10);
    
    // Scroller automatiquement vers le bas de la conversation
    setTimeout(() => {
      const commentsList = document.getElementById('commentsList');
      if (commentsList) {
        commentsList.scrollTop = commentsList.scrollHeight;
      }
    }, 100); // Petit délai pour s'assurer que le contenu est rendu
    
    // Ajouter event listeners pour fermer le modal
    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtns = modal.querySelectorAll('.cancel-btn');
    const closeModalBtns = modal.querySelectorAll('.close-modal-btn');
    
    if (overlay) overlay.addEventListener('click', () => this.closeModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    
    // Fermer en cliquant en dehors du contenu de la modal (sur le fond)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
    
    // Ajouter event listeners pour tous les boutons d'annulation et de fermeture
    cancelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal();
      });
    });
    
    closeModalBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal();
      });
    });
    
    // Focus trap
    setTimeout(() => {
      const focusableElements = modal.querySelectorAll('input, textarea, select, button');
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }, 100);

    return modal;
  }

  closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
      // ULTRA FIX - Récupérer la position du scroll stockée
      const scrollY = parseInt(modal.dataset.scrollPosition || 0);
      
      modal.remove();
      
      // Retirer la classe modal-open du html ET body pour réactiver le défilement
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      
      // Réinitialiser le style et restaurer la position du scroll
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    } else {
      // Au cas où le modal n'existe pas, nettoyer quand même
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
    }
  }

  showNotification(message, type = 'info') {
    // Créer une notification temporaire
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    // Ajouter au body
    document.body.appendChild(notification);
    
    // Ajouter event listener pour fermer
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => notification.remove());
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Ancienne fonction remplacée par calculateSLATimeRemaining et formatSLADisplay

  formatInvoiceSLA(invoice) {
    if (!invoice.due_date || invoice.status === 'paid' || invoice.status === 'cancelled') {
      return '<span class="sla-status sla-good">-</span>';
    }

    const now = new Date();
    const dueDate = new Date(invoice.due_date);
    const diffMs = dueDate - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const overdue = Math.abs(diffDays);
      return `<span class="sla-status sla-overdue"> +${overdue}j (en retard)</span>`;
    } else if (diffDays <= 3) {
      return `<span class="sla-status sla-warning"> ${diffDays}j restants</span>`;
    } else if (diffDays <= 7) {
      return `<span class="sla-status sla-ok"> ${diffDays}j restants</span>`;
    } else {
      return `<span class="sla-status sla-good"> ${diffDays}j restants</span>`;
    }
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  async loadInvoices() {
    const container = document.getElementById('invoicesList');
    container.innerHTML = '<div class="loading">Chargement des factures...</div>';

    try {
      const filters = {};
      const statusFilter = document.getElementById('invoiceStatusFilter')?.value;
      if (statusFilter) filters.status = statusFilter;

      const response = await api.getInvoices(filters);
      
      if (response.data && response.data.invoices) {
        this.renderInvoicesTable(response.data.invoices);
      } else {
        container.innerHTML = '<div class="error-message">Format de réponse invalide</div>';
      }
    } catch (error) {
      console.error('Invoices load error:', error);
      container.innerHTML = `<div class="error-message">Erreur lors du chargement des factures: ${error.message}</div>`;
    }
  }

  renderInvoicesTable(invoices) {
    const container = document.getElementById('invoicesList');
    
    if (!invoices || invoices.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucune facture trouvée</p></div>';
      return;
    }

    const tableHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Client</th>
            <th>Montant TTC</th>
            <th>Statut</th>
            <th>Échéance</th>
            <th>SLA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(invoice => `
            <tr>
              <td><strong>${invoice.invoice_number}</strong></td>
              <td>${invoice.company || invoice.first_name + ' ' + invoice.last_name}</td>
              <td><strong>${invoice.amount_ttc}€</strong></td>
              <td><span class="status-badge status-${invoice.status}">${this.getInvoiceStatusLabel(invoice.status)}</span></td>
              <td>${invoice.due_date ? api.formatDate(invoice.due_date) : '-'}</td>
              <td>${this.formatInvoiceSLA(invoice)}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-invoice-id="${invoice.id}" data-action="view-invoice"> Voir</button>
                  <button class="btn-action btn-delete" data-invoice-id="${invoice.id}" data-action="delete-invoice"> Supprimer</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
    
    // Ajouter les event listeners
    container.querySelectorAll('[data-action="view-invoice"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const invoiceId = parseInt(e.target.dataset.invoiceId);
        this.viewInvoice(invoiceId);
      });
    });
    
    container.querySelectorAll('[data-action="delete-invoice"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const invoiceId = parseInt(e.target.dataset.invoiceId);
        this.deleteInvoice(invoiceId);
      });
    });
    
    container.querySelectorAll('[data-action="download-invoice"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const invoiceId = parseInt(e.target.dataset.invoiceId);
        this.downloadInvoicePDF(invoiceId);
      });
    });
  }

  async deleteInvoice(invoiceId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.')) {
      return;
    }

    try {
      const response = await api.deleteInvoice(invoiceId);
      
      if (response.success) {
        this.showNotification('Facture supprimée avec succès', 'success');
        // Recharger la liste des factures
        this.loadInvoices();
      } else {
        this.showNotification(response.message || 'Erreur lors de la suppression', 'error');
      }
    } catch (error) {
      console.error('Delete invoice error:', error);
      this.showNotification('Erreur lors de la suppression de la facture', 'error');
    }
  }

  getInvoiceStatusLabel(status) {
    const labels = {
      'sent': ' Envoyée', 
      'paid': ' Payée',
      'overdue': ' En retard',
      'cancelled': ' Annulée'
    };
    return labels[status] || status;
  }

  async showCreateInvoiceModal(clientId) {
    try {
      // Charger les informations du client
      const response = await api.getUser(clientId);
      const client = response.data.user;
      
      const modal = this.createModal(`Créer une facture - ${client.company || client.first_name + ' ' + client.last_name}`, `
        <form id="createInvoiceForm" class="form">
          <input type="hidden" name="client_id" value="${clientId}">
          
          <div class="client-info-box">
            <h4> Informations Client</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>Nom:</strong> ${client.first_name} ${client.last_name}
              </div>
              <div class="info-item">
                <strong>Email:</strong> ${client.email}
              </div>
              ${client.company ? `<div class="info-item"><strong>Entreprise:</strong> ${client.company}</div>` : ''}
              ${client.address ? `<div class="info-item"><strong>Adresse:</strong> ${client.address}</div>` : ''}
              ${client.city ? `<div class="info-item"><strong>Ville:</strong> ${client.city}</div>` : ''}
              ${client.country ? `<div class="info-item"><strong>Pays:</strong> ${client.country}</div>` : ''}
              <div class="info-item">
                <strong>Projets:</strong> ${client.project_count || 0} projets
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="invoiceDescription">Description de la prestation *</label>
            <textarea id="invoiceDescription" name="description" 
                      class="form-input" rows="4" required
                      placeholder="Décrivez la prestation facturée (développement, maintenance, consulting...)"></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="invoiceAttachment">Document associé (optionnel)</label>
            <input type="file" id="invoiceAttachment" name="attachment" 
                   class="form-input" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png">
            <small>Formats acceptés: PDF, Word, images, texte (max 10MB)</small>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="invoiceAmountHT">Montant HT (€) *</label>
              <input type="number" id="invoiceAmountHT" name="amount_ht" 
                     class="form-input" step="0.01" min="0" required
                     placeholder="0.00">
            </div>
            
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="invoiceNoTVA" name="no_tva"> 
                Pas de TVA (montant HT = montant TTC)
              </label>
              <small>Cochez si exonération de TVA ou auto-entrepreneur</small>
            </div>
          </div>
          
          <div class="calculation-preview">
            <div class="calc-row">
              <span>Montant HT:</span>
              <span id="previewAmountHT">0.00€</span>
            </div>
            <div class="calc-row">
              <span>TVA (20%):</span>
              <span id="previewTVA">0.00€</span>
            </div>
            <div class="calc-row total">
              <strong>Montant TTC:</strong>
              <strong id="previewAmountTTC">0.00€</strong>
            </div>
          </div>
          
          <div class="company-info">
            <h4>Informations Facturation</h4>
            <div class="info-grid">
              <div class="info-item"><strong>SIREN:</strong> 990204588</div>
              <div class="info-item"><strong>Adresse:</strong> 55 AVENUE MARCEAU, 75016 PARIS</div>
              <div class="info-item"><strong>Société:</strong> Shape</div>
              <div class="info-item"><strong>Contact:</strong> omar@shape-conseil.fr</div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary">Créer la facture</button>
          </div>
        </form>
      `);

      // Calculateur en temps réel
      const amountHTInput = document.getElementById('invoiceAmountHT');
      const noTVACheckbox = document.getElementById('invoiceNoTVA');
      
      const updateCalculation = () => {
        const amountHT = parseFloat(amountHTInput.value) || 0;
        const noTVA = noTVACheckbox.checked;
        
        const tvaAmount = noTVA ? 0 : amountHT * 0.2;
        const amountTTC = amountHT + tvaAmount;
        
        document.getElementById('previewAmountHT').textContent = `${amountHT.toFixed(2)}€`;
        document.getElementById('previewTVA').textContent = `${tvaAmount.toFixed(2)}€`;
        document.getElementById('previewAmountTTC').textContent = `${amountTTC.toFixed(2)}€`;
      };
      
      amountHTInput.addEventListener('input', updateCalculation);
      noTVACheckbox.addEventListener('change', updateCalculation);
      
      // Initialiser le calcul
      updateCalculation();

      document.getElementById('createInvoiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateInvoice(e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement des informations client', 'error');
    }
  }

  async handleCreateInvoice(form) {
    const formData = new FormData(form);
    
    // Vérifier s'il y a un fichier attaché
    const attachmentFile = formData.get('attachment');
    if (attachmentFile && attachmentFile.size > 10 * 1024 * 1024) { // 10MB max
      this.showNotification('Le fichier ne doit pas dépasser 10MB', 'error');
      return;
    }
    
    const invoiceData = {
      client_id: parseInt(formData.get('client_id')),
      amount_ht: parseFloat(formData.get('amount_ht')),
      description: formData.get('description').trim(),
      no_tva: formData.get('no_tva') === 'on',
      tva_rate: formData.get('no_tva') === 'on' ? 0 : 20
    };
    
    // Ajouter le fichier si présent
    if (attachmentFile && attachmentFile.size > 0) {
      invoiceData.attachment = attachmentFile;
    }

    // Validation
    if (invoiceData.amount_ht <= 0) {
      this.showNotification('Le montant HT doit être supérieur à 0', 'error');
      return;
    }

    if (!invoiceData.description || invoiceData.description.length < 5) {
      this.showNotification('La description doit contenir au moins 5 caractères', 'error');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création en cours...';

      const response = await api.createInvoice(invoiceData);
      
      if (response.success) {
        this.showNotification('Facture créée avec succès', 'success');
        this.closeModal();
        
        // Recharger la liste des factures si on est sur l'onglet facturation
        if (this.currentTab === 'invoices') {
          this.loadInvoices();
        }
        
        // Proposer de télécharger le PDF
        if (confirm('Facture créée ! Voulez-vous télécharger le PDF maintenant ?')) {
          this.downloadInvoicePDF(response.data.invoice.id);
        }
      }
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la création de la facture', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer la facture';
    }
  }

  async viewInvoice(id) {
    try {
      const response = await api.getInvoice(id);
      const invoice = response.data.invoice;
      
      this.showViewInvoiceModal(invoice);
    } catch (error) {
      console.error('View invoice error:', error);
      this.showNotification('Erreur lors du chargement de la facture', 'error');
    }
  }

  async editInvoice(id) {
    try {
      const response = await api.getInvoice(id);
      const invoice = response.data.invoice;
      
      this.showEditInvoiceModal(invoice);
    } catch (error) {
      console.error('Edit invoice error:', error);
      this.showNotification('Erreur lors du chargement de la facture', 'error');
    }
  }

  async downloadInvoicePDF(id) {
    try {
      // Récupérer les données de la facture
      const response = await api.request(`/invoices/${id}/pdf`);
      const invoice = response.data.invoice;
      
      // Générer le PDF avec jsPDF
      window.generateSafeInvoicePDF(invoice);
      
      this.showNotification('PDF téléchargé avec succès', 'success');
    } catch (error) {
      this.showNotification('Erreur lors de la génération du PDF', 'error');
      console.error('PDF generation error:', error);
    }
  }

  generateInvoicePDF(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuration des couleurs et polices
    const primaryColor = [0, 123, 255];
    const darkColor = [33, 37, 41];
    
    // En-tête de la facture
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.text('FACTURE', 20, 30);
    
    // Informations de l'entreprise (Shape)
    doc.setFontSize(16);
    doc.setTextColor(...darkColor);
    doc.text('SHAPE', 140, 30);
    
    doc.setFontSize(10);
    doc.text('SIREN: 990204588', 140, 40);
    doc.text('55 Avenue Marceau', 140, 45);
    doc.text('75016 Paris', 140, 50);
    doc.text('omar@shape-conseil.fr', 140, 55);
    
    // Numéro et date de facture
    doc.setFontSize(12);
    doc.text(`Numéro: ${invoice.invoice_number}`, 20, 50);
    doc.text(`Date: ${api.formatDate(invoice.created_at)}`, 20, 57);
    if (invoice.due_date) {
      doc.text(`Échéance: ${api.formatDate(invoice.due_date)}`, 20, 64);
    }
    
    // Informations client
    doc.setFontSize(14);
    doc.text('Facturé à:', 20, 85);
    
    doc.setFontSize(10);
    let clientY = 95;
    doc.text(`${invoice.first_name} ${invoice.last_name}`, 20, clientY);
    clientY += 7;
    doc.text(invoice.email, 20, clientY);
    if (invoice.company) {
      clientY += 7;
      doc.text(invoice.company, 20, clientY);
    }
    
    // Ligne de séparation
    doc.setDrawColor(...primaryColor);
    doc.line(20, clientY + 15, 190, clientY + 15);
    
    // Détails de la prestation
    const tableY = clientY + 30;
    
    // En-tête du tableau
    doc.setFillColor(...primaryColor);
    doc.rect(20, tableY, 170, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Description', 25, tableY + 7);
    doc.text('Montant HT', 110, tableY + 7);
    doc.text('TVA', 140, tableY + 7);
    doc.text('Montant TTC', 160, tableY + 7);
    
    // Contenu du tableau
    doc.setTextColor(...darkColor);
    doc.setFillColor(245, 245, 245);
    doc.rect(20, tableY + 10, 170, 15, 'F');
    
    // Description (limitée à 50 caractères)
    const description = invoice.description.length > 50 ? 
      invoice.description.substring(0, 50) + '...' : invoice.description;
    
    doc.text(description, 25, tableY + 20);
    doc.text(`${parseFloat(invoice.amount_ht).toFixed(2)}€`, 110, tableY + 20);
    doc.text(`${parseFloat(invoice.tva_rate).toFixed(0)}%`, 140, tableY + 20);
    doc.text(`${parseFloat(invoice.amount_ttc).toFixed(2)}€`, 160, tableY + 20);
    
    // Totaux
    const totalY = tableY + 40;
    
    doc.setFontSize(10);
    doc.text('Total HT:', 130, totalY);
    doc.text(`${parseFloat(invoice.amount_ht).toFixed(2)}€`, 165, totalY);
    
    doc.text(`TVA (${parseFloat(invoice.tva_rate).toFixed(0)}%):`, 130, totalY + 7);
    doc.text(`${parseFloat(invoice.amount_tva).toFixed(2)}€`, 165, totalY + 7);
    
    // Total TTC en gras
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Total TTC:', 130, totalY + 17);
    doc.text(`${parseFloat(invoice.amount_ttc).toFixed(2)}€`, 165, totalY + 17);
    
    // Statut de la facture
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const statusY = totalY + 30;
    doc.text('Statut:', 20, statusY);
    
    // Couleur selon le statut
    switch(invoice.status) {
      case 'paid':
        doc.setTextColor(40, 167, 69);
        break;
      case 'overdue':
        doc.setTextColor(220, 53, 69);
        break;
      default:
        doc.setTextColor(255, 193, 7);
    }
    doc.text(this.getInvoiceStatusLabel(invoice.status), 40, statusY);
    
    // Pied de page
    doc.setTextColor(...darkColor);
    doc.setFontSize(8);
    doc.text('Merci pour votre confiance !', 20, 270);
    doc.text('En cas de question, contactez-nous à omar@shape-conseil.fr', 20, 275);
    
    // Télécharger le PDF
    doc.save(`Facture-${invoice.invoice_number}.pdf`);
  }

  showViewInvoiceModal(invoice) {
    this.createModal(`Facture ${invoice.invoice_number}`, `
      <div class="info-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <span class="status-badge status-${invoice.status}">${this.getInvoiceStatusLabel(invoice.status)}</span>
        </div>
      </div>
      
      <div class="modal-content">
        <div class="info-section">
          <h3 class="section-title">Informations générales</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Créée le</label>
              <div class="form-value">${api.formatDate(invoice.created_at)}</div>
            </div>
            ${invoice.due_date ? `
            <div class="form-group">
              <label class="form-label">Échéance</label>
              <div class="form-value">${api.formatDate(invoice.due_date)}</div>
            </div>` : ''}
            ${invoice.paid_date ? `
            <div class="form-group">
              <label class="form-label">Payée le</label>
              <div class="form-value">${api.formatDate(invoice.paid_date)}</div>
            </div>` : ''}
          </div>
        </div>
        
        <div class="info-section">
          <h3 class="section-title">Client</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nom</label>
              <div class="form-value">${invoice.first_name} ${invoice.last_name}</div>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <div class="form-value">${invoice.email}</div>
            </div>
            ${invoice.company ? `
            <div class="form-group">
              <label class="form-label">Entreprise</label>
              <div class="form-value">${invoice.company}</div>
            </div>` : ''}
          </div>
        </div>
        
        <div class="info-section">
          <h3 class="section-title">Description</h3>
          <div class="form-group">
            <div class="form-value">${invoice.description || 'Aucune description'}</div>
          </div>
        </div>
        
        <div class="info-section">
          <h3 class="section-title">Détails financiers</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Montant HT</label>
              <div class="form-value">${parseFloat(invoice.amount_ht || 0).toFixed(2)}€</div>
            </div>
            <div class="form-group">
              <label class="form-label">TVA (${parseFloat(invoice.tva_rate || 0).toFixed(0)}%)</label>
              <div class="form-value">${parseFloat(invoice.amount_tva || 0).toFixed(2)}€</div>
            </div>
            <div class="form-group">
              <label class="form-label">Total TTC</label>
              <div class="form-value total-value">${parseFloat(invoice.amount_ttc || 0).toFixed(2)}€</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="adminApp.downloadInvoicePDF(${invoice.id}); adminApp.closeModal();">
          Télécharger PDF
        </button>
        <button type="button" class="btn btn-secondary" onclick="adminApp.editInvoice(${invoice.id}); adminApp.closeModal();">
          Modifier
        </button>
        <button type="button" class="btn btn-secondary cancel-btn">Fermer</button>
      </div>
    `);
  }

  showEditInvoiceModal(invoice) {
    this.createModal(`Modifier la facture ${invoice.invoice_number}`, `
      <form id="editInvoiceForm" class="modal-content">
        <div class="info-section">
          <h3 class="section-title">Montants</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="editAmountHt">Montant HT (€) *</label>
              <input type="number" id="editAmountHt" class="form-input" step="0.01" min="0" 
                     value="${parseFloat(invoice.amount_ht || 0).toFixed(2)}" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="editTvaRate">Taux TVA (%)</label>
              <input type="number" id="editTvaRate" class="form-input" step="0.01" min="0" max="100" 
                     value="${parseFloat(invoice.tva_rate || 20).toFixed(2)}">
            </div>
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="editNoTva" ${parseFloat(invoice.tva_rate || 0) === 0 ? 'checked' : ''}>
              <span class="checkbox-text">Pas de TVA</span>
            </label>
          </div>
        </div>
        
        <div class="info-section">
          <h3 class="section-title">Statut et description</h3>
          <div class="form-group">
            <label class="form-label" for="editStatus">Statut</label>
            <select id="editStatus" class="form-select">
              <option value="sent" ${invoice.status === 'sent' ? 'selected' : ''}>Envoyée</option>
              <option value="paid" ${invoice.status === 'paid' ? 'selected' : ''}>Payée</option>
              <option value="overdue" ${invoice.status === 'overdue' ? 'selected' : ''}>En retard</option>
              <option value="cancelled" ${invoice.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editDescription">Description *</label>
            <textarea id="editDescription" class="form-textarea" rows="4" required>${invoice.description || ''}</textarea>
          </div>
        </div>
        
        <div class="info-section">
          <h3 class="section-title">Aperçu des montants</h3>
          <div class="financial-summary">
            <div class="amount-row">
              <span class="amount-label">Montant HT</span>
              <span id="previewHt" class="amount-value">${parseFloat(invoice.amount_ht || 0).toFixed(2)}€</span>
            </div>
            <div class="amount-row">
              <span class="amount-label">TVA (<span id="previewTvaRate">${parseFloat(invoice.tva_rate || 0).toFixed(0)}</span>%)</span>
              <span id="previewTva" class="amount-value">${parseFloat(invoice.amount_tva || 0).toFixed(2)}€</span>
            </div>
            <div class="amount-row total-row">
              <span class="amount-label">Total TTC</span>
              <span id="previewTtc" class="amount-value total">${parseFloat(invoice.amount_ttc || 0).toFixed(2)}€</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    `);

    // Configuration des event listeners après création de la modal
    this.setupInvoiceEditForm(invoice);
  }

  setupInvoiceEditForm(invoice) {
    const form = document.getElementById('editInvoiceForm');
    const amountHt = document.getElementById('editAmountHt');
    const tvaRate = document.getElementById('editTvaRate');
    const noTva = document.getElementById('editNoTva');

    // Fonction pour recalculer les montants
    const updatePreview = () => {
      const ht = parseFloat(amountHt.value) || 0;
      const rate = noTva.checked ? 0 : (parseFloat(tvaRate.value) || 20);
      const tva = Math.round(ht * (rate / 100) * 100) / 100;
      const ttc = Math.round((ht + tva) * 100) / 100;

      document.getElementById('previewHt').textContent = ht.toFixed(2) + '€';
      document.getElementById('previewTvaRate').textContent = rate.toFixed(0);
      document.getElementById('previewTva').textContent = tva.toFixed(2) + '€';
      document.getElementById('previewTtc').textContent = ttc.toFixed(2) + '€';
    };

    // Event listeners pour les changements
    amountHt.addEventListener('input', updatePreview);
    tvaRate.addEventListener('input', updatePreview);
    noTva.addEventListener('change', () => {
      tvaRate.disabled = noTva.checked;
      if (noTva.checked) {
        tvaRate.value = 0;
      } else {
        tvaRate.value = 20;
      }
      updatePreview();
    });

    // Initialiser l'état de la checkbox TVA
    tvaRate.disabled = noTva.checked;

    // Soumission du formulaire
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enregistrement...';

      try {
        console.log('🔄 Tentative de mise à jour de la facture:', invoice.id);
        const updateData = {
          amount_ht: parseFloat(amountHt.value),
          tva_rate: noTva.checked ? 0 : parseFloat(tvaRate.value),
          description: document.getElementById('editDescription').value,
          status: document.getElementById('editStatus').value
        };
        console.log('📝 Données à envoyer:', updateData);
        
        await this.updateInvoice(invoice.id, updateData);
        this.closeModal();
      } catch (error) {
        console.error('❌ Erreur lors de la soumission du formulaire:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  async updateInvoice(id, data) {
    try {
      console.log('📤 Envoi de la requête updateInvoice avec ID:', id, 'et données:', data);
      const response = await api.updateInvoice(id, data);
      console.log('📥 Réponse reçue:', response);
      
      if (response.success) {
        console.log('✅ Mise à jour réussie');
        this.showNotification('Facture mise à jour avec succès', 'success');
        // Recharger la liste des factures
        if (this.currentTab === 'invoices') {
          console.log('🔄 Rechargement de la liste des factures');
          this.loadInvoices();
        }
      } else {
        console.log('⚠️ Réponse non-success:', response);
        this.showNotification('Erreur lors de la mise à jour de la facture', 'error');
      }
    } catch (error) {
      console.error('❌ Erreur dans updateInvoice:', error);
      this.showNotification(error.message || 'Erreur lors de la mise à jour', 'error');
      throw error;
    }
  }

  updateFileDisplay(selectedFiles, selectedFilesSection, selectedFilesList) {
    if (selectedFiles.length === 0) {
      selectedFilesSection.style.display = 'none';
      return;
    }

    selectedFilesSection.style.display = 'block';
    selectedFilesList.innerHTML = selectedFiles.map((file, index) => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 4px 0;">
        <div style="font-size: 16px;">${this.getFileIcon(file.type)}</div>
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 14px;">${file.name}</div>
          <div style="font-size: 12px; color: #666;">${this.formatFileSize(file.size)}</div>
        </div>
        <button type="button" onclick="adminApp.removeFile(${index})" 
                style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 4px; font-size: 16px;">✕</button>
      </div>
    `).join('');
  }

  removeFile(index) {
    // This will be set by the event listener in showTicketDetails
    if (window.currentSelectedFiles) {
      window.currentSelectedFiles.splice(index, 1);
      const selectedFilesSection = document.getElementById('selectedFilesSection');
      const selectedFilesList = document.getElementById('selectedFilesList');
      this.updateFileDisplay(window.currentSelectedFiles, selectedFilesSection, selectedFilesList);
    }
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
    return '📁';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  renderAttachments(attachments, isFromClient) {
    if (!attachments || attachments.length === 0) {
      return '';
    }

    return `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isFromClient ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};">
        ${attachments.map(attachment => {
          const isImage = attachment.mime_type && attachment.mime_type.startsWith('image/');
          const fileIcon = isImage ? '🖼️' : '📎';
          const fileSize = this.formatFileSize(attachment.file_size);
          
          return `
            <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0; padding: 6px 8px; background: ${isFromClient ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}; border-radius: 4px; font-size: 12px;">
              <span>${fileIcon}</span>
              <a href="javascript:void(0)" 
                 onclick="window.adminApp.downloadAttachment(${attachment.id})"
                 style="color: ${isFromClient ? '#93c5fd' : '#bfdbfe'}; text-decoration: none; font-weight: 500; cursor: pointer;"
                 onmouseover="this.style.textDecoration='underline'"
                 onmouseout="this.style.textDecoration='none'">
                ${attachment.original_filename}
              </a>
              <span style="color: ${isFromClient ? '#9ca3af' : '#d1d5db'};">(${fileSize})</span>
            </div>
          `;
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

    const url = `/api/attachments/download/${attachmentId}`;
    
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
    
    // Afficher le temps restant même si pas dépassé
    let color = '#10b981'; // Vert par défaut
    if (slaInfo.remaining < 2 * 60 * 60 * 1000) { // Moins de 2h
      color = '#dc2626'; // Rouge
    } else if (slaInfo.remaining < 8 * 60 * 60 * 1000) { // Moins de 8h
      color = '#f59e0b'; // Orange
    }
    
    return `<span style="color: ${color}; font-weight: 500;">⏱️ Reste ${slaInfo.hours}h${slaInfo.minutes > 0 ? ` ${slaInfo.minutes}min` : ''}</span>`;
  }

  hasValidFile(fileContent) {
    // Vérifier si le contenu est un fichier valide (JSON avec métadonnées)
    if (!fileContent || fileContent.trim() === '') {
      return false;
    }

    try {
      const parsed = JSON.parse(fileContent);
      // Vérifier que c'est bien un fichier avec les bonnes propriétés
      return parsed.name && parsed.type && parsed.data && parsed.data.startsWith('data:');
    } catch {
      // Si ce n'est pas du JSON valide, vérifier si c'est du texte non vide
      return fileContent.length > 10; // Au moins 10 caractères pour être considéré comme valide
    }
  }

  downloadConfidentialFile(encodedData) {
    try {
      const jsonData = decodeURIComponent(encodedData);
      const fileData = JSON.parse(jsonData);

      // Cr\u00e9er un lien de t\u00e9l\u00e9chargement
      const link = document.createElement('a');
      link.href = fileData.data;
      link.download = fileData.name || 'document';

      // D\u00e9clencher le t\u00e9l\u00e9chargement
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erreur lors du t\u00e9l\u00e9chargement:', error);
      this.showNotification('Erreur lors du t\u00e9l\u00e9chargement du fichier', 'error');
    }
  }

  downloadQuoteFile(encodedData) {
    try {
      const jsonData = decodeURIComponent(encodedData);
      const fileData = JSON.parse(jsonData);

      // Cr\u00e9er un lien de t\u00e9l\u00e9chargement
      const link = document.createElement('a');
      link.href = fileData.data;
      link.download = fileData.name || 'devis';

      // D\u00e9clencher le t\u00e9l\u00e9chargement
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erreur lors du t\u00e9l\u00e9chargement:', error);
      this.showNotification('Erreur lors du t\u00e9l\u00e9chargement du devis', 'error');
    }
  }

  sortTicketsForAdmin(tickets) {
    return tickets.sort((a, b) => {
      // 1. Priorité par statut
      const statusPriority = {
        'open': 1,
        'in_progress': 2,
        'waiting_client': 3,
        'resolved': 4,
        'closed': 5
      };

      const statusA = statusPriority[a.status] || 999;
      const statusB = statusPriority[b.status] || 999;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      // 2. Pour les tickets "en cours", trier par SLA (plus serré en premier)
      if (a.status === 'in_progress' && b.status === 'in_progress') {
        const slaA = this.calculateSLATimeRemaining(a);
        const slaB = this.calculateSLATimeRemaining(b);

        // Si l'un des deux n'a pas de SLA, le mettre à la fin
        if (!slaA && !slaB) return 0;
        if (!slaA) return 1;
        if (!slaB) return -1;

        // Trier par temps restant (moins de temps = plus urgent)
        if (slaA.remaining !== slaB.remaining) {
          return slaA.remaining - slaB.remaining;
        }
      }

      // 3. Tri secondaire par date de création (plus récent en premier)
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
  }
}

// Initialize admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});
