class TicketsApp {
  constructor() {
    this.currentUser = null;
    this.tickets = [];
    this.filteredTickets = [];
    this.projects = [];
    this.currentProjectId = null;
    this.countdownInterval = null;
    this.init();
  }

  init() {
    console.log('TicketsApp: Initializing...');
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
      this.loadTickets();
      this.loadProjects();
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('token');
      window.location.href = '/client/';
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
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.location.href = '/client/profile.html';
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
    document.getElementById('newTicketBtn').addEventListener('click', () => {
      this.showNewTicketModal();
    });

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

    // Status filter
    document.getElementById('ticketStatusFilter').addEventListener('change', () => {
      this.filterTickets();
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

      // View ticket details button
      if (target.classList.contains('view-ticket-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        this.viewTicket(ticketId);
        return;
      }

      // Add comment button
      if (target.classList.contains('add-comment-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        this.addComment(ticketId);
        return;
      }

      // Show comment form button (in modal)
      if (target.classList.contains('show-comment-form-btn')) {
        e.preventDefault();
        const ticketId = parseInt(target.dataset.ticketId);
        this.showCommentForm(ticketId);
        return;
      }

      // Handle spans inside buttons (for styled buttons)
      const parentButton = target.closest('button');
      if (parentButton) {
        // Check if parent button is a modal close button
        if (parentButton.classList.contains('modal-close')) {
          e.preventDefault();
          this.closeModal();
          return;
        }
        
        // Check if parent button is a show comment form button
        if (parentButton.classList.contains('show-comment-form-btn')) {
          e.preventDefault();
          const ticketId = parseInt(parentButton.dataset.ticketId);
          this.showCommentForm(ticketId);
          return;
        }
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
    const statusFilter = document.getElementById('ticketStatusFilter').value;

    this.filteredTickets = this.tickets.filter(ticket => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchTerm) ||
                           (ticket.description && ticket.description.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !statusFilter || ticket.status === statusFilter;
      
      // Filter by selected project
      const matchesProject = !this.currentProjectId || ticket.project_id == this.currentProjectId;

      return matchesSearch && matchesStatus && matchesProject;
    });

    this.renderTickets();
  }

  renderTickets() {
    const container = document.getElementById('ticketsList');
    
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
              ⏱️ ${this.getCountdown(ticket.created_at, ticket.priority)}
            </div>
          </div>
        </div>
        <div class="ticket-details">
          <span class="ticket-project">📁 Projet: ${this.getProjectName(ticket.project_id)}</span>
          <span class="ticket-date">📅 ${api.formatDateTime(ticket.created_at)}</span>
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
        
        countdownElement.innerHTML = `⏱️ ${newCountdown}`;
        countdownElement.className = `countdown-timer ${newClass}`;
      }
    });
  }

  showNewTicketModal() {
    if (this.projects.length === 0) {
      alert('Chargement des projets en cours, veuillez patienter...');
      return;
    }

    const modalHtml = `
      <div class="modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Nouveau Ticket de Support</h2>
            <button class="modal-close">&times;</button>
          </div>
          <form id="newTicketForm" class="form">
            <div class="form-group">
              <label class="form-label" for="ticketProject">Projet concerné *</label>
              <select id="ticketProject" name="project_id" class="form-select" required>
                <option value="">-- Sélectionner un projet --</option>
                ${this.projects.map(project => 
                  `<option value="${project.id}">${project.name}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketTitle">Titre du ticket *</label>
              <input type="text" id="ticketTitle" name="title" class="form-input" 
                     placeholder="Ex: Problème de connexion, Nouvelle fonctionnalité..." required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketDescription">Description *</label>
              <textarea id="ticketDescription" name="description" class="form-textarea" 
                        rows="5" placeholder="Décrivez brièvement votre demande" required></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="ticketPriority">Priorité *</label>
              <select id="ticketPriority" name="priority" class="form-select" required>
                <option value="normal">🔵 Normale - Dans les temps</option>
                <option value="high">🟡 Haute - Urgent</option>
                <option value="urgent">🔴 Urgente - Critique</option>
                <option value="low">⚪ Basse - Quand possible</option>
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
      'open': '🟢',
      'in_progress': '🟡',
      'waiting_client': '🔵',
      'resolved': '✅',
      'closed': '⚫'
    };
    return icons[status] || '❓';
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
      'low': '⚪',
      'normal': '🔵',
      'high': '🟡',
      'urgent': '🔴'
    };
    return icons[priority] || '❓';
  }

  getTimeAgo(dateString) {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now - created) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}min`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else {
      return `${diffInDays}j`;
    }
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
              <h2>🎫 Ticket #${ticket.id}</h2>
              <p class="modal-subtitle">${ticket.title}</p>
            </div>
            <button class="modal-close">&times;</button>
          </div>
          
          <div class="modal-body">
            <div class="ticket-detail-grid">
              <div class="detail-section">
                <h3 class="section-title">📋 Informations</h3>
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
                      ⏱️ ${this.getCountdown(ticket.created_at, ticket.priority)}
                    </span>
                  </div>
                </div>
              </div>

              <div class="description-section">
                <h3 class="section-title">📝 Description initiale</h3>
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
                  💬 Ajouter un commentaire
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
              <h2>💬 Ajouter un commentaire</h2>
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
                      <span class="help-text" style="color: #6c757d; font-size: 13px;">💡 Plus vous donnez de détails, plus nous pourrons vous aider efficacement</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="form-footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9;">
                <div class="form-actions" style="display: flex; gap: 15px; justify-content: flex-end;">
                  <button type="submit" class="btn btn-primary btn-large" style="padding: 12px 24px; font-size: 14px;">
                    📤 Publier le commentaire
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
          <h3 class="section-title">💬 Commentaires</h3>
          <div class="empty-comments">
            <div class="empty-icon">💬</div>
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
              <span class="author-icon">${comment.author_name === this.currentUser.email ? '👤' : '🛠️'}</span>
              <span class="author-name">${comment.author_name === this.currentUser.email ? 'Vous' : 'Support'}</span>
            </div>
            <div class="comment-date">${api.formatDateTime(comment.created_at)}</div>
          </div>
          <div class="comment-message">${comment.content}</div>
        </div>
      `).join('');

      container.innerHTML = `
        <h3 class="section-title">💬 Commentaires (${comments.length})</h3>
        <div class="comments-list">
          ${commentsHtml}
        </div>
      `;
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
      return new Date(dateString).toLocaleDateString('fr-FR');
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing TicketsApp');
  window.ticketsApp = new TicketsApp();
});