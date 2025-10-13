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

      // Handle access by role: admins/team get full UI; developers get Kanban-only within admin UI
      if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'team' && this.currentUser.role !== 'developer') {
        alert('Accès non autorisé');
        window.location.href = '/connexion.html';
        return;
      }

      this.showMainApp();

      // Configure restricted UI for developers (centralized Kanban experience)
      if (this.currentUser.role === 'developer') {
        try {
          await this.setupDeveloperUI();
        } catch (e) {
          console.error('Erreur configuration UI développeur:', e);
        }
      }
    } catch (error) {
      console.error('Profile load error:', error);
      // Token invalide, rediriger vers la connexion
      localStorage.removeItem('token');
      window.location.href = '/connexion.html';
    }
  }

  async setupDeveloperUI() {
    // Hide non-project tabs in the sidebar
    const allowedTab = 'projects';
    document.querySelectorAll('nav.sidebar__nav [data-tab]')
      .forEach(el => { if (el.dataset.tab !== allowedTab) el.style.display = 'none'; });

    // Hide tab contents except projects and kanban container
    const hideIds = ['dashboard', 'tickets', 'clients', 'invoices'];
    hideIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const projectsTab = document.getElementById('projects');
    if (projectsTab) projectsTab.style.display = 'block';

    // Update header title
    const titleEl = document.querySelector('.main-title');
    if (titleEl) titleEl.textContent = 'Gestion des projets';

    // Load developer-accessible projects from dev API
    try {
      const resp = await fetch('/api/dev/projects', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (resp.ok) {
        const data = await resp.json();
        this.projects = data.data || [];
      } else {
        this.projects = [];
      }
    } catch (e) {
      console.warn('Load dev projects failed:', e);
      this.projects = [];
    }

    // Build developer projects sidebar shortcuts
    this.setupDeveloperProjectSidebar();

    // If only one project assigned, go straight to its Kanban; otherwise show the projects list
    const assigned = this.projects || [];
    if (assigned.length === 1) {
      await this.viewProject(assigned[0].id);
      return;
    }

    // Multiple (or zero) projects: land on projects table filtered to developer's projects
    // Ensure Projects tab is active and content is rendered
    this.switchTab('projects');
  }

  setupDeveloperProjectSidebar() {
    try {
      const section = document.getElementById('devSidebarSection');
      const list = document.getElementById('devProjectList');
      const toggle = document.getElementById('devSidebarToggle');
      const projectsLink = document.querySelector('nav.sidebar__nav [data-tab="projects"]');
      if (!section || !list) return;

      // Show section for developers
      section.style.display = 'block';
      // Hide the collapsible header; developer sees fixed links only
      if (toggle) toggle.style.display = 'none';

      const projects = Array.isArray(this.projects) ? this.projects : [];
      if (!projects.length) {
        list.innerHTML = '<div style="color:#6b7280; padding:6px 0;">Aucun projet</div>';
        return;
      }

      // Ensure the list is visible for developers and positioned directly under "Projets"
      list.style.display = 'block';
      list.style.marginLeft = '0';
      list.classList.remove('sidebar__submenu');
      if (projectsLink && projectsLink.parentNode) {
        projectsLink.insertAdjacentElement('afterend', list);
      }

      list.innerHTML = projects.map(p => `
        <a href="#" class="sidebar__nav-item sidebar__dev-project" data-project-id="${p.id}">
          <span class="sidebar__nav-text">${p.name}</span>
        </a>
      `).join('');

      list.querySelectorAll('.sidebar__dev-project').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const pid = parseInt(a.getAttribute('data-project-id'), 10);
          if (!Number.isFinite(pid)) return;
          // Ensure we have the project list (already in this.projects)
          await this.viewProject(pid);
        });
      });
    } catch (err) {
      console.warn('Dev sidebar setup failed:', err);
    }
  }

  showMainApp() {
    // App is now visible by default with sidebar structure
    document.getElementById('currentUser').textContent = 
      `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    // Update avatar initial
    const avatarEl = document.getElementById('sidebarUserAvatar');
    if (avatarEl) {
      const initial = (this.currentUser.first_name || this.currentUser.email || 'U').charAt(0).toUpperCase();
      avatarEl.textContent = initial;
    }
    // Update role label (keep admin UI French outside Kanban)
    const roleEl = document.querySelector('.sidebar__user-role');
    if (roleEl) {
      const roleLabels = { admin: 'Administrateur', team: 'Équipe', developer: 'Développeur', client: 'Client' };
      roleEl.textContent = roleLabels[this.currentUser.role] || this.currentUser.role;
    }

    // For developers, switch role + logout label to English
    if (this.currentUser.role === 'developer') {
      if (roleEl) roleEl.textContent = 'Developer';
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        const span = logoutBtn.querySelector('span');
        if (span) span.textContent = 'Log out';
      }
    }
    
    // Afficher le lien Kanban Dev pour admins et développeurs
    const devKanbanLink = document.getElementById('devKanbanLink');
    if (devKanbanLink && (this.currentUser.role === 'admin' || this.currentUser.role === 'developer')) {
      devKanbanLink.style.display = 'block';
    } else if (devKanbanLink) {
      devKanbanLink.style.display = 'none';
    }
    
    // Afficher l'onglet Developers pour les admins uniquement
    const devTabLink = document.getElementById('developersTabLink');
    if (devTabLink) {
      if (this.currentUser.role === 'admin') devTabLink.style.display = 'block';
      else devTabLink.style.display = 'none';
    }

    // Set initial title based on current tab
    this.updateTitle();

    // Dev sidebar section for admins: list active projects
    if (this.currentUser.role === 'admin') {
      this.setupAdminDevSidebar();
    } else {
      const devSection = document.getElementById('devSidebarSection');
      if (devSection) devSection.style.display = 'none';
    }
  }

  async setupAdminDevSidebar() {
    const section = document.getElementById('devSidebarSection');
    const list = document.getElementById('devProjectList');
    if (!section || !list) return;
    section.style.display = 'block';
    list.innerHTML = '<div class="loading" style="padding:6px 0;">Loading…</div>';
    try {
      const res = await api.getProjects({ status: 'active' });
      const projects = (res?.data?.projects || []).filter(p => p.status === 'active');
      if (!projects.length) {
        list.innerHTML = '<div style="color:#6b7280; padding:6px 0;">No active projects</div>';
        return;
      }
      list.innerHTML = projects.map(p => `
        <a href="#" class="sidebar__nav-item sidebar__dev-project" data-project-id="${p.id}">
          <span class="sidebar__nav-text">${p.name}</span>
        </a>
      `).join('');
      list.querySelectorAll('.sidebar__dev-project').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const pid = parseInt(a.getAttribute('data-project-id'), 10);
          if (!Number.isFinite(pid)) return;
          // Ensure project cache and open Kanban
          try {
            if (!this.projects || !this.projects.length) {
              const res2 = await api.getProjects();
              this.projects = res2?.data?.projects || [];
            }
          } catch (e2) { this.projects = this.projects || []; }
          await this.viewProject(pid);
        });
      });
    } catch (err) {
      list.innerHTML = '<div style="color:#b91c1c; padding:6px 0;">Failed to load projects</div>';
    }
  }

  updateTitle() {
    // Title mapping for each tab
    const tabTitles = {
      'dashboard': 'Tableau de bord',
      'tickets': 'Gestion des tickets',
      'projects': 'Gestion des projets',
      'developers': 'Gestion des développeurs',
      'clients': 'Gestion des clients',
      'invoices': 'Facturation'
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
            <option value="waiting_client">En attente client</option>
            <option value="resolved">Résolu</option>
          </select>
          <select id="priorityFilter" class="filter-select">
            <option value="">Toutes les priorités</option>
            <option value="urgent">Urgente</option>
            <option value="high">Élevée</option>
            <option value="normal">Moyenne</option>
            <option value="low">Faible</option>
          </select>
          <button id="newTicketBtn" class="btn btn-primary">+ Nouveau ticket</button>
        </div>
      `,
      'projects': `
        <button id="addProjectBtn" class="btn btn-primary">+ Nouveau projet</button>
      `,
      'developers': `
        <button id="addDeveloperBtn" class="btn btn-primary">+ Nouveau développeur</button>
      `,
      'clients': `
        <button id="addClientBtn" class="btn btn-primary">+ Nouveau client</button>
      `,
      'invoices': `
        <div class="header-filters">
          <select id="invoiceStatusFilter" class="filter-select">
            <option value="">Tous les statuts</option>
            <option value="sent">Envoyée</option>
            <option value="paid">Payée</option>
            <option value="overdue">En retard</option>
          </select>
          <button id="newInvoiceBtn" class="btn btn-primary">+ Nouvelle facture</button>
        </div>
      `,
      'project-kanban': `
        <button id="createTaskBtn" class="btn btn-primary">+ New Task</button>
      `
    };

    // Add actions for current tab
    if (tabActions[this.currentTab]) {
      headerActions.innerHTML = tabActions[this.currentTab];
      
      // Re-bind event listeners for the new elements
      this.bindHeaderActionEvents();

      // Restrict actions for developer role (no project/invoice/ticket creation buttons)
      if (this.currentUser && this.currentUser.role === 'developer') {
        headerActions.querySelector('#addProjectBtn')?.remove();
        headerActions.querySelector('#newInvoiceBtn')?.remove();
        headerActions.querySelector('#addDeveloperBtn')?.remove();
        headerActions.querySelector('#newTicketBtn')?.remove();
      }
    }
  }

  bindHeaderActionEvents() {
    // Rebind events for moved elements
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const addProjectBtn = document.getElementById('addProjectBtn');
    const addDeveloperBtn = document.getElementById('addDeveloperBtn');
    const addClientBtn = document.getElementById('addClientBtn');
    const newInvoiceBtn = document.getElementById('newInvoiceBtn');
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    const newTicketBtn = document.getElementById('newTicketBtn');
    const developersTabLink = document.querySelector('[data-tab="developers"]');

    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.loadTickets());
    }
    if (priorityFilter) {
      priorityFilter.addEventListener('change', () => this.loadTickets());
    }
    if (addProjectBtn) {
      addProjectBtn.addEventListener('click', () => this.showAddProjectModal());
    }
    if (addDeveloperBtn) {
      addDeveloperBtn.addEventListener('click', () => this.showAddDeveloperModal());
    }
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => this.showAddClientModal());
    }
    if (newInvoiceBtn) {
      newInvoiceBtn.addEventListener('click', () => this.showNewInvoiceModal());
    }
    if (newTicketBtn) {
      newTicketBtn.addEventListener('click', () => this.showAddTicketModal());
    }
    if (invoiceStatusFilter) {
      invoiceStatusFilter.addEventListener('change', () => this.loadInvoices());
    }
    if (developersTabLink) {
      developersTabLink.addEventListener('click', (e) => {
        this.switchTab('developers');
        this.loadDevelopers();
      });
    }
  }

  // === DEVELOPERS MANAGEMENT ===
  async loadDevelopers() {
    const container = document.getElementById('developersList');
    if (!container) return;
    container.innerHTML = '<div class="loading">Chargement des développeurs...</div>';
    try {
      const resp = await fetch('/api/dev/developers', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!resp.ok) throw new Error('load_failed');
      const data = await resp.json();
      const devs = data.data || [];
      this.renderDevelopersTable(devs);
    } catch (e) {
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des développeurs</div>';
    }
  }

  renderDevelopersTable(developers) {
    const container = document.getElementById('developersList');
    if (!container) return;
    if (!developers || developers.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👨‍💻</div><p>Aucun développeur</p></div>';
      return;
    }
    const table = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Actif</th>
            <th>Projets</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${developers.map(d => {
            const fullName = `${d.first_name || ''} ${d.last_name || ''}`.trim();
            const projects = d.assigned_projects || '';
            const ids = (d.assigned_project_ids || '')
              .split(',')
              .map(s => parseInt(s, 10))
              .filter(n => Number.isFinite(n));
            return `
              <tr data-dev-id="${d.id}" data-project-ids="${ids.join(',')}">
                <td>${fullName || '-'}</td>
                <td>${d.email}</td>
                <td>${d.is_active ? 'Oui' : 'Non'}</td>
                <td>${projects || '-'}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-action btn-edit" data-action="edit-dev" data-id="${d.id}">Éditer</button>
                    <button class="btn-action btn-secondary" data-action="assign-dev" data-id="${d.id}">Assigner projets</button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = table;
    container.querySelectorAll('[data-action="edit-dev"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditDeveloperModal(parseInt(btn.dataset.id, 10)));
    });
    container.querySelectorAll('[data-action="assign-dev"]').forEach(btn => {
      btn.addEventListener('click', () => this.showAssignDeveloperModal(parseInt(btn.dataset.id, 10)));
    });
  }

  async showAddDeveloperModal() {
    const modal = this.createModal('Nouveau développeur', `
      <form id="devForm" class="form">
        <div class="form-group">
          <label class="form-label">Prénom</label>
          <input type="text" name="first_name" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Nom</label>
          <input type="text" name="last_name" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" name="email" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <input type="password" name="password" class="form-input" minlength="6" required>
        </div>
        <div class="form-group">
          <label class="form-label">Actif</label>
          <select name="is_active" class="form-input">
            <option value="1" selected>Oui</option>
            <option value="0">Non</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer</button>
        </div>
      </form>
    `);
    const form = document.getElementById('devForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        first_name: fd.get('first_name'),
        last_name: fd.get('last_name'),
        email: fd.get('email'),
        password: fd.get('password'),
        role: 'developer',
        is_active: fd.get('is_active') === '1'
      };
      try {
        await api.createUser(payload);
        this.closeModal();
        await this.loadDevelopers();
        this.showNotification('Développeur créé', 'success');
      } catch (err) {
        this.showNotification(err.message || 'Erreur création développeur', 'error');
      }
    });
  }

  async showEditDeveloperModal(devId) {
    try {
      const res = await api.getUser(devId);
      const user = res.data.user;
      const modal = this.createModal('Éditer développeur', `
        <form id="devEditForm" class="form">
          <input type="hidden" name="id" value="${user.id}">
          <div class="form-group">
            <label class="form-label">Prénom</label>
            <input type="text" name="first_name" class="form-input" value="${user.first_name || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nom</label>
            <input type="text" name="last_name" class="form-input" value="${user.last_name || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input" value="${user.email}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nouveau mot de passe (optionnel)</label>
            <input type="password" name="password" class="form-input" minlength="6" placeholder="Laisser vide pour ne pas changer">
          </div>
          <div class="form-group">
            <label class="form-label">Actif</label>
            <select name="is_active" class="form-input">
              <option value="1" ${user.is_active ? 'selected' : ''}>Oui</option>
              <option value="0" ${!user.is_active ? 'selected' : ''}>Non</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      `);

      // Bind edit-client button (CSP-safe)
      const modalEl = document.getElementById('modal');
      if (modalEl) {
        const editBtn = modalEl.querySelector('[data-action="edit-client"]');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            const cid = parseInt(e.currentTarget.dataset.clientId);
            this.editClient(cid);
            this.closeModal();
          });
        }
      }
      const form = document.getElementById('devEditForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const update = {
          first_name: fd.get('first_name'),
          last_name: fd.get('last_name'),
          email: fd.get('email'),
          is_active: fd.get('is_active') === '1',
          role: 'developer'
        };
        if (fd.get('password')) update.password = fd.get('password');
        try {
          await api.updateUser(user.id, update);
          this.closeModal();
          await this.loadDevelopers();
          this.showNotification('Développeur mis à jour', 'success');
        } catch (err) {
          this.showNotification(err.message || 'Erreur mise à jour', 'error');
        }
      });
    } catch (err) {
      this.showNotification('Échec chargement développeur', 'error');
    }
  }

  async showAssignDeveloperModal(devId) {
    try {
      // Get all projects
      const projectsResp = await api.getProjects();
      const allProjects = projectsResp.data.projects || [];
      // Get current assigned IDs from the row dataset
      const row = document.querySelector(`#developersList tr[data-dev-id="${devId}"]`);
      const assignedIds = (row?.dataset.projectIds || '')
        .split(',')
        .map(s => parseInt(s, 10))
        .filter(n => Number.isFinite(n));

      const modal = this.createModal('Assigner projets', `
        <div style="max-height:60vh; overflow:auto;">
          <form id="assignForm">
            ${allProjects.map(p => `
              <label style="display:flex; align-items:center; gap:8px; padding:6px 0;">
                <input type="checkbox" name="project_${p.id}" ${assignedIds.includes(p.id) ? 'checked' : ''}>
                <span>${p.name}</span>
              </label>
            `).join('')}
          </form>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary cancel-btn">Annuler</button>
          <button id="saveAssignBtn" class="btn btn-primary">Enregistrer</button>
        </div>
      `);
      const saveBtn = document.getElementById('saveAssignBtn');
      saveBtn.addEventListener('click', async () => {
        const form = document.getElementById('assignForm');
        const selected = allProjects.filter(p => form.querySelector(`[name="project_${p.id}"]`)?.checked).map(p => p.id);
        const toAdd = selected.filter(id => !assignedIds.includes(id));
        const toRemove = assignedIds.filter(id => !selected.includes(id));
        try {
          // Apply changes sequentially to keep it simple
          for (const pid of toAdd) {
            await fetch(`/api/dev/projects/${pid}/developers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ user_id: devId })
            });
          }
          for (const pid of toRemove) {
            await fetch(`/api/dev/projects/${pid}/developers/${devId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
          }
          this.closeModal();
          await this.loadDevelopers();
          this.showNotification('Assignations mises à jour', 'success');
        } catch (err) {
          this.showNotification('Erreur lors de la mise à jour des assignations', 'error');
        }
      });
    } catch (err) {
      this.showNotification('Échec chargement projets', 'error');
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
        if (tab.id === 'devKanbanLink') return;
        // Toggle Dev submenu (admin only)
        if (tab.id === 'devSidebarToggle') {
          e.preventDefault();
          const list = document.getElementById('devProjectList');
          if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
          return;
        }
        
        const tabName = tab.dataset?.tab;
        if (!tabName) return;
        e.preventDefault();
        this.switchTab(tabName);
      });
    });

    // Boutons d'actualisation supprimés (tickets et facturation)

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
    // Leaving Kanban view: just clear currentProject; rely on classes for visibility
    if (this.currentTab === 'project-kanban') {
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
      // Clear any inline display overrides
      content.style.display = '';
    });
    const target = document.getElementById(tabName);
    if (target) {
      target.classList.add('active');
      target.style.display = '';
    }

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
      case 'developers':
        this.loadDevelopers();
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
      // Par défaut, ne pas afficher les tickets résolus
      if (!statusFilter) filters.exclude_status = 'resolved';

      const response = await api.getTickets(filters);
      
      if (response.data && response.data.tickets) {
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
      <table class="data-table tickets-table">
        <thead>
          <tr>
            <th>Titre</th>
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
              <td style="white-space: normal;">${ticket.title}</td>
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
    container.innerHTML = '<div class="loading">Loading projects...</div>';

    try {
      if (this.currentUser && this.currentUser.role === 'developer') {
        // Developers: only their assigned projects via dev API
        const resp = await fetch('/api/dev/projects', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (!resp.ok) throw new Error('load_failed');
        const data = await resp.json();
        this.projects = data.data || [];
        this.renderProjectsTable(this.projects);
      } else {
        const response = await api.getProjects();
        this.projects = response.data.projects; // Stocker les projets pour utilisation dans viewProject
        this.renderProjectsTable(response.data.projects);
      }
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Error while loading projects</div>';
    }
  }

  renderProjectsTable(projects) {
    const container = document.getElementById('projectsList');
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>No projects found</p></div>';
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
              <td>${project.client_company || (((project.client_first_name || '') + ' ' + (project.client_last_name || '')).trim()) || '-'}</td>
              <td><span class="status-badge status-${project.status}">${project.status}</span></td>
              <td>${('ticket_count' in project ? (project.ticket_count || 0) : 0)} (${project.active_ticket_count || 0} actifs)</td>
              <td>${project.created_at ? api.formatDate(project.created_at) : '-'}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-project-id="${project.id}" data-action="view-project"> Voir</button>
                  ${this.currentUser && this.currentUser.role === 'developer' ? '' : `<button class="btn-action btn-edit" data-project-id="${project.id}" data-action="edit-project"> Éditer</button>`}
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
              <td>
                <div class="action-buttons">
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
    const editClientButtons = document.querySelectorAll('[data-action="edit-client"]');
    
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
      // Charger les membres du projet pour mentions (admin + devs du projet)
      let mentionMembers = [];
      try {
        const mres = await api.getProjectMembers(ticket.project_id);
        mentionMembers = mres.data || [];
      } catch (e) { /* silent */ }
      const emailToName = {};
      mentionMembers.forEach(u => { emailToName[(u.email||'').toLowerCase()] = `${u.first_name||''} ${u.last_name||''}`.trim() || u.email; });
      const highlightMentions = (text) => {
        const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return escaped.replace(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, email)=>{
          const key = (email||'').toLowerCase();
          const name = emailToName[key] || email;
          return `<span style=\"color:#C9A33A; font-weight:700;\">${name}</span>`;
        }).replace(/\n/g,'<br>');
      };
      
      // Charger les pièces jointes pour chaque commentaire
      for (let comment of comments) {
        try {
          const attachmentsResponse = await api.getCommentAttachments(comment.id);
          comment.attachments = attachmentsResponse.success ? attachmentsResponse.data.attachments : [];
        } catch (error) {
          /* silent */
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
                <span class="meta-label">Priorité:</span>
                <span class="priority-badge priority-${ticket.priority}">${this.getPriorityLabelFR(ticket.priority)}</span>
              </div>
              <!-- Sélecteur de statut déplacé ici, à la place de l'assignation -->
              <div class="meta-row">
                <span class="meta-label">Statut:</span>
                <div class="meta-value" style="display:flex; gap:8px; align-items:center;">
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
          
          <!-- Attachments -->
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
          
          <!-- Tâches liées (Kanban) -->
          <div class="ticket-linked-tasks" style="margin: 16px 0;">
            <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">Tâches liées</h4>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
              <div id="ticketTaskSearchWrap" style="position:relative; flex:1;">
                <input type="text" id="ticketTaskSearch" placeholder="Rechercher une tâche du projet..." style="width:100%;" />
                <div id="ticketTaskSuggestions" style="position:absolute; left:0; right:0; top: calc(100% + 4px); z-index:10000;"></div>
              </div>
              <button class="btn btn-secondary" id="ticketTaskLinkBtn">Lier</button>
            </div>
            <div id="ticketLinkedTasks" style="border:1px solid #e5e7eb; border-radius:6px; padding:8px; min-height:40px;">
              <div style="color:#6b7280;">Chargement…</div>
            </div>
          </div>

          <!-- Conversation avec le client -->
          <div class="ticket-comments" style="margin-bottom: 20px;">
            <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">Conversation avec le client</h4>
            
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
                        <div style="line-height: 1.4; font-size: 14px;">${highlightMentions(comment.content || '')}</div>
                        ${this.renderAttachments(comment.attachments, isFromClient)}
                        ${comment.is_internal ? '<div style="margin-top: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px;">Message interne</div>' : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
            
            <!-- Ajouter un commentaire (mentions désactivées dans les tickets) -->
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
            <button type="button" class="btn btn-secondary cancel-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer;">
                    Annuler
                  </button>
                  <button type="submit" id="submitCommentBtn" style="background: #0e2433; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;">
                    Envoyer le commentaire
                  </button>
                </div>
              </form>
            </div>
          </div>
          
        </div>
      `, 'large');
      
      // Gérer l'ajout de commentaire
      const ticketId = id; // Sauvegarder l'ID du ticket pour le closure
      
      // Charger et gérer les tâches liées
      const linkedTasksBox = document.getElementById('ticketLinkedTasks');
      const taskSearchInput = document.getElementById('ticketTaskSearch');
      const taskLinkBtn = document.getElementById('ticketTaskLinkBtn');
      let linkedTaskIds = new Set();
      // Autocomplete container for task search
      let taskSuggestIndex = -1; // keyboard selection index
      let taskSuggestItems = [];
      let taskSuggestOpen = false;
      let taskSuggestionsEl = document.getElementById('ticketTaskSuggestions');
      if (!taskSuggestionsEl) {
        const wrap = document.getElementById('ticketTaskSearchWrap');
        taskSuggestionsEl = document.createElement('div');
        taskSuggestionsEl.id = 'ticketTaskSuggestions';
        taskSuggestionsEl.style.position = 'absolute';
        taskSuggestionsEl.style.left = '0';
        taskSuggestionsEl.style.right = '0';
        taskSuggestionsEl.style.top = 'calc(100% + 4px)';
        taskSuggestionsEl.style.zIndex = '10000';
        if (wrap) wrap.appendChild(taskSuggestionsEl);
        else if (taskSearchInput) taskSearchInput.insertAdjacentElement('afterend', taskSuggestionsEl);
      }
      const loadLinkedTasks = async () => {
        try {
          const r = await api.getTicketLinkedTasks(ticketId);
          const tasks = r.data || [];
          // Maintenir la liste des IDs de tâches déjà liées pour exclusion dans l'autocomplete
          linkedTaskIds = new Set(tasks.map(t => t.id));
          if (!tasks.length) { linkedTasksBox.innerHTML = '<div style="color:#6b7280;">Aucune tâche liée</div>'; return; }
          linkedTasksBox.innerHTML = tasks.map(t => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee;">
              <div>
                <div style="font-weight:600;">#${t.id} — ${t.title}</div>
                <div style="font-size:12px; color:#6b7280;">${this.getTaskStatusLabel(t.status)} · ${this.getPriorityLabelFR(t.urgency || 'medium')}</div>
              </div>
              <button class="btn btn-secondary" data-action="unlink-task" data-id="${t.id}">Délier</button>
            </div>
          `).join('');
          linkedTasksBox.querySelectorAll('[data-action="unlink-task"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const taskId = parseInt(e.currentTarget.dataset.id, 10);
          try {
            await api.unlinkTaskFromTicket(ticketId, taskId);
            await loadLinkedTasks();
            // Si le kanban du même projet est ouvert, recharger les tâches pour sync immédiate
            if (this.currentTab === 'project-kanban' && this.currentProject?.id === ticket.project_id) {
              await this.loadProjectTasks(ticket.project_id);
            }
            this.showNotification('Tâche déliée', 'success');
          }
          catch { this.showNotification('Échec de la dissociation', 'error'); }
            });
          });
        } catch { linkedTasksBox.innerHTML = '<div style="color:#b91c1c;">Erreur chargement des tâches liées</div>'; }
      };
      await loadLinkedTasks();

      let projectTasksCache = [];
      const ensureProjectTasks = async () => {
        if (projectTasksCache.length) return projectTasksCache;
        try {
          // Récupérer les tâches du projet du ticket
          const projectId = ticket.project_id;
          const res = await fetch(`/api/dev/projects/${projectId}/tasks`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
          const data = await res.json();
          // Exclure les tâches terminées (done) et normaliser
          projectTasksCache = (data.data || [])
            .filter(Boolean)
            .filter(t => t && t.status !== 'done');
          return projectTasksCache;
        } catch { return []; }
      };
      const normalize = (s) => (s || '').toString().toLowerCase().trim();
      const scoreTask = (task, q) => {
        if (!q) return 0;
        const title = normalize(task.title);
        const idStr = String(task.id);
        const qLower = q.toLowerCase();
        let score = 0;
        if (idStr === qLower) score += 100;               // ID exact
        if (idStr.startsWith(qLower)) score += 80;         // ID commence par
        if (title === qLower) score += 70;                 // Titre exact
        if (title.startsWith(qLower)) score += 60;         // Titre commence par
        if (title.includes(qLower)) score += 30;           // Titre contient
        // Bonus sur statut/urgence
        const status = normalize(task.status);
        const urg = normalize(task.urgency || task.priority);
        if (status.includes(qLower)) score += 10;
        if (urg.includes(qLower)) score += 5;
        return score;
      };
      const filterTasks = async (q) => {
        const all = (await ensureProjectTasks())
          // Exclure les tâches déjà liées
          .filter(t => !linkedTaskIds.has(t.id));
        if (!q) return all; // sans limite, tout proposé (hors done et hors liées)
        const results = all
          .map(t => ({ t, s: scoreTask(t, q) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map(x => x.t);
        return results;
      };
      const renderSuggestions = (tasks, query) => {
        if (!taskSuggestionsEl) return;
        if (!tasks || tasks.length === 0) {
          taskSuggestionsEl.innerHTML = '';
          taskSuggestItems = [];
          taskSuggestOpen = false;
          taskSuggestIndex = -1;
          return;
        }
        const listHtml = `
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; width: 100%; max-height: 224px; overflow-y: auto; box-shadow: 0 8px 16px rgba(0,0,0,0.08);">
            ${tasks.map((t, idx) => `
              <div class="task-suggest-item" data-id="${t.id}" data-index="${idx}"
                style="padding: 8px 10px; display:flex; justify-content:space-between; align-items:center; cursor: pointer;">
                <div>
                  <div style="font-weight:600;">#${t.id} — ${t.title}</div>
                  <div style="font-size:12px; color:#6b7280;">${this.getTaskStatusLabel(t.status)} · ${this.getPriorityLabelFR(t.urgency || 'medium')}</div>
                </div>
                <div style="font-size:12px; color:#9ca3af;">${normalize(t.status)}</div>
              </div>
            `).join('')}
          </div>`;
        taskSuggestionsEl.innerHTML = listHtml;
        taskSuggestItems = Array.from(taskSuggestionsEl.querySelectorAll('.task-suggest-item'));
        taskSuggestOpen = true;
        taskSuggestIndex = -1;
        // Hover/active style
        taskSuggestItems.forEach(el => {
          el.addEventListener('mouseenter', () => {
            taskSuggestItems.forEach(i => i.style.background='white');
            el.style.background = '#f3f4f6';
          });
          el.addEventListener('mouseleave', () => {
            el.style.background = 'white';
          });
          el.addEventListener('mousedown', async (e) => {
            e.preventDefault();
            const taskId = parseInt(el.dataset.id, 10);
            await linkTask(taskId);
          });
        });
      };
      const closeSuggestions = () => {
        if (taskSuggestionsEl) taskSuggestionsEl.innerHTML = '';
        taskSuggestOpen = false;
        taskSuggestIndex = -1;
        taskSuggestItems = [];
      };
      const highlightIndex = (idx) => {
        if (!taskSuggestOpen || !taskSuggestItems.length) return;
        taskSuggestItems.forEach(i => i.style.background='white');
        const el = taskSuggestItems[idx];
        if (el) el.style.background = '#e5e7eb';
      };
      const linkTask = async (taskId) => {
        try {
          await api.linkTaskToTicket(ticketId, taskId);
          await loadLinkedTasks();
          if (this.currentTab === 'project-kanban' && this.currentProject?.id === ticket.project_id) {
            await this.loadProjectTasks(ticket.project_id);
          }
          this.showNotification('Tâche liée', 'success');
          closeSuggestions();
          if (taskSearchInput) taskSearchInput.value = '';
        } catch {
          this.showNotification('Échec liaison tâche', 'error');
        }
      };
      const pickTaskBySearch = async (q) => {
        const results = await filterTasks(q);
        return results[0] ? results[0].id : null;
      };
      // Live suggestions on input
      if (taskSearchInput) {
        // Prefetch tasks so first focus can show suggestions instantly
        ensureProjectTasks().then(() => {}).catch(() => {});
        taskSearchInput.addEventListener('input', async (e) => {
          const q = e.target.value.trim();
          const results = await filterTasks(q);
          renderSuggestions(results, q);
        });
        taskSearchInput.addEventListener('keydown', async (e) => {
          if (!taskSuggestOpen) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            taskSuggestIndex = (taskSuggestIndex + 1) % taskSuggestItems.length;
            highlightIndex(taskSuggestIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            taskSuggestIndex = (taskSuggestIndex - 1 + taskSuggestItems.length) % taskSuggestItems.length;
            highlightIndex(taskSuggestIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (taskSuggestIndex >= 0 && taskSuggestItems[taskSuggestIndex]) {
              const taskId = parseInt(taskSuggestItems[taskSuggestIndex].dataset.id, 10);
              await linkTask(taskId);
            } else {
              const q = e.target.value.trim();
              const id = await pickTaskBySearch(q);
              if (id) await linkTask(id);
            }
          } else if (e.key === 'Escape') {
            closeSuggestions();
          }
        });
        // Close suggestions on outside click
        document.addEventListener('click', (evt) => {
          const wrap = document.getElementById('ticketTaskSearchWrap');
          const within = (wrap && wrap.contains(evt.target)) || taskSuggestionsEl.contains(evt.target);
          if (!within) closeSuggestions();
        });
        // Show initial suggestions on focus
        taskSearchInput.addEventListener('focus', async () => {
          const results = await filterTasks('');
          renderSuggestions(results, '');
        });
      }
      if (taskLinkBtn && taskSearchInput) {
        taskLinkBtn.addEventListener('click', async () => {
          const q = taskSearchInput.value.trim();
          if (!q) { this.showNotification('Entrez un terme de recherche ou un ID', 'warning'); return; }
          const taskId = await pickTaskBySearch(q);
          if (!taskId) { this.showNotification('Aucune tâche correspondante', 'warning'); return; }
          try {
            await api.linkTaskToTicket(ticketId, taskId);
            await loadLinkedTasks();
            if (this.currentTab === 'project-kanban' && this.currentProject?.id === ticket.project_id) {
              await this.loadProjectTasks(ticket.project_id);
            }
            this.showNotification('Tâche liée', 'success');
          }
          catch { this.showNotification('Échec liaison tâche', 'error'); }
        });
      }

      // Mentions are disabled in ticket comments (UI autocomplete removed)

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

      // Delegate clicks for attachment download links (CSP-safe)
      const commentsListEl = document.getElementById('commentsList');
      if (commentsListEl) {
        commentsListEl.addEventListener('click', (e) => {
          const link = e.target.closest('a.attachment-download');
          if (link) {
            e.preventDefault();
            const attId = parseInt(link.dataset.attachmentId);
            if (!isNaN(attId)) this.downloadAttachment(attId);
          }
        });
      }
      
      document.getElementById('addCommentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addComment(ticketId, e.target, selectedFiles);
      });
      
      // Le bouton "modifier le ticket" n'est plus présent dans cette modale
      
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
      // Afficher "Résolu" pour les tickets fermés
      'closed': ' Résolu'
    };
    return labels[status] || status;
  }

  // Libellés FR pour priorités (Tickets et affichage côté Tickets)
  getPriorityLabelFR(priority) {
    const labels = {
      'low': ' Faible',
      'normal': ' Moyenne',
      'medium': ' Moyenne',
      'high': 'Élevée',
      'urgent': ' Urgente'
    };
    return labels[priority] || priority;
  }

  // Libellés FR pour les statuts de tâches (Kanban) lorsqu'affichés dans la modale Ticket
  getTaskStatusLabel(status) {
    const labels = {
      'todo_back': 'À faire (Back)',
      'todo_front': 'À faire (Front)',
      'todo': 'À faire',
      'in_progress': 'En cours',
      'ready_for_review': 'Prêt pour relecture',
      'done': 'Terminé'
    };
    return labels[status] || status;
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
                <option value="normal" ${ticket.priority === 'normal' ? 'selected' : ''}> Moyenne</option>
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
          
          <div class="ticket-info">
            <p><strong>Projet :</strong> ${ticket.project_name}</p>
            <p><strong>Client :</strong> ${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</p>
            <p><strong>Créé le :</strong> ${api.formatDateTime(ticket.created_at)}</p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
      status: formData.get('status')
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
      
      if (titleInput && updateData.title) titleInput.value = updateData.title;
      if (descTextarea && updateData.description) descTextarea.value = updateData.description;
      if (statusSelect && updateData.status) statusSelect.value = updateData.status;
      if (prioritySelect && updateData.priority) prioritySelect.value = updateData.priority;
    }
  }

  async viewProject(id) {
    try {
      const project = this.projects.find(p => p.id === id);
      if (!project) {
        this.showNotification('Projet introuvable', 'error');
        return;
      }

      // Stocker le projet actuel
      this.currentProject = project;

      // Update sidebar active state: highlight the selected Dev project link
      document.querySelectorAll('.sidebar__nav-item').forEach(el => el.classList.remove('sidebar__nav-item--active'));
      const devLink = document.querySelector(`#devProjectList .sidebar__dev-project[data-project-id="${id}"]`);
      if (devLink) {
        devLink.classList.add('sidebar__nav-item--active');
        // Ensure submenu is visible
        const devList = document.getElementById('devProjectList');
        if (devList && devList.style.display === 'none') devList.style.display = 'block';
      }
      
      // Activate Kanban tab (visibility handled by CSS classes)
      document.querySelectorAll('.tab-content').forEach(el => { el.classList.remove('active'); el.style.display = ''; });
      const kanbanEl = document.getElementById('projectKanban');
      if (kanbanEl) { kanbanEl.classList.add('active'); kanbanEl.style.display = ''; }
      
      // Switch tab state to show proper header buttons
      this.currentTab = 'project-kanban';
      this.updateHeaderActions();
      
      // Update title: show project name only
      const titleEl = document.querySelector('.main-title');
      if (titleEl) titleEl.textContent = project.name;
      
      // Pre-initialize drag & drop and clicks
      this.setupTaskClickHandlers();
      this.initKanbanDragDrop();

      // Show visual loading state
      this.setKanbanLoading(true);

      // Load tasks for project
      await this.loadProjectTasks(id);
      this.setKanbanLoading(false);
      
      // Configure kanban header events
      this.setupKanbanEvents(id);
      
    } catch (error) {
      console.error('viewProject error:', error);
      this.showNotification('Error displaying project', 'error');
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
          placeholder.textContent = 'Loading…';
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
      
      const response = await fetch(`/api/dev/projects/${projectId}/tasks`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Error loading tasks: ${response.status}`);
      }
      
      const result = await response.json();
      
      const tasks = result.data || [];
      
      // Vider toutes les colonnes
      const columns = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
      columns.forEach(status => {
        document.getElementById(`column-${status}`).innerHTML = '';
        document.getElementById(`count-${status}`).textContent = '0';
      });
      
      // Mapping des statuts DB -> colonnes kanban (identité pour tout, avec compat pour ancien 'todo')
      const statusMapping = {
        'todo_back': 'todo_back',
        'todo_front': 'todo_front',
        'todo': 'todo_back', // compat ancien
        'in_progress': 'in_progress', 
        'ready_for_review': 'ready_for_review',
        'done': 'done'
      };

      // Grouper les tâches par statut
      const tasksByStatus = {};
      columns.forEach(status => tasksByStatus[status] = []);
      
      tasks.forEach(task => {
        const kanbanStatus = statusMapping[task.status] || task.status || 'todo_back';
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
    
    
    // Event delegation pour les clics sur les tâches
    const kanbanBoard = document.getElementById('projectKanban');
    if (kanbanBoard && !this.taskClickHandlerAttached) {
      // Ajouter le nouvel event listener
      this.taskClickHandler = (e) => {
        const taskCard = e.target.closest('.task-card');
        if (taskCard && !e.target.closest('button')) {
          const taskId = taskCard.dataset.taskId;
          
          this.openTaskModal(taskId);
        }
      };
      
      kanbanBoard.addEventListener('click', this.taskClickHandler);
      this.taskClickHandlerAttached = true;
      
    }
  }

  async openTaskModal(taskId) {
    try {
      
      
      // Récupérer les détails de la tâche
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement de la tâche');
      }
      
      const result = await response.json();
      const task = result.data;
      this.currentTaskProjectId = task.project_id;
      // Préparer les membres du projet pour mentions
      let taskMentionMembers = [];
      try {
        const mres = await api.getProjectMembers(task.project_id);
        taskMentionMembers = mres.data || [];
      } catch(e) { /* silent */ }
      const taskEmailToName = {};
      taskMentionMembers.forEach(u => { taskEmailToName[(u.email||'').toLowerCase()] = `${u.first_name||''} ${u.last_name||''}`.trim() || u.email; });
      
      // Créer et afficher le modal en respectant unified-modals.css
      const modalHtml = `
        <div class="modal" id="taskModal" role="dialog" aria-modal="true">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="modal-title">Task details</h3>
              <button class="modal-close" type="button" aria-label="Close">&times;</button>
            </div>
            <div class="task-detail-tabs">
              <button class="tab-btn active" data-tab="details">Details</button>
              <button class="tab-btn" data-tab="discussions">Discussions</button>
              <button class="tab-btn" data-tab="attachments">Attachments</button>
              <button class="tab-btn" data-tab="tickets">Linked tickets</button>
            </div>
            <div class="modal-body">
              <section id="taskTab-details" class="task-tab active">
                <div class="form-group">
                  <label>Title</label>
                  <input type="text" id="taskTitle" value="${task.title}">
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea id="taskDescription">${task.description || ''}</textarea>
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select id="taskStatus">
                    <option value="todo_back" ${task.status === 'todo_back' ? 'selected' : ''}>To-do (Back)</option>
                    <option value="todo_front" ${task.status === 'todo_front' ? 'selected' : ''}>To-do (Front)</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In progress</option>
                    <option value="ready_for_review" ${task.status === 'ready_for_review' ? 'selected' : ''}>Ready for review</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Priority</label>
                  <select id="taskUrgency">
                    <option value="low" ${task.urgency === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${task.urgency === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${task.urgency === 'high' ? 'selected' : ''}>High</option>
                    <option value="urgent" ${task.urgency === 'urgent' ? 'selected' : ''}>Urgent</option>
                  </select>
                </div>
              </section>
              <section id="taskTab-discussions" class="task-tab" hidden>
                <div id="taskComments" class="comments-list" style="max-height: 360px; overflow-y: auto; padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px;">Loading…</div>
                <form id="taskCommentForm" class="form-inline">
                  <textarea id="taskCommentBody" placeholder="Your message… (@ to mention)" rows="3" required style="width:100%;"></textarea>
                  <div id="taskMentionSuggestions" style="display:none; position: relative;">
                    <div id="taskMentionList" style="position:absolute; z-index:10; background:white; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:6px; max-height:160px; overflow:auto; width:100%;"></div>
                  </div>
                  <div style="margin-top:8px; display:flex; gap:8px; justify-content:flex-end;">
                    <button type="submit" class="btn btn-primary">Send</button>
                  </div>
                </form>
              </section>
              
              <section id="taskTab-attachments" class="task-tab" hidden>
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                  <input type="file" id="taskAttachmentInput" multiple />
                  <button class="btn btn-primary" id="taskAttachmentUploadBtn">Upload</button>
                </div>
                <div id="taskAttachments" style="min-height:120px;">Loading…</div>
              </section>
              <section id="taskTab-tickets" class="task-tab" hidden>
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="linkTicketSearch" placeholder="Search ticket (title, number, ID)" />
                    <button class="btn btn-primary" id="linkTicketBtn">Link</button>
                  </div>
                  <div id="linkTicketResults" style="border:1px solid #e5e7eb; border-radius:6px; max-height:220px; overflow:auto; display:none;"></div>
                </div>
                <div id="taskTickets" style="min-height:120px;">Loading…</div>
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

      // Mentions (@) in task discussions
      try {
        const taskTextarea = modalEl.querySelector('#taskCommentBody');
        const taskMentionBox = modalEl.querySelector('#taskMentionSuggestions');
        const taskMentionList = modalEl.querySelector('#taskMentionList');
        let usersCacheTask = [];
        const ensureUsersTask = async () => {
          if (usersCacheTask.length) return usersCacheTask;
          try {
            const pid = this.currentTaskProjectId;
            if (!pid) { return []; }
            const res = await api.getProjectMembers(pid);
            usersCacheTask = (res?.data || []);
            console.debug('[task-mentions] project members loaded:', usersCacheTask.length);
            usersCacheTask.sort((a,b)=>`${a.first_name||''} ${a.last_name||''}`.localeCompare(`${b.first_name||''} ${b.last_name||''}`));
            return usersCacheTask;
          } catch(err){ console.error('[task-mentions] load members error:', err); return []; }
        };
        const filterUsersTask = (q) => {
          q=(q||'').toLowerCase();
          const list = usersCacheTask.filter(u=>{
            const email=(u.email||'').toLowerCase();
            const fn=(u.first_name||'').toLowerCase();
            const ln=(u.last_name||'').toLowerCase();
            const full=`${fn} ${ln}`.trim();
            if(!q) return true;
            return email.includes(q)||fn.includes(q)||ln.includes(q)||full.includes(q);
          });
          return list.slice(0,8);
        };
        const closeTaskMention=()=>{ if(taskMentionBox){ taskMentionBox.style.display='none'; taskMentionList.innerHTML=''; } };
        taskTextarea?.addEventListener('input', async ()=>{
          const val=taskTextarea.value; const caret=taskTextarea.selectionStart||val.length; const upto=val.substring(0,caret);
          const at=upto.lastIndexOf('@'); if(at===-1){ closeTaskMention(); return; }
          const fragment=upto.substring(at+1); if(/\s/.test(fragment)){ closeTaskMention(); return; }
          console.debug('[task-mentions] detected "@" at', at, 'fragment="'+fragment+'"');
          await ensureUsersTask();
          const matches=filterUsersTask(fragment);
          console.debug('[task-mentions] matches:', matches.length);
          if(!matches.length){ closeTaskMention(); return; }
          taskMentionList.innerHTML = matches.map(u=>{
            const name=`${u.first_name||''} ${u.last_name||''}`.trim()||u.email;
            return `<div class=\"mention-item\" data-email=\"${u.email}\" style=\"padding:6px 8px; cursor:pointer; border-radius:4px;\"><strong>${name}</strong> <span style=\\"color:#6b7280; font-size:12px;\\">${u.email}</span></div>`;
          }).join('');
          taskMentionBox.style.display='block';
          // Prevent clicks inside the suggestion box from bubbling to modal overlay
          taskMentionList.addEventListener('mousedown', (e)=>{ e.stopPropagation(); });
          taskMentionList.querySelectorAll('.mention-item').forEach(item=>{
            // Use mousedown to avoid textarea blur clearing the list before click
            item.addEventListener('mousedown',(ev)=>{
              ev.preventDefault(); ev.stopPropagation();
              const email=item.dataset.email; const before=val.substring(0,at); const after=val.substring(caret);
              taskTextarea.value=`${before}@${email} ${after}`;
              const pos=(before+`@${email} `).length; taskTextarea.setSelectionRange(pos,pos);
              closeTaskMention();
              // Re-focus the textarea to keep modal open and continue typing
              setTimeout(()=>taskTextarea.focus(), 0);
              console.debug('[task-mentions] selected:', email);
            });
          });
        });
        taskTextarea?.addEventListener('blur', ()=>{ console.debug('[task-mentions] blur -> close'); setTimeout(closeTaskMention,150); });
      } catch(e){ /* silent */ }

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
      // Préparer mapping email->nom pour mentions selon le projet courant
      let emailToName = {};
      if (this.currentTaskProjectId) {
        try {
          const mres = await api.getProjectMembers(this.currentTaskProjectId);
          (mres.data||[]).forEach(u => { emailToName[(u.email||'').toLowerCase()] = `${u.first_name||''} ${u.last_name||''}`.trim() || u.email; });
        } catch(e) { /* silent */ }
      }
      const highlight = (text) => {
        const escaped = (text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return escaped.replace(/@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (m, email)=>{
          const key=(email||'').toLowerCase(); const name=emailToName[key]||email; return `<span style=\"color:#C9A33A; font-weight:700;\">${name}</span>`;
        }).replace(/\n/g,'<br>');
      };
      const res = await fetch(`/api/dev/tasks/${taskId}/comments`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      if (!res.ok) throw new Error('Erreur chargement commentaires');
      const data = await res.json();
      const comments = data.data || [];
      if (comments.length === 0) { container.innerHTML = '<div style="color:#6b7280;">No messages</div>'; return; }
      container.innerHTML = comments.map(c => `
        <div class="comment-item" style="margin-bottom:12px;">
          <div style="font-weight:600; font-size:13px; color:#111827;">${c.author_first_name || ''} ${c.author_last_name || ''} <span style="color:#6b7280; font-weight:400;">(${api.formatDateTime ? api.formatDateTime(c.created_at) : c.created_at})</span></div>
          <div style="white-space:pre-wrap; font-size:13px; color:#374151;">${highlight(c.body || '')}</div>
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
      if (items.length === 0) { container.innerHTML = '<div style="color:#6b7280;">No activity</div>'; return; }
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
      if (files.length === 0) { container.innerHTML = '<div style="color:#6b7280;">No attachments</div>'; return; }
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
      
      this.showNotification('Task updated successfully', 'success');
      
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
        'todo_back': 'todo_back',
        'todo_front': 'todo_front',
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
        this.showNotification('Task moved', 'success');
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
    
    
    // Utiliser event delegation pour les boutons du header qui peuvent être recréés
    const headerActions = document.getElementById('mainHeaderActions');
    if (headerActions) {
      // Supprimer les anciens event listeners pour éviter les doublons
      headerActions.removeEventListener('click', this.kanbanHeaderClickHandler);
      
      // Créer le handler avec le projectId en closure
      this.kanbanHeaderClickHandler = (e) => {
        if (e.target.id === 'createTaskBtn') {
          
          this.showCreateTaskModal(projectId);
        }
      };
      
      // Attacher l'event listener
      headerActions.addEventListener('click', this.kanbanHeaderClickHandler);
      
    }
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'urgent': 'Urgent'
    };
    return labels[priority] || priority;
  }

  async showCreateTaskModal(projectId) {
    
    const modalHtml = `
      <div class="modal" id="createTaskModal" role="dialog" aria-modal="true">
        <div class="modal-content">
          <div class="modal-header">
            <h3>New Task</h3>
            <button class="modal-close" type="button" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <form id="createTaskForm">
              <div class="form-group">
                <label>Title *</label>
                <input type="text" id="taskTitle" required>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="taskDescription"></textarea>
              </div>
              <div class="form-group">
                <label>Priority</label>
                <select id="taskPriority">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select id="taskStatus">
                  <option value="todo_back" selected>To-do (Back)</option>
                  <option value="todo_front">To-do (Front)</option>
                  <option value="in_progress">In progress</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal>Cancel</button>
            <button class="btn btn-primary" id="createTaskSubmitBtn">Create</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    const modalEl = document.getElementById('createTaskModal');
    const close = () => {
      modalEl?.remove();
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    };
    modalEl.querySelector('.modal-close')?.addEventListener('click', close);
    modalEl.querySelector('[data-close-modal]')?.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => { if (!e.target.closest('.modal-content')) close(); });
    const escHandler = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', escHandler); } };
    window.addEventListener('keydown', escHandler);

    const submitBtn = modalEl.querySelector('#createTaskSubmitBtn');
    submitBtn.addEventListener('click', async () => {
      const formEl = modalEl.querySelector('#createTaskForm');
      if (!formEl.reportValidity()) return;
      await this.createTask(projectId, modalEl);
    });
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
      
      if (!response.ok) throw new Error('Error while creating task');
      
      this.showNotification('Task created successfully', 'success');
      modal.remove();
      await this.loadProjectTasks(projectId);
      
    } catch (error) {
      console.error('createTask error:', error);
      this.showNotification('Error while creating task', 'error');
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
            <button type="button" class="btn btn-secondary cancel-btn">Fermer</button>
            <button type="button" class="btn btn-primary" data-action="edit-client" data-client-id="${client.id}">Modifier</button>
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

      // Charger le client du projet pour préremplir les notes internes existantes
      const clientResponse = await api.getUser(projectResponse.data.project.client_id);
      const projectClient = clientResponse.data.user;
      
      const project = projectResponse.data.project;
      const clients = clientsResponse.data.clients;
      
      const modal = this.createModal('Modifier Projet', `
        <form id="editProjectForm" class="form">
          <input type="hidden" name="id" value="${project.id}">
          <input type="hidden" name="client_id" value="${project.client_id}">
          
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

          <div class="form-group" style="border-top:1px solid #e5e7eb; padding-top:12px; margin-top:8px;">
            <label class="form-label">Documents projet</label>
            <div style="display:flex; gap:16px; flex-wrap:wrap;">
              <div>
                <div>Devis:</div>
                ${project.quote_file ? `<a href="${project.quote_file}" target="_blank">${project.quote_file.split('/').pop()}</a>` : '<span style="color:#6b7280;">Aucun devis</span>'}
                <div style="margin-top:6px;">
                  <input type="file" id="projectQuoteFile" />
                  <button type="button" class="btn btn-secondary" id="uploadProjectQuoteBtn">Uploader devis</button>
                </div>
              </div>
              <div>
                <div>Cahier des charges:</div>
                ${project.specifications_file ? `<a href="${project.specifications_file}" target="_blank">${project.specifications_file.split('/').pop()}</a>` : '<span style="color:#6b7280;">Aucun cahier des charges</span>'}
                <div style="margin-top:6px;">
                  <input type="file" id="projectSpecsFile" />
                  <button type="button" class="btn btn-secondary" id="uploadProjectSpecsBtn">Uploader cahier des charges</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="editProjectInternalNotes">Notes internes / Informations confidentielles</label>
            <textarea id="editProjectInternalNotes" name="internal_notes"
                     class="form-input" rows="4"
                     placeholder="Notes internes, identifiants, informations sensibles...">${(() => {
                       if (projectClient && projectClient.confidential_file_decrypted && !this.hasValidFile(projectClient.confidential_file_decrypted)) {
                         return projectClient.confidential_file_decrypted;
                       }
                       return '';
                     })()}</textarea>
          </div>

          
          ${project.status !== 'archived' ? `
            <div class="form-warning">
              <p> Archiver un projet masquera tous ses tickets associés</p>
            </div>
          ` : ''}
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          </div>
        </form>
      `);

      document.getElementById('editProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditProject(e.target);
      });
      
      // Uploads devis/specs par projet
      const quoteBtn = document.getElementById('uploadProjectQuoteBtn');
      const specsBtn = document.getElementById('uploadProjectSpecsBtn');
      const quoteInput = document.getElementById('projectQuoteFile');
      const specsInput = document.getElementById('projectSpecsFile');
      if (quoteBtn && quoteInput) {
        quoteBtn.addEventListener('click', async () => {
          if (!quoteInput.files || !quoteInput.files[0]) { this.showNotification('Sélectionnez un devis', 'warning'); return; }
          try {
            quoteBtn.disabled = true; quoteBtn.textContent = 'Upload...';
            const resp = await api.uploadProjectQuote(project.id, quoteInput.files[0]);
            if (resp && resp.success) { this.showNotification('Devis uploadé', 'success'); this.closeModal(); this.editProject(project.id); }
            else this.showNotification(resp?.message || 'Échec upload devis', 'error');
          } catch (err) { this.showNotification('Échec upload devis', 'error'); }
          finally { quoteBtn.disabled = false; quoteBtn.textContent = 'Uploader devis'; }
        });
      }
      if (specsBtn && specsInput) {
        specsBtn.addEventListener('click', async () => {
          if (!specsInput.files || !specsInput.files[0]) { this.showNotification('Sélectionnez un cahier des charges', 'warning'); return; }
          try {
            specsBtn.disabled = true; specsBtn.textContent = 'Upload...';
            const resp = await api.uploadProjectSpecifications(project.id, specsInput.files[0]);
            if (resp && resp.success) { this.showNotification('Cahier des charges uploadé', 'success'); this.closeModal(); this.editProject(project.id); }
            else this.showNotification(resp?.message || 'Échec upload cahier des charges', 'error');
          } catch (err) { this.showNotification('Échec upload cahier des charges', 'error'); }
          finally { specsBtn.disabled = false; specsBtn.textContent = 'Uploader cahier des charges'; }
        });
      }
    } catch (error) {
      this.showNotification('Erreur lors du chargement du projet', 'error');
    }
  }

  async handleEditProject(form) {
    const formData = new FormData(form);
    const projectId = formData.get('id');
    const clientId = formData.get('client_id');
    
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

      // Mettre à jour les notes internes/confidentielles au niveau du client associé
      const internalNotes = formData.get('internal_notes');
      if (clientId != null && internalNotes != null) {
        try {
          await api.updateUser(clientId, { confidential_file: internalNotes });
        } catch (e) {
          console.warn('Mise à jour des notes internes échouée:', e);
        }
      }
      
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
            <button type="button" class="btn btn-secondary cancel-btn">
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
      
      // Les règles SLA ne sont plus configurées au niveau du client
      
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
          
          
          
          <div class="form-info">
            <p><small> ${client.project_count || 0} projets - ${client.ticket_count || 0} tickets</small></p>
            <p><small>Inscrit le ${api.formatDate(client.created_at)}</small></p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
      country: formData.get('country')
    };

    // Nettoyer les valeurs vides
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '' || updateData[key] === null) {
        updateData[key] = null;
      }
    });

    // Documents (devis / cahier des charges) désormais gérés au niveau projet: aucun traitement côté client

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
      
      this.showNotification('Client modifié avec succès', 'success');
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
            <button type="button" class="btn btn-secondary cancel-btn">
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
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
                <option value="normal" selected> Moyenne</option>
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
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
        
        <div class="form-info" style="padding:10px; border:1px dashed #e5e7eb; border-radius:6px; background:#fafafa;">
          <small>Note: Les documents "Devis" et "Cahier des charges" seront associés à un projet (à ajouter après la création du client).</small>
        </div>
        
        
        <div class="form-group">
          <label class="form-label" for="clientPassword">Mot de passe temporaire *</label>
          <input type="password" id="clientPassword" name="password" 
                 class="form-input" minlength="6" required>
          <small>Le client pourra le modifier lors de sa première connexion</small>
        </div>
        
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer le Client</button>
        </div>
      </form>
    `);

    document.getElementById('addClientForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
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
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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

      
      const response = await api.createUser(clientData);
      
      
      if (response.success) {
        const clientId = response.data.user.id;
        this.showNotification('Client créé avec succès', 'success');
        
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
    if (!invoice.due_date || invoice.status === 'paid') {
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
      'overdue': ' En retard'
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
            <button type="button" class="btn btn-secondary cancel-btn">Annuler</button>
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
    doc.text('En cas de question, contactez-nous à contact@shape-conseil.fr', 20, 275);
    
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
        <button type="button" class="btn btn-primary" data-action="download-invoice" data-invoice-id="${invoice.id}">
          Télécharger PDF
        </button>
        <button type="button" class="btn btn-secondary" data-action="edit-invoice" data-invoice-id="${invoice.id}">
          Modifier
        </button>
        <button type="button" class="btn btn-secondary cancel-btn">Fermer</button>
      </div>
    `);
    // Bind actions to comply with CSP (no inline handlers)
    const modal = document.getElementById('modal');
    if (modal) {
      const downloadBtn = modal.querySelector('[data-action="download-invoice"]');
      const editBtn = modal.querySelector('[data-action="edit-invoice"]');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          this.downloadInvoicePDF(invoice.id);
          this.closeModal();
        });
      }
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.editInvoice(invoice.id);
          this.closeModal();
        });
      }
    }
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
        const updateData = {
          amount_ht: parseFloat(amountHt.value),
          tva_rate: noTva.checked ? 0 : parseFloat(tvaRate.value),
          description: document.getElementById('editDescription').value,
          status: document.getElementById('editStatus').value
        };
        
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
      const response = await api.updateInvoice(id, data);
      
      if (response.success) {
        this.showNotification('Facture mise à jour avec succès', 'success');
        // Recharger la liste des factures
        if (this.currentTab === 'invoices') {
          this.loadInvoices();
        }
      } else {
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
        <button type="button" class="remove-selected-file" data-index="${index}"
                style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 4px; font-size: 16px;">✕</button>
      </div>
    `).join('');

    // Bind remove buttons (CSP-safe)
    selectedFilesList.querySelectorAll('.remove-selected-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        this.removeFile(idx);
      });
    });
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
              <a href="#" class="attachment-download" data-attachment-id="${attachment.id}"
                 style="color: ${isFromClient ? '#93c5fd' : '#bfdbfe'}; text-decoration: none; font-weight: 500; cursor: pointer;">
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
