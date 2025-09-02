class AdminApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'dashboard';
    this.init();
  }

  init() {
    this.checkAuth();
    this.setupEventListeners();
    this.loadDashboard();
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      // Rediriger vers la page de connexion principale
      window.location.href = '/';
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
        window.location.href = '/';
        return;
      }

      this.showMainApp();
    } catch (error) {
      console.error('Profile load error:', error);
      // Token invalide, rediriger vers la connexion
      localStorage.removeItem('token');
      window.location.href = '/';
    }
  }

  showMainApp() {
    document.getElementById('mainApp').style.display = 'block';
    
    document.getElementById('currentUser').textContent = 
      `${this.currentUser.first_name} ${this.currentUser.last_name}`;
  }

  setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Refresh buttons
    document.getElementById('refreshTickets')?.addEventListener('click', () => {
      this.loadTickets();
    });

    // Add buttons
    document.getElementById('addProjectBtn')?.addEventListener('click', () => {
      this.showAddProjectModal();
    });

    document.getElementById('addClientBtn')?.addEventListener('click', () => {
      this.showAddClientModal();
    });

    // Filters
    document.getElementById('statusFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });

    document.getElementById('priorityFilter')?.addEventListener('change', () => {
      this.loadTickets();
    });
  }


  async logout() {
    await api.logout();
    this.currentUser = null;
    window.location.href = '/';
  }

  switchTab(tabName) {
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
    }
  }

  async loadDashboard() {
    try {
      const [statsResponse, overdueResponse, recentResponse] = await Promise.all([
        api.getTicketStats(),
        api.getOverdueTickets(),
        api.getTickets({ limit: 5 })
      ]);

      const stats = statsResponse.data.stats;
      
      // Update stats cards
      document.getElementById('totalTickets').textContent = stats.total;
      document.getElementById('urgentTickets').textContent = 
        (await api.getTickets({ priority: 'urgent', status: 'open' })).data.tickets.length;
      document.getElementById('overdueTickets').textContent = stats.overdue;
      document.getElementById('resolvedTickets').textContent = stats.resolved;

      // Update overdue tickets
      this.renderOverdueTickets(overdueResponse.data.tickets);

      // Update recent tickets
      this.renderRecentTickets(recentResponse.data.tickets.slice(0, 5));

    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }

  renderOverdueTickets(tickets) {
    const container = document.getElementById('overdueTicketsList');
    
    if (tickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket en retard 🎉</div>';
      return;
    }

    container.innerHTML = tickets.map(ticket => `
      <div class="ticket-item">
        <div class="ticket-title">${ticket.title}</div>
        <div class="ticket-meta">
          <span>${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</span>
          <div class="ticket-badges">
            <span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span>
            <span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span>
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
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎫</div><p>Aucun ticket trouvé</p></div>';
      return;
    }

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
          ${tickets.map(ticket => `
            <tr>
              <td>${ticket.title}</td>
              <td>${ticket.client_company || ticket.client_first_name + ' ' + ticket.client_last_name}</td>
              <td>${ticket.project_name}</td>
              <td><span class="status-badge ${api.getPriorityClass(ticket.priority)}">${api.formatPriority(ticket.priority)}</span></td>
              <td><span class="status-badge ${api.getStatusClass(ticket.status)}">${api.formatStatus(ticket.status)}</span></td>
              <td>${this.formatSLACountdown(ticket)}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-view" data-ticket-id="${ticket.id}" data-action="view">👁️ Voir</button>
                  <button class="btn-action btn-edit" data-ticket-id="${ticket.id}" data-action="edit">✏️ Éditer</button>
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
      this.renderProjectsTable(response.data.projects);
    } catch (error) {
      console.error('Projects load error:', error);
      container.innerHTML = '<div class="error-message">Erreur lors du chargement des projets</div>';
    }
  }

  renderProjectsTable(projects) {
    const container = document.getElementById('projectsList');
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><p>Aucun projet trouvé</p></div>';
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
                  <button class="btn-action btn-edit" data-project-id="${project.id}" data-action="edit-project">✏️ Éditer</button>
                  <button class="btn-action btn-delete" data-project-id="${project.id}" data-action="delete-project">🗑️ Supprimer</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHTML;
    
    // Event listeners pour les boutons d'action des projets
    const editProjectButtons = document.querySelectorAll('[data-action="edit-project"]');
    const deleteProjectButtons = document.querySelectorAll('[data-action="delete-project"]');
    
    editProjectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = parseInt(e.target.dataset.projectId);
        this.editProject(projectId);
      });
    });
    
    deleteProjectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = parseInt(e.target.dataset.projectId);
        this.deleteProject(projectId);
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
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><p>Aucun client trouvé</p></div>';
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
            <th>Inscrit le</th>
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
              <td>${api.formatDate(client.created_at)}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-edit" data-client-id="${client.id}" data-action="edit-client">✏️ Éditer</button>
                  <button class="btn-action btn-delete" data-client-id="${client.id}" data-action="delete-client">🗑️ Supprimer</button>
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
    const deleteClientButtons = document.querySelectorAll('[data-action="delete-client"]');
    
    editClientButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientId = parseInt(e.target.dataset.clientId);
        this.editClient(clientId);
      });
    });
    
    deleteClientButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const clientId = parseInt(e.target.dataset.clientId);
        this.deleteClient(clientId);
      });
    });
  }


  // Placeholder methods for actions
  async viewTicket(id) {
    try {
      const response = await api.getTicket(id);
      const ticket = response.data.ticket;
      const comments = response.data.comments || [];
      
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
                <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Fermé</option>
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
                    <span class="attachment-icon">📎</span>
                    <a href="/api/attachments/${att.id}" target="_blank" class="attachment-link">
                      ${att.filename}
                    </a>
                    <span class="attachment-size">(${this.formatFileSize(att.size)})</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Commentaires -->
          <div class="ticket-comments">
            <h4>Historique et commentaires (${comments.length})</h4>
            
            <div class="comments-list" id="commentsList">
              ${comments.map(comment => `
                <div class="comment-item ${comment.is_internal ? 'comment-internal' : ''}">
                  <div class="comment-header">
                    <span class="comment-author">${comment.author_name}</span>
                    <span class="comment-date">${api.formatDateTime(comment.created_at)}</span>
                    ${comment.is_internal ? '<span class="internal-badge">Interne</span>' : ''}
                  </div>
                  <div class="comment-content">
                    ${comment.content.replace(/\n/g, '<br>')}
                  </div>
                </div>
              `).join('')}
            </div>
            
            <!-- Ajouter un commentaire -->
            <div class="add-comment-section">
              <h5>Ajouter un commentaire</h5>
              <form id="addCommentForm">
                <div class="form-group">
                  <textarea id="commentContent" name="content" class="form-input" 
                            rows="3" placeholder="Votre commentaire..." required></textarea>
                </div>
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="commentInternal" name="is_internal">
                    Commentaire interne (invisible pour le client)
                  </label>
                </div>
                <div class="form-actions">
                  <button type="button" class="btn btn-secondary cancel-btn" onclick="adminApp.closeModal()">Annuler</button>
                  <button type="submit" class="btn btn-primary">Ajouter le commentaire</button>
                </div>
              </form>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary close-modal-btn">Fermer</button>
            <button type="button" class="btn btn-primary edit-ticket-btn" data-ticket-id="${id}">
              ✏️ Modifier le ticket
            </button>
          </div>
        </div>
      `, 'large');
      
      // Gérer l'ajout de commentaire
      const ticketId = id; // Sauvegarder l'ID du ticket pour le closure
      document.getElementById('addCommentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addComment(ticketId, e.target);
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

  async addComment(ticketId, form) {
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
      submitBtn.disabled = true;
      submitBtn.textContent = 'Ajout en cours...';


      await api.createComment(ticketId, commentData);
      
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
      'open': '🔴 Ouvert',
      'in_progress': '🟡 En cours',
      'waiting_client': '⏳ En attente client',
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
                <option value="low" ${ticket.priority === 'low' ? 'selected' : ''}>🟢 Faible</option>
                <option value="normal" ${ticket.priority === 'normal' ? 'selected' : ''}>🔵 Normale</option>
                <option value="high" ${ticket.priority === 'high' ? 'selected' : ''}>🟠 Élevée</option>
                <option value="urgent" ${ticket.priority === 'urgent' ? 'selected' : ''}>🔴 Urgente</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="editTicketStatus">Statut</label>
              <select id="editTicketStatus" name="status" class="form-input">
                <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>🔴 Ouvert</option>
                <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>🟡 En cours</option>
                <option value="waiting_client" ${ticket.status === 'waiting_client' ? 'selected' : ''}>⏳ En attente client</option>
                <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>✅ Résolu</option>
                <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>⚫ Fermé</option>
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
              <option value="active" ${project.status === 'active' ? 'selected' : ''}>✅ Actif</option>
              <option value="paused" ${project.status === 'paused' ? 'selected' : ''}>⏸️ En pause</option>
              <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>✔️ Terminé</option>
              <option value="archived" ${project.status === 'archived' ? 'selected' : ''}>📦 Archivé</option>
            </select>
          </div>
          
          <div class="form-info">
            <div class="project-stats">
              <h4>Statistiques du projet</h4>
              <div class="stats-row">
                <span>🎫 ${project.ticket_count || 0} tickets total</span>
                <span>🔥 ${project.active_ticket_count || 0} tickets actifs</span>
              </div>
              <p><small>📅 Créé le ${api.formatDate(project.created_at)}</small></p>
            </div>
          </div>
          
          ${project.status !== 'archived' ? `
            <div class="form-warning">
              <p>⚠️ Archiver un projet masquera tous ses tickets associés</p>
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
      const modal = this.createModal('⚠️ Confirmer la suppression du projet', `
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
            <h4>⚠️ Impact de la suppression :</h4>
            <div class="impact-stats">
              <div class="stat-item ${stats.total_tickets > 0 ? 'has-data' : ''}">
                <span class="stat-icon">🎫</span>
                <span class="stat-value">${stats.total_tickets || 0}</span>
                <span class="stat-label">Tickets</span>
              </div>
              <div class="stat-item ${stats.open_tickets > 0 ? 'critical' : ''}">
                <span class="stat-icon">🔥</span>
                <span class="stat-value">${stats.open_tickets || 0}</span>
                <span class="stat-label">Ouverts</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">💬</span>
                <span class="stat-value">Tous</span>
                <span class="stat-label">Commentaires</span>
              </div>
            </div>
            
            ${stats.open_tickets > 0 ? `
              <div class="critical-warning">
                <p>🚨 <strong>ATTENTION :</strong> Ce projet a encore ${stats.open_tickets} ticket(s) ouvert(s) !</p>
                <p>Considérez plutôt l'archivage du projet.</p>
              </div>
            ` : ''}
          </div>
          
          <div class="delete-alternatives">
            <p><strong>Alternatives à la suppression :</strong></p>
            <button type="button" class="btn btn-warning btn-sm archive-project-btn" data-project-id="${id}">
              📦 Archiver le projet à la place
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
              🗑️ Supprimer définitivement
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
      'low': { response: 48, resolution: 168 },     // 2 jours / 1 semaine
      'normal': { response: 24, resolution: 72 },   // 1 jour / 3 jours  
      'high': { response: 8, resolution: 24 },      // 8h / 1 jour
      'urgent': { response: 2, resolution: 8 }      // 2h / 8h
    };
    return defaults[priority]?.[type] || 24;
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
            <label class="form-label" for="editClientQuote">Devis *</label>
            <input type="file" id="editClientQuote" name="quote_file" 
                   class="form-input" accept=".pdf,.doc,.docx" required>
            ${client.quote_file ? `<small>Fichier actuel: <a href="${client.quote_file}" target="_blank">${client.quote_file.split('/').pop()}</a></small>` : '<small class="text-warning">⚠️ Devis obligatoire - aucun fichier téléchargé</small>'}
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editClientSpecifications">Cahier des charges *</label>
            <input type="file" id="editClientSpecifications" name="specifications_file" 
                   class="form-input" accept=".pdf,.doc,.docx" required>
            ${client.specifications_file ? `<small>Fichier actuel: <a href="${client.specifications_file}" target="_blank">${client.specifications_file.split('/').pop()}</a></small>` : '<small class="text-warning">⚠️ Cahier des charges obligatoire - aucun fichier téléchargé</small>'}
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
            <h3>⏱️ Configuration SLA</h3>
            <p><small>Définir les délais de réponse et de résolution selon la priorité</small></p>
            
            ${['low', 'normal', 'high', 'urgent'].map(priority => {
              const sla = slaRules.find(s => s.priority === priority);
              const priorityLabels = {
                'low': '🟢 Faible',
                'normal': '🔵 Normale', 
                'high': '🟠 Élevée',
                'urgent': '🔴 Urgente'
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
            <p><small>📊 ${client.project_count || 0} projets - ${client.ticket_count || 0} tickets</small></p>
            <p><small>📅 Inscrit le ${api.formatDate(client.created_at)}</small></p>
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
      phone: null
    };

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
          const existingRulesResponse = await api.getSLARules({ 
            client_id: clientId, 
            priority: slaRule.priority 
          });
          const existingRule = existingRulesResponse.data.sla_rules?.[0];
          
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

  async deleteClient(id) {
    try {
      // Charger les infos du client pour confirmation
      const response = await api.getUser(id);
      const client = response.data.user;
      
      // Vérifier les dépendances
      const projectsResponse = await api.getProjects({ client_id: id });
      const projects = projectsResponse.data.projects;
      
      // Modal de confirmation détaillée
      const modal = this.createModal('⚠️ Confirmer la suppression', `
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
              <h4>⚠️ Impact de la suppression :</h4>
              <ul>
                <li>🗂️ ${projects.length} projet(s) seront supprimés</li>
                <li>🎫 Tous les tickets associés seront supprimés</li>
                <li>💬 Tous les commentaires seront supprimés</li>
                <li>📎 Toutes les pièces jointes seront supprimées</li>
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
              <p>✅ Ce client n'a aucun projet associé.</p>
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
              🗑️ Supprimer définitivement
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
            <p><small>💡 Une fois le projet créé, vous pourrez y associer des tickets de support.</small></p>
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
                <option value="low">🟢 Faible</option>
                <option value="normal" selected>🔵 Normale</option>
                <option value="high">🟠 Élevée</option>
                <option value="urgent">🔴 Urgente</option>
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
          <label class="form-label" for="clientAddress">Adresse de l'entreprise</label>
          <input type="text" id="clientAddress" name="company_address" 
                 class="form-input" placeholder="123 rue de la Paix, 75001 Paris">
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
                 class="form-input" accept=".pdf,.doc,.docx" required>
          <small>Document de devis obligatoire</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="clientSpecifications">Cahier des charges *</label>
          <input type="file" id="clientSpecifications" name="specifications_file" 
                 class="form-input" accept=".pdf,.doc,.docx" required>
          <small>Document de cahier des charges obligatoire</small>
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
      phone: null, // Champ phone requis par la validation backend même si optionnel
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
        
        // Upload des fichiers si présents
        const quoteFile = formData.get('quote_file');
        const specificationsFile = formData.get('specifications_file');
        
        try {
          if (quoteFile && quoteFile.size > 0) {
            submitBtn.textContent = 'Upload du devis...';
            const quoteFormData = new FormData();
            quoteFormData.append('quote', quoteFile);
            await api.request(`/users/${clientId}/upload-quote`, {
              method: 'POST',
              body: quoteFormData
            });
          }
          
          if (specificationsFile && specificationsFile.size > 0) {
            submitBtn.textContent = 'Upload du cahier des charges...';
            const specsFormData = new FormData();
            specsFormData.append('specifications', specificationsFile);
            await api.request(`/users/${clientId}/upload-specifications`, {
              method: 'POST',
              body: specsFormData
            });
          }
          
          this.showNotification('Client créé avec succès (fichiers uploadés)', 'success');
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          this.showNotification('Client créé mais erreur lors de l\'upload des fichiers', 'warning');
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
    
    // Ajouter event listeners pour fermer le modal
    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtns = modal.querySelectorAll('.cancel-btn');
    const closeModalBtns = modal.querySelectorAll('.close-modal-btn');
    
    if (overlay) overlay.addEventListener('click', () => this.closeModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    
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
      modal.remove();
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

  formatSLACountdown(ticket) {
    if (!ticket.sla_deadline || ticket.status === 'closed' || ticket.status === 'resolved') {
      return '<span class="sla-status sla-none">-</span>';
    }

    const now = api.getCurrentFrenchTime();
    const deadline = new Date(ticket.sla_deadline);
    const diffMs = deadline - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) {
      // SLA dépassé
      const overdue = Math.abs(diffHours);
      return `<span class="sla-status sla-overdue">⚠️ +${overdue}h (dépassé)</span>`;
    } else if (diffHours <= 2) {
      // Attention : moins de 2h restantes
      return `<span class="sla-status sla-warning">🟡 ${diffHours}h ${diffMinutes}min</span>`;
    } else if (diffHours <= 24) {
      // Normal : moins de 24h
      return `<span class="sla-status sla-ok">🟢 ${diffHours}h ${diffMinutes}min</span>`;
    } else {
      // Beaucoup de temps
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      return `<span class="sla-status sla-good">✅ ${days}j ${hours}h</span>`;
    }
  }

  showError(message) {
    this.showNotification(message, 'error');
  }
}

// Initialize admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});