class ClientApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.projects = [];
    this.tickets = [];
    this.init();
  }

  init() {
    console.log('ClientApp: Initializing...');
    this.checkAuth();
    this.setupEventListeners();
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/';
      return;
    }

    this.loadUserProfile();
  }

  async loadUserProfile() {
    try {
      const response = await api.getProfile();
      this.currentUser = response.data.user;
      
      if (this.currentUser.role !== 'client') {
        alert('Cette interface est réservée aux clients');
        window.location.href = '/';
        return;
      }

      this.showMainApp();
      this.loadOverview();
    } catch (error) {
      console.error('Profile load error:', error);
      localStorage.removeItem('token');
      window.location.href = '/';
    }
  }

  showLogin() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
  }

  showMainApp() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('currentUser').textContent = 
      `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    
    // Rebind dynamic event listeners after showing main app
    setTimeout(() => {
      this.setupDynamicEventListeners();
    }, 100);
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      this.logout();
    });

    // New ticket buttons (multiple instances)
    document.getElementById('newTicketBtn')?.addEventListener('click', () => {
      this.showNewTicketModal();
    });

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
    
    // Setup dynamic event listeners (called after DOM changes)
    this.setupDynamicEventListeners();

    // Refresh buttons and filters
    document.getElementById('refreshTickets')?.addEventListener('click', () => {
      this.loadTickets();
    });

    document.getElementById('ticketStatusFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });

    document.getElementById('ticketPriorityFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });

    // New ticket button 2 (in tickets tab)
    document.getElementById('newTicketBtn2')?.addEventListener('click', () => {
      this.showNewTicketModal();
    });

    // Quick action buttons in overview
    document.getElementById('quickNewTicket')?.addEventListener('click', () => {
      this.showNewTicketModal();
    });

    document.getElementById('quickViewProjects')?.addEventListener('click', () => {
      this.switchTab('projects');
    });

    document.getElementById('quickProfile')?.addEventListener('click', () => {
      this.switchTab('profile');
    });

    // Project filters and search
    document.getElementById('projectSearch')?.addEventListener('input', () => {
      this.filterProjects();
    });

    document.getElementById('projectStatusFilter')?.addEventListener('change', () => {
      this.filterProjects();
    });

    document.getElementById('projectSortBy')?.addEventListener('change', () => {
      this.sortProjects();
    });

    // View toggle buttons
    document.getElementById('gridView')?.addEventListener('click', () => {
      this.setProjectView('grid');
    });

    document.getElementById('listView')?.addEventListener('click', () => {
      this.setProjectView('list');
    });

    // Ticket search and category filter
    document.getElementById('ticketSearch')?.addEventListener('input', () => {
      this.filterTickets();
    });

    document.getElementById('ticketCategoryFilter')?.addEventListener('change', () => {
      this.filterTickets();
    });

    document.getElementById('clearFilters')?.addEventListener('click', () => {
      this.clearTicketFilters();
    });

    // Profile tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchProfileTab(tab.dataset.tab);
      });
    });

    // Ticket tabs
    document.querySelectorAll('.ticket-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTicketTab(tab.dataset.tab);
      });
    });

    // Password change form
    document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange();
    });
  }

  async handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
      const response = await api.login(email, password);
      
      if (response.success) {
        this.currentUser = response.data.user;
        
        if (this.currentUser.role !== 'client') {
          this.showError('Cette interface est réservée aux clients');
          return;
        }

        this.showMainApp();
        this.loadOverview();
      }
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  }

  async logout() {
    await api.logout();
    this.currentUser = null;
    this.projects = [];
    this.tickets = [];
    window.location.href = '/';
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
    switch (tabName) {
      case 'overview':
        this.loadOverview();
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
    
    // Rebind event listeners after tab switch
    setTimeout(() => {
      this.setupDynamicEventListeners();
    }, 100);
  }

  async loadOverview() {
    console.log('Loading overview - simple version');
    // Simple overview - no complex stats needed
  }

  renderActiveProjects() {
    const container = document.getElementById('activeProjectsList');
    if (!container) return; // Element doesn't exist in simplified interface
    
    const activeProjects = this.projects.filter(p => p.status === 'active').slice(0, 3);
    
    if (activeProjects.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun projet actif</div>';
      return;
    }

    container.innerHTML = activeProjects.map(project => `
      <div class="project-overview-item">
        <div class="project-overview-title">${project.name}</div>
        <div class="project-overview-meta">
          <span>${project.ticket_count || 0} tickets</span>
          <span>${api.formatDate(project.created_at)}</span>
        </div>
      </div>
    `).join('');
  }

  renderRecentTickets() {
    const container = document.getElementById('recentTicketsList');
    if (!container) return; // Element doesn't exist in simplified interface
    
    const recentTickets = this.tickets.slice(0, 3);
    
    if (recentTickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket récent</div>';
      return;
    }

    container.innerHTML = recentTickets.map(ticket => `
      <div class="ticket-overview-item" onclick="clientApp.viewTicket(${ticket.id})">
        <div class="ticket-overview-title">${ticket.title}</div>
        <div class="ticket-overview-meta">
          <span>${api.formatDate(ticket.created_at)}</span>
          <div class="ticket-overview-badges">
            <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
            <span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  async loadProjects() {
    const container = document.getElementById('projectsList');
    container.innerHTML = '<div class="loading">Chargement des projets...</div>';

    try {
      const response = await api.getProjects({ client_id: this.currentUser.id });
      this.projects = response.data.projects;
      this.renderProjectsGrid();
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des projets</div>';
    }
  }

  renderProjectsGrid() {
    this.displayProjects(this.projects);
  }

  async loadTickets() {
    const container = document.getElementById('ticketsList');
    container.innerHTML = '<div class="loading">Chargement des tickets...</div>';

    try {
      const filters = { client_id: this.currentUser.id };
      const statusFilter = document.getElementById('ticketStatusFilter')?.value;
      const priorityFilter = document.getElementById('ticketPriorityFilter')?.value;

      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;

      const response = await api.getTickets(filters);
      this.tickets = response.data.tickets;
      this.renderTicketsList();
    } catch (error) {
      console.error('Tickets load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des tickets</div>';
    }
  }

  renderTicketsList() {
    this.displayTickets(this.tickets);
  }

  async loadProfile() {
    const container = document.getElementById('profileInfo');
    
    try {
      const user = this.currentUser;
      
      container.innerHTML = `
        <div class="profile-info-item">
          <span class="profile-info-label">Nom complet</span>
          <span class="profile-info-value">${user.first_name} ${user.last_name}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Email</span>
          <div class="profile-email-edit">
            <input type="email" id="userEmail" class="form-input" value="${user.email}" style="display: inline-block; width: 300px; margin-right: 10px;">
            <button type="button" id="saveEmailBtn" class="btn btn-sm btn-primary" onclick="clientApp.saveEmail()">Sauvegarder</button>
          </div>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Entreprise</span>
          <span class="profile-info-value">${user.company || 'Non spécifiée'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Devis *</span>
          <div class="profile-file-edit">
            <input type="file" id="quoteFile" accept=".pdf,.doc,.docx" style="margin-right: 10px;">
            <button type="button" class="btn btn-sm btn-primary" onclick="clientApp.uploadQuote()">Télécharger le devis</button>
            ${user.quote_file ? `<div class="current-file">Fichier actuel: <a href="${user.quote_file}" target="_blank">${user.quote_file.split('/').pop()}</a></div>` : '<div class="file-required">⚠️ Devis obligatoire - veuillez télécharger votre devis</div>'}
          </div>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Cahier des charges *</span>
          <div class="profile-file-edit">
            <input type="file" id="specificationsFile" accept=".pdf,.doc,.docx" style="margin-right: 10px;">
            <button type="button" class="btn btn-sm btn-primary" onclick="clientApp.uploadSpecifications()">Télécharger le cahier des charges</button>
            ${user.specifications_file ? `<div class="current-file">Fichier actuel: <a href="${user.specifications_file}" target="_blank">${user.specifications_file.split('/').pop()}</a></div>` : '<div class="file-required">⚠️ Cahier des charges obligatoire - veuillez télécharger votre cahier des charges</div>'}
          </div>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Compte créé le</span>
          <span class="profile-info-value">${api.formatDate(user.created_at)}</span>
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

    // Validation
    if (newPassword !== confirmPassword) {
      this.showMessage(resultDiv, 'Les mots de passe ne correspondent pas', 'error');
      return;
    }

    if (newPassword.length < 6) {
      this.showMessage(resultDiv, 'Le nouveau mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    try {
      await api.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      this.showMessage(resultDiv, 'Mot de passe changé avec succès', 'success');
      document.getElementById('changePasswordForm').reset();

    } catch (error) {
      this.showMessage(resultDiv, error.message, 'error');
    }
  }

  showMessage(container, message, type) {
    container.className = type === 'error' ? 'error-message' : 'success-message';
    container.textContent = message;
    container.style.display = 'block';

    // Hide message after 5 seconds
    setTimeout(() => {
      container.style.display = 'none';
    }, 5000);
  }

  // Action methods
  async viewTicket(id) {
    try {
      const response = await api.getTicket(id);
      const ticket = response.data.ticket;
      const comments = response.data.comments || [];
      
      const modal = this.createModal(`${ticket.title}`, `
        <div class="ticket-view-client">
          <!-- En-tête du ticket -->
          <div class="ticket-header-client">
            <div class="ticket-info-grid">
              <div class="info-item">
                <span class="info-label">Projet:</span>
                <span class="info-value">${ticket.project_name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Statut:</span>
                <span class="status-badge status-${ticket.status}">${this.getStatusLabel(ticket.status)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Priorité:</span>
                <span class="priority-badge priority-${ticket.priority}">${this.getPriorityLabel(ticket.priority)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Créé le:</span>
                <span class="info-value">${api.formatDate(ticket.created_at)}</span>
              </div>
              ${ticket.assigned_to ? `
                <div class="info-item">
                  <span class="info-label">Assigné à:</span>
                  <span class="info-value">${ticket.assigned_to_name}</span>
                </div>
              ` : ''}
              <div class="info-item">
                <span class="info-label">Dernière mise à jour:</span>
                <span class="info-value">${api.formatDateTime(ticket.updated_at)}</span>
              </div>
            </div>
          </div>
          
          <!-- Description du ticket -->
          <div class="ticket-section">
            <h4 class="section-title">📝 Description</h4>
            <div class="ticket-description-client">
              ${ticket.description.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <!-- SLA Info -->
          ${ticket.sla_hours ? `
            <div class="ticket-section">
              <h4 class="section-title">⏱️ SLA et Délais</h4>
              <div class="sla-info-client">
                <div class="sla-item-client">
                  <span class="sla-label">Temps de réponse garanti:</span>
                  <span class="sla-value">${ticket.sla_hours}h</span>
                </div>
                <div class="sla-item-client ${ticket.is_overdue ? 'overdue' : ''}">
                  <span class="sla-label">Échéance de résolution:</span>
                  <span class="sla-value">${api.formatDateTime(ticket.sla_deadline)}</span>
                  ${ticket.is_overdue ? '<span class="overdue-indicator">⚠️ DÉPASSÉ</span>' : ''}
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- Pièces jointes -->
          ${ticket.attachments && ticket.attachments.length > 0 ? `
            <div class="ticket-section">
              <h4 class="section-title">📎 Pièces jointes</h4>
              <div class="attachments-client">
                ${ticket.attachments.map(att => `
                  <div class="attachment-client">
                    <span class="attachment-icon">${this.getFileIcon(att.mimetype)}</span>
                    <a href="/api/attachments/${att.id}" target="_blank" class="attachment-link-client">
                      ${att.filename}
                    </a>
                    <span class="attachment-meta">(${this.formatFileSize(att.size)})</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Échanges et commentaires -->
          <div class="ticket-section">
            <h4 class="section-title">💬 Échanges (${comments.length})</h4>
            
            <div class="comments-client" id="commentsClientList">
              ${comments.length > 0 ? comments.map(comment => `
                <div class="comment-client ${comment.is_internal ? 'comment-internal' : ''}">
                  <div class="comment-author-client">
                    <span class="author-name">${comment.author_name}</span>
                    <span class="comment-date-client">${api.formatDateTime(comment.created_at)}</span>
                    ${comment.is_internal ? '<span class="internal-badge-client">Interne</span>' : ''}
                  </div>
                  <div class="comment-text-client">
                    ${comment.content.replace(/\n/g, '<br>')}
                  </div>
                </div>
              `).join('') : `
                <div class="no-comments">
                  <p>Aucun échange pour le moment.</p>
                  <p><small>Votre message sera automatiquement notifié à l'équipe support.</small></p>
                </div>
              `}
            </div>
            
            <!-- Ajouter un message -->
            <div class="add-message-section">
              <h5 class="add-message-title">💬 Ajouter un message</h5>
              <form id="addClientCommentForm">
                <div class="form-group">
                  <textarea id="clientCommentContent" name="content" class="form-input" 
                            rows="4" placeholder="Votre message, question ou complément d'information..." required></textarea>
                </div>
                
                <div class="message-tips">
                  <p><strong>💡 Conseils pour un meilleur support :</strong></p>
                  <ul>
                    <li>Soyez précis dans votre description</li>
                    <li>Mentionnez les étapes que vous avez déjà tentées</li>
                    <li>Joignez des captures d'écran si nécessaire</li>
                  </ul>
                </div>
                
                <div class="form-group">
                  <label class="form-label" for="messageAttachments">Ajouter des fichiers (optionnel)</label>
                  <input type="file" id="messageAttachments" name="attachments" 
                         class="form-input" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt">
                  <small>Captures d'écran, logs, documents... (Max 3 fichiers, 5MB chacun)</small>
                </div>
                
                <div class="form-actions">
                  <button type="submit" class="btn btn-primary">
                    📤 Envoyer le message
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          <div class="ticket-footer">
            <button type="button" class="btn btn-secondary" onclick="clientApp.closeModal()">
              Fermer
            </button>
          </div>
        </div>
      `, 'large');
      
      // Gestion de l'ajout de message
      document.getElementById('addClientCommentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addClientComment(id, e.target);
      });
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement du ticket', 'error');
    }
  }

  async addClientComment(ticketId, form) {
    const formData = new FormData(form);
    const commentData = {
      ticket_id: ticketId,
      content: formData.get('content').trim(),
      is_internal: false // Les clients ne peuvent pas créer de commentaires internes
    };

    if (!commentData.content) {
      this.showNotification('Le message ne peut pas être vide', 'error');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '📤 Envoi en cours...';

      await api.createComment(commentData);
      
      // Réinitialiser le formulaire
      form.reset();
      
      this.showNotification('Message envoyé ! L\'équipe sera notifiée.', 'success');
      
      // Recharger la vue du ticket
      this.viewTicket(ticketId);
      
    } catch (error) {
      this.showNotification('Erreur lors de l\'envoi du message', 'error');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = '📤 Envoyer le message';
    }
  }

  getStatusLabel(status) {
    const labels = {
      'open': '🔴 Ouvert',
      'in_progress': '🟡 En cours de traitement',
      'waiting_client': '⏳ En attente de votre retour',
      'resolved': '✅ Résolu',
      'closed': '⚫ Fermé'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority) {
    const labels = {
      'low': '🟢 Faible',
      'normal': '🔵 Normale',
      'high': '🟠 Élevée',
      'urgent': '🔴 Urgente'
    };
    return labels[priority] || priority;
  }

  createTicketForProject(projectId) {
    alert(`Créer ticket pour projet #${projectId} - Modal à implémenter`);
  }

  viewProjectTickets(projectId) {
    // Filter tickets by project and switch to tickets tab
    document.getElementById('ticketStatusFilter').value = '';
    document.getElementById('ticketPriorityFilter').value = '';
    
    this.switchTab('tickets');
    
    // Filter tickets by project (would need to add project filter)
    alert(`Afficher tickets du projet #${projectId} - Filtre à implémenter`);
  }

  async showNewTicketModal() {
    try {
      // Charger les projets du client
      const response = await api.getProjects({ client_only: true });
      const projects = response.data.projects;
      
      if (projects.length === 0) {
        this.showNotification('Aucun projet disponible. Contactez votre administrateur.', 'warning');
        return;
      }

      const modal = this.createModal('Nouveau Ticket de Support', `
        <form id="newTicketForm" class="form" enctype="multipart/form-data">
          <div class="form-step" id="step1">
            <h4 class="step-title">🎯 Étape 1: Informations générales</h4>
            
            <div class="form-group">
              <label class="form-label" for="ticketProject">Projet concerné *</label>
              <select id="ticketProject" name="project_id" class="form-input" required>
                <option value="">-- Sélectionner un projet --</option>
                ${projects.map(project => `
                  <option value="${project.id}" data-description="${project.description || ''}">
                    ${project.name}
                  </option>
                `).join('')}
              </select>
              <div id="projectDescription" class="form-help"></div>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketTitle">Titre du ticket *</label>
              <input type="text" id="ticketTitle" name="title" class="form-input" 
                     placeholder="Ex: Problème de connexion, Nouvelle fonctionnalité..." required>
              <small>Décrivez brièvement votre demande</small>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketType">Type de demande *</label>
              <select id="ticketType" name="type" class="form-input" required>
                <option value="">-- Choisir le type --</option>
                <option value="bug">🐛 Signalement de bug</option>
                <option value="feature">✨ Demande de fonctionnalité</option>
                <option value="support">❓ Demande d'aide</option>
                <option value="maintenance">🔧 Maintenance/Correction</option>
                <option value="other">📝 Autre</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketPriority">Priorité *</label>
              <select id="ticketPriority" name="priority" class="form-input" required>
                <option value="low">🟢 Faible - Pas urgent</option>
                <option value="normal" selected>🔵 Normale - Dans les temps</option>
                <option value="high">🟠 Élevée - Assez urgent</option>
                <option value="urgent">🔴 Urgente - Très urgent</option>
              </select>
            </div>
          </div>
          
          <div class="form-step hidden" id="step2">
            <h4 class="step-title">📝 Étape 2: Description détaillée</h4>
            
            <div class="form-group">
              <label class="form-label" for="ticketDescription">Description complète *</label>
              <textarea id="ticketDescription" name="description" class="form-input" 
                        rows="6" placeholder="Décrivez votre problème ou votre demande en détail..." required></textarea>
              <small>Plus vous êtes précis, plus nous pourrons vous aider rapidement</small>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketSteps">Étapes pour reproduire (optionnel)</label>
              <textarea id="ticketSteps" name="steps_to_reproduce" class="form-input" 
                        rows="4" placeholder="1. J'ai cliqué sur...
2. Puis j'ai...
3. Le problème est apparu..."></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketExpected">Comportement attendu (optionnel)</label>
              <textarea id="ticketExpected" name="expected_behavior" class="form-input" 
                        rows="3" placeholder="Ce qui devrait se passer normalement..."></textarea>
            </div>
          </div>
          
          <div class="form-step hidden" id="step3">
            <h4 class="step-title">📎 Étape 3: Pièces jointes (optionnel)</h4>
            
            <div class="form-group">
              <label class="form-label" for="ticketAttachments">Fichiers joints</label>
              <input type="file" id="ticketAttachments" name="attachments" 
                     class="form-input" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt">
              <small>Captures d'écran, documents... (Max 5 fichiers, 10MB chacun)</small>
            </div>
            
            <div id="filePreview" class="file-preview"></div>
            
            <div class="form-info">
              <p><strong>💡 Conseils pour de meilleurs fichiers :</strong></p>
              <ul>
                <li>📸 Captures d'écran pour les problèmes visuels</li>
                <li>📄 Logs ou messages d'erreur en fichier texte</li>
                <li>📊 Documents avec les spécifications pour les nouvelles fonctionnalités</li>
              </ul>
            </div>
          </div>
          
          <div class="form-navigation">
            <button type="button" id="prevBtn" class="btn btn-secondary hidden" onclick="clientApp.changeStep(-1)">
              ← Précédent
            </button>
            <button type="button" id="nextBtn" class="btn btn-primary" onclick="clientApp.changeStep(1)">
              Suivant →
            </button>
            <button type="submit" id="submitBtn" class="btn btn-success hidden">
              🚀 Créer le Ticket
            </button>
          </div>
        </form>
      `, 'large');

      // Gestion du changement de projet
      document.getElementById('ticketProject').addEventListener('change', (e) => {
        const option = e.target.selectedOptions[0];
        const description = option.getAttribute('data-description');
        const descDiv = document.getElementById('projectDescription');
        
        if (description) {
          descDiv.innerHTML = `<div class="project-description">${description}</div>`;
        } else {
          descDiv.innerHTML = '';
        }
      });

      // Gestion des fichiers
      document.getElementById('ticketAttachments').addEventListener('change', (e) => {
        this.handleFilePreview(e.target.files);
      });

      // Gestion de la soumission
      document.getElementById('newTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateTicket(e.target);
      });
      
      // Variables de navigation
      this.currentStep = 1;
      this.totalSteps = 3;
      
    } catch (error) {
      this.showNotification('Erreur lors du chargement des projets', 'error');
    }
  }

  changeStep(direction) {
    const currentStepEl = document.getElementById(`step${this.currentStep}`);
    
    // Validation avant de passer à l'étape suivante
    if (direction > 0 && !this.validateCurrentStep()) {
      return;
    }
    
    // Calculer la nouvelle étape
    const newStep = this.currentStep + direction;
    
    if (newStep < 1 || newStep > this.totalSteps) {
      return;
    }
    
    // Masquer l'étape actuelle
    currentStepEl.classList.add('hidden');
    
    // Afficher la nouvelle étape
    this.currentStep = newStep;
    document.getElementById(`step${this.currentStep}`).classList.remove('hidden');
    
    // Mettre à jour les boutons
    this.updateNavigationButtons();
  }

  validateCurrentStep() {
    if (this.currentStep === 1) {
      const project = document.getElementById('ticketProject').value;
      const title = document.getElementById('ticketTitle').value;
      const type = document.getElementById('ticketType').value;
      const priority = document.getElementById('ticketPriority').value;
      
      if (!project || !title || !type || !priority) {
        this.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return false;
      }
      
      if (title.length < 10) {
        this.showNotification('Le titre doit contenir au moins 10 caractères', 'error');
        return false;
      }
    }
    
    if (this.currentStep === 2) {
      const description = document.getElementById('ticketDescription').value;
      
      if (!description || description.length < 20) {
        this.showNotification('La description doit contenir au moins 20 caractères', 'error');
        return false;
      }
    }
    
    return true;
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    prevBtn.classList.toggle('hidden', this.currentStep === 1);
    nextBtn.classList.toggle('hidden', this.currentStep === this.totalSteps);
    submitBtn.classList.toggle('hidden', this.currentStep !== this.totalSteps);
  }

  handleFilePreview(files) {
    const preview = document.getElementById('filePreview');
    preview.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
      if (index >= 5) return; // Limite de 5 fichiers
      
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <div class="file-info">
          <span class="file-icon">${this.getFileIcon(file.type)}</span>
          <span class="file-name">${file.name}</span>
          <span class="file-size">(${this.formatFileSize(file.size)})</span>
        </div>
        <button type="button" class="file-remove" onclick="this.parentElement.remove()">×</button>
      `;
      preview.appendChild(fileItem);
    });
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('text')) return '📃';
    return '📎';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async handleCreateTicket(form) {
    if (!this.validateCurrentStep()) {
      return;
    }

    const formData = new FormData(form);
    
    try {
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = '🔄 Création en cours...';

      const response = await api.createTicket(formData);
      
      if (response.success) {
        this.showNotification('Ticket créé avec succès ! Vous recevrez une confirmation par email.', 'success');
        this.closeModal();
        
        // Recharger la liste des tickets
        this.loadTickets();
        
        // Afficher le nouveau ticket
        setTimeout(() => {
          this.viewTicket(response.data.ticket.id);
        }, 1000);
      }
    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la création du ticket', 'error');
    } finally {
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Créer le Ticket';
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
      <div class="modal-overlay" onclick="clientApp.closeModal()"></div>
      <div class="modal-content ${modalSizeClass}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button type="button" class="modal-close" onclick="clientApp.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
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
      modal.remove();
    }
  }

  showError(message) {
    alert(message);
  }

  async saveEmail() {
    const emailInput = document.getElementById('userEmail');
    const newEmail = emailInput.value.trim();
    
    if (!newEmail) {
      this.showNotification('L\'email ne peut pas être vide', 'error');
      return;
    }

    if (newEmail === this.currentUser.email) {
      this.showNotification('Aucune modification détectée', 'info');
      return;
    }

    try {
      const saveBtn = document.getElementById('saveEmailBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Sauvegarde...';

      await api.request('/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify({
          email: newEmail
        })
      });

      this.currentUser.email = newEmail;
      this.showNotification('Email mis à jour avec succès', 'success');

    } catch (error) {
      this.showNotification(error.message || 'Erreur lors de la mise à jour', 'error');
      emailInput.value = this.currentUser.email;
    } finally {
      const saveBtn = document.getElementById('saveEmailBtn');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Sauvegarder';
    }
  }

  async uploadQuote() {
    const fileInput = document.getElementById('quoteFile');
    const file = fileInput.files[0];
    
    if (!file) {
      this.showNotification('Veuillez sélectionner un fichier', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('quote', file);

    try {
      const uploadBtn = event.target;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Téléchargement...';

      await api.request('/auth/upload-quote', {
        method: 'POST',
        body: formData
      });

      this.showNotification('Devis téléchargé avec succès', 'success');
      this.loadProfile(); // Reload to show the new file

    } catch (error) {
      this.showNotification(error.message || 'Erreur lors du téléchargement', 'error');
    } finally {
      const uploadBtn = event.target;
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Télécharger le devis';
      fileInput.value = '';
    }
  }

  async uploadSpecifications() {
    const fileInput = document.getElementById('specificationsFile');
    const file = fileInput.files[0];
    
    if (!file) {
      this.showNotification('Veuillez sélectionner un fichier', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('specifications', file);

    try {
      const uploadBtn = event.target;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Téléchargement...';

      await api.request('/auth/upload-specifications', {
        method: 'POST',
        body: formData
      });

      this.showNotification('Cahier des charges téléchargé avec succès', 'success');
      this.loadProfile(); // Reload to show the new file

    } catch (error) {
      this.showNotification(error.message || 'Erreur lors du téléchargement', 'error');
    } finally {
      const uploadBtn = event.target;
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Télécharger le cahier des charges';
      fileInput.value = '';
    }
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
      notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
    } else {
      notification.style.backgroundColor = '#17a2b8';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  // New methods for enhanced functionality
  filterProjects() {
    const searchTerm = document.getElementById('projectSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('projectStatusFilter')?.value || '';
    
    let filtered = this.projects;
    
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchTerm) ||
        (project.description && project.description.toLowerCase().includes(searchTerm))
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(project => project.status === statusFilter);
    }
    
    this.displayProjects(filtered);
  }

  sortProjects() {
    const sortBy = document.getElementById('projectSortBy')?.value || 'name';
    
    let sorted = [...this.projects];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'status':
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }
    
    this.displayProjects(sorted);
  }

  setProjectView(viewType) {
    const gridBtn = document.getElementById('gridView');
    const listBtn = document.getElementById('listView');
    const container = document.getElementById('projectsList');
    
    if (viewType === 'grid') {
      gridBtn?.classList.add('active');
      listBtn?.classList.remove('active');
      container?.classList.remove('list-view');
      container?.classList.add('grid-view');
    } else {
      listBtn?.classList.add('active');
      gridBtn?.classList.remove('active');
      container?.classList.remove('grid-view');
      container?.classList.add('list-view');
    }
    
    this.renderProjectsGrid();
  }

  displayProjects(projects) {
    const container = document.getElementById('projectsList');
    
    // Update stats
    const totalEl = document.getElementById('totalProjects');
    const activeEl = document.getElementById('activeProjects');
    const completedEl = document.getElementById('completedProjects');
    
    if (totalEl) totalEl.textContent = projects.length;
    if (activeEl) activeEl.textContent = projects.filter(p => p.status === 'active').length;
    if (completedEl) completedEl.textContent = projects.filter(p => p.status === 'completed').length;
    
    // Render projects
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <p>Aucun projet trouvé</p>
        </div>
      `;
      return;
    }

    container.innerHTML = projects.map(project => `
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
            <div class="project-stat-number">${project.active_ticket_count || 0}</div>
            <div class="project-stat-label">Actifs</div>
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
          <button class="btn btn-secondary btn-sm" onclick="clientApp.viewProjectTickets(${project.id})">
            Voir les tickets
          </button>
        </div>
      </div>
    `).join('');
  }

  filterTickets() {
    const searchTerm = document.getElementById('ticketSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('ticketStatusFilter')?.value || '';
    const priorityFilter = document.getElementById('ticketPriorityFilter')?.value || '';
    const categoryFilter = document.getElementById('ticketCategoryFilter')?.value || '';
    
    let filtered = this.tickets;
    
    if (searchTerm) {
      filtered = filtered.filter(ticket => 
        ticket.title.toLowerCase().includes(searchTerm) ||
        ticket.description.toLowerCase().includes(searchTerm)
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }
    
    if (priorityFilter) {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(ticket => ticket.category === categoryFilter);
    }
    
    this.displayTickets(filtered);
  }

  clearTicketFilters() {
    document.getElementById('ticketSearch').value = '';
    document.getElementById('ticketStatusFilter').value = '';
    document.getElementById('ticketPriorityFilter').value = '';
    document.getElementById('ticketCategoryFilter').value = '';
    
    this.displayTickets(this.tickets);
    this.showNotification('Filtres effacés', 'info');
  }

  displayTickets(tickets) {
    const container = document.getElementById('ticketsList');
    
    // Update summary stats
    const urgentEl = document.getElementById('urgentTickets');
    const openEl = document.getElementById('openTickets');
    const pendingEl = document.getElementById('pendingResponse');
    const resolvedEl = document.getElementById('resolvedTickets');
    
    if (urgentEl) urgentEl.textContent = tickets.filter(t => t.priority === 'urgent').length;
    if (openEl) openEl.textContent = tickets.filter(t => t.status === 'open').length;
    if (pendingEl) pendingEl.textContent = tickets.filter(t => t.status === 'waiting_client').length;
    if (resolvedEl) resolvedEl.textContent = tickets.filter(t => t.status === 'resolved').length;
    
    // Update tab counts
    document.querySelectorAll('.ticket-tab').forEach(tab => {
      const tabType = tab.dataset.tab;
      let count = tickets.length;
      
      switch (tabType) {
        case 'open':
          count = tickets.filter(t => t.status === 'open').length;
          break;
        case 'waiting':
          count = tickets.filter(t => t.status === 'waiting_client').length;
          break;
        case 'resolved':
          count = tickets.filter(t => t.status === 'resolved').length;
          break;
      }
      
      const tabText = tab.textContent.replace(/\(\d+\)/, `(${count})`);
      tab.textContent = tabText;
    });
    
    if (tickets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎫</div>
          <p>Aucun ticket trouvé</p>
          <button class="btn btn-primary" onclick="clientApp.showNewTicketModal()">Créer un nouveau ticket</button>
        </div>
      `;
      return;
    }

    container.innerHTML = tickets.map(ticket => `
      <div class="ticket-item ${ticket.status}" onclick="clientApp.viewTicket(${ticket.id})">
        <div class="ticket-header">
          <div class="ticket-title-section">
            <div class="ticket-title">${ticket.title}</div>
            <div class="ticket-project">📁 ${ticket.project_name}</div>
          </div>
          <div class="ticket-badges">
            <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
            <span class="status-badge ${api.getStatusClass(ticket.status)}">
              <span class="status-indicator"></span>
              ${api.formatStatus(ticket.status)}
            </span>
          </div>
        </div>
        
        <div class="ticket-description">${ticket.description}</div>
        
        <div class="ticket-meta">
          <div class="ticket-dates">
            <span>Créé le ${api.formatDate(ticket.created_at)}</span>
            ${ticket.updated_at !== ticket.created_at ? `<span>Mis à jour le ${api.formatDate(ticket.updated_at)}</span>` : ''}
          </div>
          <div class="ticket-actions">
            <button class="btn-action btn-view" onclick="event.stopPropagation(); clientApp.viewTicket(${ticket.id})">
              👁️ Voir
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  switchProfileTab(tabName) {
    // Update tab navigation
    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content sections
    document.querySelectorAll('.profile-content-section').forEach(section => {
      section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetSection) {
      targetSection.classList.add('active');
    }
    
    // Load specific data if needed
    if (tabName === 'info') {
      this.loadProfile();
    }
  }

  switchTicketTab(tabName) {
    // Update tab navigation
    document.querySelectorAll('.ticket-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Filter tickets based on tab
    let filtered = this.tickets;
    
    switch (tabName) {
      case 'open':
        filtered = this.tickets.filter(t => t.status === 'open');
        break;
      case 'waiting':
        filtered = this.tickets.filter(t => t.status === 'waiting_client');
        break;
      case 'resolved':
        filtered = this.tickets.filter(t => t.status === 'resolved');
        break;
      // 'all' shows all tickets
    }
    
    this.displayTickets(filtered);
  }

  setupDynamicEventListeners() {
    // This method is called after DOM updates to rebind event listeners
    // for dynamically created elements
    
    // Remove existing listeners to avoid duplicates (using event delegation instead)
    document.removeEventListener('click', this.handleDelegatedClicks);
    
    // Use event delegation for dynamic elements
    this.handleDelegatedClicks = (e) => {
      const target = e.target;
      
      // New ticket buttons
      if (target.id === 'newTicketBtn' || target.id === 'newTicketBtn2' || target.id === 'quickNewTicket') {
        e.preventDefault();
        this.showNewTicketModal();
        return;
      }
      
      // Quick action buttons
      if (target.id === 'quickViewProjects') {
        e.preventDefault();
        this.switchTab('projects');
        return;
      }
      
      if (target.id === 'quickProfile') {
        e.preventDefault();
        this.switchTab('profile');
        return;
      }
      
      // View toggle buttons
      if (target.id === 'gridView') {
        e.preventDefault();
        this.setProjectView('grid');
        return;
      }
      
      if (target.id === 'listView') {
        e.preventDefault();
        this.setProjectView('list');
        return;
      }
      
      // Clear filters button
      if (target.id === 'clearFilters') {
        e.preventDefault();
        this.clearTicketFilters();
        return;
      }
      
      // Refresh tickets button
      if (target.id === 'refreshTickets') {
        e.preventDefault();
        this.loadTickets();
        return;
      }
      
      // Profile tabs
      if (target.classList.contains('profile-tab')) {
        e.preventDefault();
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchProfileTab(tabName);
        }
        return;
      }
      
      // Ticket tabs
      if (target.classList.contains('ticket-tab')) {
        e.preventDefault();
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTicketTab(tabName);
        }
        return;
      }
      
      // Save email button
      if (target.id === 'saveEmailBtn') {
        e.preventDefault();
        this.saveEmail();
        return;
      }
      
      // File upload buttons
      if (target.onclick && target.onclick.toString().includes('uploadQuote')) {
        e.preventDefault();
        this.uploadQuote();
        return;
      }
      
      if (target.onclick && target.onclick.toString().includes('uploadSpecifications')) {
        e.preventDefault();
        this.uploadSpecifications();
        return;
      }
    };
    
    // Bind the delegated click handler
    document.addEventListener('click', this.handleDelegatedClicks);
  }


}

// Initialize client app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.clientApp = new ClientApp();
});