/**
 * Kanban Dev Interface
 * Gestion des tâches avec drag & drop
 */

class KanbanManager {
  constructor() {
    this.currentUser = null;
    this.currentProject = null;
    this.tasks = {};
    this.projects = [];
    this.sortableInstances = {};
    this.mentions = [];
    
    this.init();
  }

  async init() {
    try {
      // Vérifier l'authentification
      this.currentUser = await this.getCurrentUser();
      if (!this.currentUser) {
        window.location.href = '/connexion.html';
        return;
      }

      // Mettre à jour l'interface utilisateur
      this.updateUserInterface();
      
      // Charger les projets
      await this.loadProjects();
      
      // Si l'utilisateur est développeur, afficher uniquement la vue Kanban
      if (this.currentUser.role === 'developer') {
        // Masquer la vue d'accueil et les vues admin
        const welcome = document.getElementById('welcomeView');
        if (welcome) welcome.style.display = 'none';
        this.hideAdminViews();

        // Sélectionner automatiquement le premier projet assigné s'il existe
        const firstProject = (this.projects || []).find(p => p.status === 'active') || (this.projects || [])[0];
        if (firstProject) {
          await this.selectProject(firstProject.id);
        } else {
          // Aucun projet assigné: afficher un message minimal sans autre navigation
          const title = document.getElementById('projectTitle');
          if (title) title.textContent = 'Aucun projet assigné';
        }
      }
      
      // Charger les mentions non lues
      await this.loadUnreadMentions();
      
      // Initialiser les événements
      this.setupEventListeners();
      
      // Gérer l'URL pour le projet sélectionné
      this.handleUrlParams();
      
    } catch (error) {
      console.error('Kanban initialization error:', error);
      this.showError('Initialization error');
    }
  }

  async getCurrentUser() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }
      
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('API auth/me response:', result);
        return result.success ? result.data.user : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  updateUserInterface() {
    document.getElementById('currentUser').textContent = 
      `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    document.getElementById('currentUserRole').textContent = 
      this.currentUser.role === 'admin' ? 'Administrator' : 'Developer';
    
    // Afficher les sections admin si nécessaire
    if (this.currentUser.role === 'admin') {
      document.getElementById('adminSection').style.display = 'block';
    }
    
    // Mettre à jour l'avatar
    const avatar = document.getElementById('sidebarUserAvatar');
    avatar.textContent = this.currentUser.first_name.charAt(0).toUpperCase();
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/dev/projects', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.projects = result.data;
        this.renderProjectsList();
        this.updateQuickStats();
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }

  renderProjectsList() {
    const container = document.getElementById('projectsList');
    
    if (this.projects.length === 0) {
      container.innerHTML = '<div class="no-projects">No assigned projects</div>';
      return;
    }
    
    const activeProjects = this.projects.filter(p => p.status === 'active');
    
    container.innerHTML = activeProjects.map(project => `
      <a href="#" class="project-item" data-project-id="${project.id}">
        <div class="project-name">${this.escapeHtml(project.name)}</div>
        <div class="project-code">${this.escapeHtml(project.code || '')}</div>
      </a>
    `).join('');
  }

  async loadUnreadMentions() {
    try {
      const response = await fetch('/api/dev/mentions/unread', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.mentions = result.data;
        this.updateMentionsBadge();
      }
    } catch (error) {
      console.error('Error loading mentions:', error);
    }
  }

  updateMentionsBadge() {
    const badge = document.getElementById('mentionsBadge');
    const count = document.getElementById('mentionsCount');
    
    if (this.mentions.length > 0) {
      count.textContent = this.mentions.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  async updateQuickStats() {
    try {
      // Compter les tâches actives dans tous les projets
      let totalTasks = 0;
      let urgentTasks = 0;
      
      for (const project of this.projects) {
        const response = await fetch(`/api/dev/projects/${project.id}/tasks`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
          const result = await response.json();
          const activeTasks = result.data.filter(t => t.status !== 'done');
          totalTasks += activeTasks.length;
          urgentTasks += activeTasks.filter(t => t.urgency === 'urgent').length;
        }
      }
      
      document.getElementById('totalProjects').textContent = this.projects.length;
      document.getElementById('totalTasks').textContent = totalTasks;
      document.getElementById('urgentTasks').textContent = urgentTasks;
      
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  setupEventListeners() {
    // Navigation projets (clic sur item ou bouton data-action)
    document.addEventListener('click', (e) => {
      const projectItem = e.target.closest('.project-item');
      if (projectItem) {
        e.preventDefault();
        const projectId = projectItem.dataset.projectId;
        if (projectId) this.selectProject(projectId);
        return;
      }
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'select-project') {
          e.preventDefault();
          const pid = actionBtn.dataset.projectId;
          if (pid) this.selectProject(pid);
        } else if (action === 'archive-project') {
          e.preventDefault();
          const pid = actionBtn.dataset.projectId;
          if (pid) this.archiveProject(pid);
        } else if (action === 'restore-project') {
          e.preventDefault();
          const pid = actionBtn.dataset.projectId;
          if (pid) this.restoreProject(pid);
        } else if (action === 'edit-description') {
          e.preventDefault();
          this.editTaskDescription();
        } else if (action === 'toggle-upload') {
          e.preventDefault();
          this.showUploadArea();
        } else if (action === 'browse-files') {
          e.preventDefault();
          document.getElementById('fileInput')?.click();
        } else if (action === 'send-comment') {
          e.preventDefault();
          this.addComment();
        } else if (action === 'close-modal') {
          e.preventDefault();
          this.closeTaskModal();
        } else if (action === 'assign-dev') {
          e.preventDefault();
          const uid = actionBtn.dataset.userId;
          // Récupérer la valeur du select frère
          const selector = actionBtn.parentElement?.querySelector('.project-selector');
          const selectedProject = selector?.value;
          if (uid && selectedProject) {
            this.assignToProject(uid, selectedProject);
          } else {
            this.showError('Select a project to assign');
          }
        }
      }
      // Ouvrir la fiche tâche via carte
      const taskCard = e.target.closest('.task-card');
      if (taskCard && taskCard.dataset.taskId) {
        e.preventDefault();
        this.openTaskDetail(taskCard.dataset.taskId);
      }
    });

    // Actions admin
    document.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) {
        e.preventDefault();
        this.handleAdminAction(action);
      }
    });

    // New Task
    document.getElementById('createTaskBtn').addEventListener('click', () => {
      this.showCreateTaskModal();
    });

    // Fermeture du panneau détail
    document.getElementById('closeTaskDetail').addEventListener('click', () => {
      this.closeTaskDetail();
    });

    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    // Keyboard handling (global)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // If mention suggestions are open, first close them and do not close the panel
        const suggestions = document.getElementById('mentionSuggestions');
        if (suggestions && suggestions.style.display !== 'none') {
          this.hideMentionSuggestions();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Do not close when typing inside inputs/textareas/contenteditable within the panel
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
          return;
        }
        this.closeTaskDetail();
      }
    });
  }

  handleUrlParams() {
    // Gérer les paramètres de hash (#project=id)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    let projectId = hashParams.get('project');
    
    // Fallback vers les paramètres de requête (?project=id)
    if (!projectId) {
      const urlParams = new URLSearchParams(window.location.search);
      projectId = urlParams.get('project');
    }
    
    if (projectId) {
      // Attendre que les projets soient chargés avant de sélectionner
      this.waitForProjectsAndSelect(projectId);
    }
  }

  async waitForProjectsAndSelect(projectId) {
    // Attendre que les projets soient chargés
    let attempts = 0;
    const maxAttempts = 10;
    
    const trySelect = () => {
      if (this.projects && this.projects.length > 0) {
        this.selectProject(projectId);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(trySelect, 100);
      }
    };
    
    trySelect();
  }

  async selectProject(projectId) {
    try {
      const project = this.projects.find(p => p.id == projectId);
      if (!project) return;

      this.currentProject = project;
      
      // Mettre à jour l'URL avec le hash
      const url = new URL(window.location);
      url.hash = `project=${projectId}`;
      window.history.pushState({}, '', url);
      
      // Mettre à jour l'interface
      document.getElementById('projectTitle').textContent = `${project.name} - Dev`;
      document.getElementById('createTaskBtn').style.display = 'block';
      // Bouton paramètres projet réservé aux admins
      if (this.currentUser.role === 'admin') {
        document.getElementById('projectSettingsBtn').style.display = 'block';
      } else {
        document.getElementById('projectSettingsBtn').style.display = 'none';
      }
      
      // Mettre à jour la navigation
      document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
      });
      document.querySelector(`[data-project-id="${projectId}"]`)?.classList.add('active');
      
      // Afficher le Kanban
      document.getElementById('welcomeView').style.display = 'none';
      document.getElementById('kanbanView').style.display = 'flex';
      this.hideAdminViews();
      
      // Charger les tâches
      await this.loadTasks(projectId);
      
      // Initialiser le drag & drop
      this.setupDragAndDrop();
      
    } catch (error) {
      console.error('Project selection error:', error);
      this.showError('Error loading project');
    }
  }

  async loadTasks(projectId) {
    try {
      this.showLoading(true);
      
      const response = await fetch(`/api/dev/projects/${projectId}/tasks`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.tasks = this.groupTasksByStatus(result.data);
        this.renderKanbanBoard();
      } else {
        throw new Error('Error loading tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.showError('Error loading tasks');
    } finally {
      this.showLoading(false);
    }
  }

  groupTasksByStatus(tasks) {
    const grouped = {
      todo_back: [],
      todo_front: [],
      in_progress: [],
      ready_for_review: [],
      done: []
    };
    
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    
    // Trier par due_at, urgence, puis date de création
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => {
        // D'abord par due_at
        const dateA = new Date(a.due_at);
        const dateB = new Date(b.due_at);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        
        // Puis par urgence
        const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const urgencyA = urgencyOrder[a.urgency] || 3;
        const urgencyB = urgencyOrder[b.urgency] || 3;
        if (urgencyA !== urgencyB) {
          return urgencyA - urgencyB;
        }
        
        // Enfin par date de création
        return new Date(a.created_at) - new Date(b.created_at);
      });
    });
    
    return grouped;
  }

  renderKanbanBoard() {
    Object.keys(this.tasks).forEach(status => {
      const column = document.getElementById(`column-${status}`);
      const countElement = document.getElementById(`count-${status}`);
      
      countElement.textContent = this.tasks[status].length;
      
      column.innerHTML = this.tasks[status].map(task => this.renderTaskCard(task)).join('');
    });
  }

  renderTaskCard(task) {
    const dueDate = new Date(task.due_at);
    const now = new Date();
    const timeRemaining = dueDate - now;
    const isOverdue = timeRemaining < 0;
    const isWarning = timeRemaining < 24 * 60 * 60 * 1000; // 24h
    
    let countdownText = '';
    let countdownClass = '';
    
    if (isOverdue) {
      countdownText = 'En retard';
      countdownClass = 'overdue';
    } else if (isWarning) {
      const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
      countdownText = `${hours}h restantes`;
      countdownClass = 'warning';
    } else {
      const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
      countdownText = `${days}j restants`;
    }
    
    const indicators = [];
    if (task.attachment_count > 0) {
      indicators.push(`<span class="task-indicator has-attachments">📎 ${task.attachment_count}</span>`);
    }
    if (task.comment_count > 0) {
      indicators.push(`<span class="task-indicator has-comments">💬 ${task.comment_count}</span>`);
    }
    
    return `
      <div class="task-card" data-task-id="${task.id}">
        <div class="task-card-header">
          <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
          <span class="task-urgency ${task.urgency}">${task.urgency}</span>
        </div>
        
        ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
        
        <div class="task-meta">
          <div class="task-due-date ${isOverdue ? 'overdue' : isWarning ? 'warning' : ''}">
            <span>📅 ${this.formatDate(dueDate)}</span>
          </div>
          <div class="task-countdown ${countdownClass}">
            ${countdownText}
          </div>
        </div>
        
        ${indicators.length > 0 ? `<div class="task-indicators">${indicators.join('')}</div>` : ''}
      </div>
    `;
  }

  setupDragAndDrop() {
    // Détruire les instances existantes
    Object.values(this.sortableInstances).forEach(instance => {
      if (instance && instance.destroy) {
        instance.destroy();
      }
    });
    this.sortableInstances = {};
    
    // Créer une instance Sortable pour chaque colonne (avec fallback natif si Sortable indisponible)
    const statuses = ['todo_back', 'todo_front', 'in_progress', 'ready_for_review', 'done'];
    
    if (typeof Sortable !== 'undefined') {
      statuses.forEach(status => {
        const column = document.getElementById(`column-${status}`);
        if (column) {
          this.sortableInstances[status] = Sortable.create(column, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'dragging',
          
          onStart: (evt) => {
            document.body.classList.add('dragging');
          },
          
          onEnd: (evt) => {
            document.body.classList.remove('dragging');
            
            // Si la tâche a changé de colonne
            if (evt.from !== evt.to) {
              const taskId = evt.item.dataset.taskId;
              const newStatus = evt.to.id.replace('column-', '');
              this.moveTask(taskId, newStatus);
            }
          },
          
          onMove: (evt) => {
            // Permettre le déplacement entre toutes les colonnes
            return true;
          }
          });
        }
      });
    } else {
      // Fallback: HTML5 Drag & Drop natif
      statuses.forEach(status => {
        const column = document.getElementById(`column-${status}`);
        if (!column) return;
        column.addEventListener('dragover', (e) => { e.preventDefault(); });
        column.addEventListener('drop', (e) => {
          e.preventDefault();
          const taskId = e.dataTransfer.getData('text/plain');
          const item = document.querySelector(`.task-card[data-task-id="${taskId}"]`);
          if (!item) return;
          if (item.parentElement !== column) {
            column.appendChild(item);
            const newStatus = column.id.replace('column-', '');
            this.moveTask(taskId, newStatus);
          }
        });
      });
      // Rendre les cartes draggables
      document.querySelectorAll('.task-card').forEach(card => {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', card.dataset.taskId);
          document.body.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
          document.body.classList.remove('dragging');
        });
      });
    }
  }

  async moveTask(taskId, newStatus) {
    try {
      this.showLoading(true);
      
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        // Recharger les tâches pour synchroniser
        await this.loadTasks(this.currentProject.id);
        this.showSuccess('Task moved successfully');
      } else {
        throw new Error('Error while moving');
      }
    } catch (error) {
      console.error('Task move error:', error);
      this.showError('Error while moving task');
      // Recharger pour annuler le déplacement visuel
      await this.loadTasks(this.currentProject.id);
    } finally {
      this.showLoading(false);
    }
  }

  async openTaskDetail(taskId) {
    try {
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.renderTaskDetail(result.data);
        document.getElementById('taskDetailPanel').classList.add('open');
      }
    } catch (error) {
      console.error('Error opening task detail:', error);
      this.showError('Error opening details');
    }
  }

  renderTaskDetail(task) {
    const content = document.getElementById('taskDetailContent');
    document.getElementById('taskDetailTitle').textContent = task.title;
    this.currentTaskDetail = task;
    
    content.innerHTML = `
      <div class="task-detail-tabs">
        <button class="tab-btn active" data-tab="details">Details</button>
        <button class="tab-btn" data-tab="attachments">Attachments</button>
        <button class="tab-btn" data-tab="comments">Comments</button>
        <button class="tab-btn" data-tab="activity">Activity</button>
      </div>
      
      <div class="task-detail-content">
        <div id="detailsTab" class="tab-content active">
          <div class="task-detail-section">
            <h4>Description</h4>
            <div class="description-content">
              <p id="taskDescription">${task.description || 'No description'}</p>
              <button class="btn btn-sm btn-secondary" data-action="edit-description">
                ✏️ Edit
              </button>
            </div>
          </div>
          
          <div class="task-detail-section">
            <h4>Information</h4>
            <div class="task-info">
              <div><strong>Urgency:</strong> <span class="task-urgency ${task.urgency}">${this.getUrgencyLabel(task.urgency)}</span></div>
              <div><strong>Status:</strong> ${this.getStatusLabel(task.status)}</div>
              <div><strong>Start:</strong> ${this.formatDateTime(task.start_at)}</div>
              <div><strong>Due:</strong> ${this.formatDateTime(task.due_at)}</div>
              <div><strong>Created by:</strong> ${task.creator_first_name} ${task.creator_last_name}</div>
              ${task.updater_first_name ? `<div><strong>Updated by:</strong> ${task.updater_first_name} ${task.updater_last_name}</div>` : ''}
            </div>
          </div>
          
          ${task.linked_tickets?.length > 0 ? `
            <div class="task-detail-section">
              <h4>Linked tickets</h4>
              <div class="linked-tickets">
                ${task.linked_tickets.map(ticket => `
                  <div class="linked-ticket">
                    <span class="ticket-number">#${ticket.ticket_number}</span>
                    <span class="ticket-title">${this.escapeHtml(ticket.title)}</span>
                    <span class="ticket-status status-${ticket.status}">${ticket.status}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div id="attachmentsTab" class="tab-content">
          <div class="task-detail-section">
            <div class="section-header">
              <h4>Attachments</h4>
              <button class="btn btn-primary btn-sm" data-action="toggle-upload">
                📎 Add
              </button>
            </div>
            
            <div id="uploadArea" class="upload-area" style="display: none;">
              <div class="upload-zone" id="uploadZone">
                <div class="upload-icon">📁</div>
                <p>Drag and drop your files here or click to select</p>
                <input type="file" id="fileInput" multiple style="display: none;">
                <button class="btn btn-secondary btn-sm" data-action="browse-files">Browse</button>
              </div>
            </div>
            
            <div id="attachmentsList" class="attachments-list">
              ${this.renderAttachments(task.attachments || [])}
            </div>
          </div>
        </div>
        
        <div id="commentsTab" class="tab-content">
          <div class="task-detail-section">
            <h4>Comments</h4>
            
            <div class="comment-form">
              <div class="comment-input-wrapper">
                <textarea id="commentInput" placeholder="Type your comment... Use @name to mention someone" 
                  rows="3" class="comment-textarea"></textarea>
                <div id="mentionSuggestions" class="mention-suggestions" style="display: none;"></div>
              </div>
              <div class="comment-actions">
                <button class="btn btn-primary btn-sm" data-action="send-comment">Send</button>
              </div>
            </div>
            
            <div id="commentsList" class="comments-list">
              <div class="loading-comments">Loading comments...</div>
            </div>
          </div>
        </div>
        
        <div id="activityTab" class="tab-content">
          <div class="task-detail-section">
            <h4>Activity history</h4>
            <div id="activityList" class="activity-list">
              <div class="loading-activity">Loading activity...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.setupTaskDetailEvents();
    this.loadTaskComments(task.id);
    this.loadTaskActivity(task.id);
  }

  closeTaskDetail() {
    document.getElementById('taskDetailPanel').classList.remove('open');
  }

  setupTaskDetailEvents() {
    // Gestion des onglets
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTaskDetailTab(tabName);
      });
    });
    
    // Setup upload drag & drop
    this.setupUploadDragDrop();
    
    // Setup mention autocomplete
    this.setupMentionAutocomplete();

    // Attachments actions delegation
    const attachmentsList = document.getElementById('attachmentsList');
    if (attachmentsList) {
      attachmentsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'download-attachment' && id) {
          this.downloadAttachment(id);
        } else if (btn.dataset.action === 'delete-attachment' && id) {
          this.deleteAttachment(id);
        }
      });
    }

    // Comment actions delegation
    const commentsList = document.getElementById('commentsList');
    if (commentsList) {
      commentsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'edit-comment' && id) {
          this.editComment(id);
        } else if (btn.dataset.action === 'delete-comment' && id) {
          this.deleteComment(id);
        }
      });
    }
  }

  switchTaskDetailTab(tabName) {
    // Retirer active de tous les boutons et contenus
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activer le bon onglet
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  getUrgencyLabel(urgency) {
    const labels = {
      'urgent': 'Urgent',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return labels[urgency] || urgency;
  }

  renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) {
      return '<div class="no-attachments">No attachments</div>';
    }
    
    return attachments.map(attachment => `
      <div class="attachment-item" data-id="${attachment.id}">
        <div class="attachment-info">
          <span class="attachment-icon">📎</span>
          <div class="attachment-details">
            <div class="attachment-name">${this.escapeHtml(attachment.filename)}</div>
            <div class="attachment-meta">
              ${this.formatFileSize(attachment.size)} • 
              Added by ${attachment.uploader_first_name} ${attachment.uploader_last_name} • 
              ${this.formatDateTime(attachment.created_at)}
            </div>
          </div>
        </div>
        <div class="attachment-actions">
          <button class="btn btn-sm btn-secondary" data-action="download-attachment" data-id="${attachment.id}">💾 Download</button>
          <button class="btn btn-sm btn-danger" data-action="delete-attachment" data-id="${attachment.id}">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  setupUploadDragDrop() {
    // Utiliser un délai pour que les éléments soient rendus
    setTimeout(() => {
      const uploadZone = document.getElementById('uploadZone');
      const fileInput = document.getElementById('fileInput');
      
      console.log('Setup upload drag drop:', { 
        uploadZone: !!uploadZone, 
        fileInput: !!fileInput, 
        currentTask: !!this.currentTaskDetail,
        taskId: this.currentTaskDetail?.id 
      });
      
      if (!uploadZone || !fileInput) {
        console.warn('Upload elements not found, retrying in 500ms');
        // Retry si les éléments ne sont pas encore créés
        setTimeout(() => this.setupUploadDragDrop(), 500);
        return;
      }
      
      // Supprimer les anciens listeners pour éviter les doublons
      const newUploadZone = uploadZone.cloneNode(true);
      const newFileInput = fileInput.cloneNode(true);
      uploadZone.parentNode.replaceChild(newUploadZone, uploadZone);
      fileInput.parentNode.replaceChild(newFileInput, fileInput);
      
      // Rendre la zone cliquable aussi
      newUploadZone.addEventListener('click', () => {
        console.log('Click on upload zone');
        newFileInput.click();
      });
      
      newUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newUploadZone.classList.add('drag-over');
        console.log('Drag over detected');
      });
      
      newUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newUploadZone.classList.remove('drag-over');
        console.log('Drag leave detected');
      });
      
      newUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newUploadZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        console.log('Drop detected - Files:', files.map(f => f.name));
        if (files.length > 0 && this.currentTaskDetail) {
          this.uploadFiles(files);
        } else {
          console.warn('No files or no selected task');
        }
      });
      
      newFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        console.log('Files selected:', files.map(f => f.name));
        this.uploadFiles(files);
      });
    }, 100);
  }

  showUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.style.display = uploadArea.style.display === 'none' ? 'block' : 'none';
      // Reconfigurer le drag & drop quand la zone devient visible
      if (uploadArea.style.display === 'block') {
        this.setupUploadDragDrop();
      }
    }
  }

  async uploadFiles(files) {
    console.log('uploadFiles called with:', files.length, 'files');
    console.log('Current task:', this.currentTaskDetail?.id);
    
    if (!this.currentTaskDetail) {
      console.error('No task selected');
      this.showError('Please select a task');
      return;
    }
    
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.innerHTML = '<div class="uploading">Uploading...</div>';
    }
    
    try {
      for (const file of files) {
        console.log('Uploading file:', file.name);
        await this.uploadFile(file);
      }
      
      // Recharger les pièces jointes
      await this.refreshTaskAttachments();
      this.showSuccess('Files uploaded successfully');
      
    } catch (error) {
      console.error('Upload error:', error);
      this.showError(`Upload error: ${error.message}`);
    }
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('attachment', file); // Correction: 'attachment' au lieu de 'file'
    
    console.log('Upload file:', file.name, 'size:', file.size);
    
    const response = await fetch(`/api/dev/tasks/${this.currentTaskDetail.id}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Upload error response:', error);
      throw new Error(`Upload error: ${response.status}`);
    }
    
    return response.json();
  }

  async refreshTaskAttachments() {
    if (!this.currentTaskDetail) return;
    
    try {
      const response = await fetch(`/api/dev/tasks/${this.currentTaskDetail.id}/attachments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const attachmentsList = document.getElementById('attachmentsList');
        if (attachmentsList) {
          attachmentsList.innerHTML = this.renderAttachments(result.data);
        }
        // Réinitialiser la zone d'upload
        this.resetUploadArea();
      }
    } catch (error) {
      console.error('Error refreshing attachments:', error);
    }
  }

  resetUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.innerHTML = `
        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📁</div>
                <p>Drag and drop your files here or click to select</p>
          <input type="file" id="fileInput" multiple style="display: none;">
                <button class="btn btn-secondary btn-sm" data-action="browse-files">Browse</button>
        </div>
      `;
      uploadArea.style.display = 'none';
      // Reconfigurer le drag & drop après avoir recréé le HTML
      setTimeout(() => {
        this.setupUploadDragDrop();
      }, 50);
    }
  }

  async downloadAttachment(attachmentId) {
    try {
      const response = await fetch(`/api/dev/attachments/${attachmentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download error:', error);
      this.showError('Error during download');
    }
  }

  async deleteAttachment(attachmentId) {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    
    try {
      const response = await fetch(`/api/dev/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await this.refreshTaskAttachments();
        this.showSuccess('Pièce jointe supprimée');
      }
    } catch (error) {
      console.error('Delete error:', error);
      this.showError('Error during deletion');
    }
  }

  // Gestion des commentaires et mentions
  setupMentionAutocomplete() {
    const commentInput = document.getElementById('commentInput');
    if (!commentInput) return;

    this.currentMentionQuery = '';
    this.mentionStartPos = -1;

    commentInput.addEventListener('input', (e) => {
      this.handleCommentInput(e);
    });

    commentInput.addEventListener('keydown', (e) => {
      // Prevent bubbling to global handlers (e.g., Escape)
      e.stopPropagation();
      // Gérer d'abord les mentions
      this.handleCommentKeydown(e);

      // Si Ctrl+Entrée ou Cmd+Entrée, envoyer le commentaire
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.addComment();
      }
    });
  }

  handleCommentInput(e) {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const text = input.value;
    
    // Chercher le dernier @ avant le curseur
    let mentionStart = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        // Vérifier qu'il n'y a pas d'espace avant
        if (i === 0 || text[i-1] === ' ' || text[i-1] === '\n') {
          mentionStart = i;
          break;
        }
      } else if (text[i] === ' ' || text[i] === '\n') {
        break;
      }
    }
    
    if (mentionStart !== -1) {
      this.mentionStartPos = mentionStart;
      this.currentMentionQuery = text.substring(mentionStart + 1, cursorPos);
      this.showMentionSuggestions();
    } else {
      this.hideMentionSuggestions();
    }
  }

  handleCommentKeydown(e) {
    const suggestions = document.getElementById('mentionSuggestions');
    if (!suggestions || suggestions.style.display === 'none') return;

    const activeSuggestion = suggestions.querySelector('.suggestion-item.active');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = activeSuggestion ? activeSuggestion.nextElementSibling : suggestions.firstElementChild;
      if (next) {
        if (activeSuggestion) activeSuggestion.classList.remove('active');
        next.classList.add('active');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = activeSuggestion ? activeSuggestion.previousElementSibling : suggestions.lastElementChild;
      if (prev) {
        if (activeSuggestion) activeSuggestion.classList.remove('active');
        prev.classList.add('active');
      }
    } else if (e.key === 'Enter') {
      // Si on appuie sur Entrée avec une suggestion active, l'insérer
      if (activeSuggestion) {
        e.preventDefault();
        const userId = activeSuggestion.dataset.userId;
        const userName = activeSuggestion.dataset.userName;
        this.insertMention(userId, userName);
      } else {
        // Sinon, fermer les suggestions et permettre l'envoi du commentaire
        this.hideMentionSuggestions();
        // Ne pas empêcher le comportement par défaut pour permettre l'envoi
      }
    } else if (e.key === 'Escape') {
      this.hideMentionSuggestions();
      e.stopPropagation();
    }
  }

  async showMentionSuggestions() {
    if (!this.currentMentionQuery) {
      this.hideMentionSuggestions();
      return;
    }
    
    try {
      // Charger les utilisateurs du projet
      const users = await this.getProjectUsers();
      const filtered = users.filter(user => 
        user.first_name.toLowerCase().includes(this.currentMentionQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(this.currentMentionQuery.toLowerCase())
      );
      
      this.renderMentionSuggestions(filtered);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async getProjectUsers() {
    if (!this.currentProject) return [];
    
    // Use members endpoint (admins + assigned developers)
    const response = await fetch(`/api/dev/projects/${this.currentProject.id}/members`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.data || [];
    }
    
    return [];
  }

  renderMentionSuggestions(users) {
    const suggestions = document.getElementById('mentionSuggestions');
    if (!suggestions) return;
    
    if (users.length === 0) {
      this.hideMentionSuggestions();
      return;
    }
    
    const escapeAttr = (s) => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    suggestions.innerHTML = users.map((user, index) => {
      const fullName = `${user.first_name} ${user.last_name}`;
      const safeName = escapeAttr(fullName);
      const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`;
      return `
      <div class="suggestion-item ${index === 0 ? 'active' : ''}" 
           data-user-id="${user.id}" 
           data-user-name="${safeName}">
        <div class="user-avatar">${escapeAttr(initials)}</div>
        <div class="user-info">
          <div class="user-name">${safeName}</div>
          <div class="user-role">${escapeAttr(user.role)}</div>
        </div>
      </div>`;
    }).join('');

    // Delegate click to avoid inline handlers and quoting issues
    suggestions.onclick = (ev) => {
      const item = ev.target.closest('.suggestion-item');
      if (!item) return;
      const userId = Number(item.dataset.userId);
      const userName = item.dataset.userName;
      this.insertMention(userId, userName);
    };
    
    suggestions.style.display = 'block';
  }

  hideMentionSuggestions() {
    const suggestions = document.getElementById('mentionSuggestions');
    if (suggestions) {
      suggestions.style.display = 'none';
    }
  }

  insertMention(userId, userName) {
    const input = document.getElementById('commentInput');
    if (!input) return;
    
    const text = input.value;
    const before = text.substring(0, this.mentionStartPos);
    const after = text.substring(input.selectionStart);
    
    const mentionText = `@${userName}`;
    const newText = before + mentionText + ' ' + after;
    
    input.value = newText;
    input.focus();
    
    const newCursorPos = before.length + mentionText.length + 1;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    this.hideMentionSuggestions();
    
    // Stocker la mention pour l'envoi
    if (!this.pendingMentions) this.pendingMentions = [];
    this.pendingMentions.push({
      userId: userId,
      userName: userName
    });
  }

  async addComment() {
    const input = document.getElementById('commentInput');
    if (!input || !input.value.trim()) return;
    
    const body = input.value.trim();
    const mentions = this.extractMentions(body);
    
    try {
      const response = await fetch(`/api/dev/tasks/${this.currentTaskDetail.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          body: body,
          mentions: mentions.map(m => m.userId)
        })
      });
      
      if (response.ok) {
        input.value = '';
        this.pendingMentions = [];
        await this.loadTaskComments(this.currentTaskDetail.id);
        this.showSuccess('Commentaire ajouté');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      this.showError('Error adding comment');
    }
  }

  extractMentions(text) {
    const mentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      // Trouver l'utilisateur correspondant dans les mentions en attente
      const pendingMention = this.pendingMentions?.find(m => 
        m.userName === mentionedName
      );
      if (pendingMention) {
        mentions.push(pendingMention);
      }
    }
    
    return mentions;
  }

  async loadTaskComments(taskId) {
    try {
      console.log('Loading comments for task:', taskId);
      
      const response = await fetch(`/api/dev/tasks/${taskId}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('Réponse commentaires:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Commentaires reçus:', result);
        this.renderComments(result.data || []);
      } else {
        const error = await response.text();
        console.error('Comments API error:', error);
        this.renderComments([]);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      this.renderComments([]);
    }
  }

  renderComments(comments) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    if (comments.length === 0) {
      commentsList.innerHTML = '<div class="no-comments">No comments</div>';
      return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
      <div class="comment-item" data-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-author">
            <div class="author-avatar">${comment.author_first_name[0]}${comment.author_last_name[0]}</div>
            <div class="author-info">
              <div class="author-name">${comment.author_first_name} ${comment.author_last_name}</div>
              <div class="comment-date">${this.formatDateTime(comment.created_at)}</div>
            </div>
          </div>
          <div class="comment-actions">
            ${comment.can_edit ? `<button class="btn-link" data-action="edit-comment" data-id="${comment.id}">Edit</button>` : ''}
            ${comment.can_delete ? `<button class="btn-link text-danger" data-action="delete-comment" data-id="${comment.id}">Delete</button>` : ''}
          </div>
        </div>
        <div class="comment-body">
          ${this.formatCommentBody(comment.body)}
        </div>
        ${comment.edited ? '<div class="comment-edited">Edited</div>' : ''}
      </div>
    `).join('');
  }

  formatCommentBody(body) {
    // Convertir les @mentions en liens
    return body.replace(/@([^@\s]+(?:\s+[^@\s]+)*)/g, '<span class="mention">@$1</span>');
  }

  async editComment(commentId) {
    // TODO: Implémenter l'édition de commentaire
    console.log('Edit comment:', commentId);
  }

  async deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const response = await fetch(`/api/dev/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await this.loadTaskComments(this.currentTaskDetail.id);
        this.showSuccess('Commentaire supprimé');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      this.showError('Error during deletion');
    }
  }

  async loadTaskActivity(taskId) {
    try {
      console.log('Loading activity for task:', taskId);
      
      const response = await fetch(`/api/dev/tasks/${taskId}/activity`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('Activity response:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Activity data received:', result);
        this.renderActivity(result.data || []);
      } else {
        const error = await response.text();
        console.error('Activity API error:', error);
        this.renderActivity([]);
      }
    } catch (error) {
      console.error('Error loading activity:', error);
      this.renderActivity([]);
    }
  }

  renderActivity(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    if (activities.length === 0) {
      activityList.innerHTML = '<div class="no-activity">No activity</div>';
      return;
    }
    
    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">${this.getActivityIcon(activity.action)}</div>
        <div class="activity-content">
          <div class="activity-description">
            <strong>${activity.actor_first_name} ${activity.actor_last_name}</strong>
            ${this.getActivityDescription(activity.action, activity.payload_json)}
          </div>
          <div class="activity-date">${this.formatDateTime(activity.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  getActivityIcon(action) {
    const icons = {
      'created': '✨',
      'updated': '📝',
      'deleted': '🗑️',
      'attachment_added': '📎',
      'attachment_removed': '🗑️',
      'status_changed': '🔄',
      'comment_added': '💬'
    };
    return icons[action] || '📝';
  }

  getActivityDescription(action, payloadJson) {
    const payload = JSON.parse(payloadJson || '{}');
    
    switch (action) {
      case 'created':
        return 'a créé la tâche';
      case 'updated':
        return `a modifié la tâche`;
      case 'deleted':
        return 'a supprimé la tâche';
      case 'attachment_added':
        return `a ajouté la pièce jointe "${payload.filename}"`;
      case 'attachment_removed':
        return `a supprimé la pièce jointe "${payload.filename}"`;
      case 'status_changed':
        return `a changé le statut de "${payload.from}" vers "${payload.to}"`;
      case 'comment_added':
        return 'a ajouté un commentaire';
      default:
        return 'a effectué une action';
    }
  }

  async editTaskDescription() {
    if (!this.currentTaskDetail) return;
    
    const currentDesc = this.currentTaskDetail.description || '';
    const newDesc = prompt('Edit description:', currentDesc);
    
    if (newDesc !== null && newDesc !== currentDesc) {
      try {
        const response = await fetch(`/api/dev/tasks/${this.currentTaskDetail.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ description: newDesc })
        });
        
        if (response.ok) {
          this.currentTaskDetail.description = newDesc;
          document.getElementById('taskDescription').textContent = newDesc || 'No description';
          this.showSuccess('Description updated');
          await this.loadTaskActivity(this.currentTaskDetail.id);
        }
      } catch (error) {
        console.error('Description update error:', error);
        this.showError('Error during update');
      }
    }
  }

  showCreateTaskModal(task = null) {
    const isEdit = !!task;
    const modalTitle = isEdit ? 'Edit Task' : 'New Task';
    
    // Vérifier qu'un projet est sélectionné
    if (!this.currentProject) {
      alert('Please select a project to create a task.');
      return;
    }
    
    const modalHtml = `
      <div class="modal-overlay" id="taskModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${modalTitle}</h3>
            <button class="modal-close" data-action="close-modal">&times;</button>
          </div>
          
          <form id="taskForm" class="modal-body">
            <div class="form-group">
              <label for="taskTitle">Title *</label>
              <input type="text" id="taskTitle" name="title" value="${isEdit ? this.escapeHtml(task.title) : ''}" required>
            </div>
            
            <div class="form-group">
              <label for="taskDescription">Description</label>
              <textarea id="taskDescription" name="description" rows="3">${isEdit ? this.escapeHtml(task.description || '') : ''}</textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="taskUrgency">Urgency *</label>
                <select id="taskUrgency" name="urgency" required>
                  <option value="low" ${isEdit && task.urgency === 'low' ? 'selected' : ''}>Low (96h)</option>
                  <option value="medium" ${isEdit && task.urgency === 'medium' ? 'selected' : ''}>Medium (72h)</option>
                  <option value="high" ${isEdit && task.urgency === 'high' ? 'selected' : ''}>High (48h)</option>
                  <option value="urgent" ${isEdit && task.urgency === 'urgent' ? 'selected' : ''}>Urgent (24h)</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="taskStatus">Status *</label>
                <select id="taskStatus" name="status" required>
                  <option value="todo_back" ${isEdit && task.status === 'todo_back' ? 'selected' : ''}>To-do Back</option>
                  <option value="todo_front" ${isEdit && task.status === 'todo_front' ? 'selected' : ''}>To-do Front</option>
                  <option value="in_progress" ${isEdit && task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                  <option value="ready_for_review" ${isEdit && task.status === 'ready_for_review' ? 'selected' : ''}>Ready for Review</option>
                  <option value="done" ${isEdit && task.status === 'done' ? 'selected' : ''}>Done</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label for="taskStartDate">Start date</label>
              <input type="datetime-local" id="taskStartDate" name="start_at" 
                     value="${isEdit ? this.formatDateTimeLocal(task.start_at) : this.formatDateTimeLocal(new Date())}">
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
              <button type="submit" class="btn btn-primary">
                ${isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modalHtml;
    
    // Gérer la soumission du formulaire
    document.getElementById('taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (isEdit) {
        this.updateTask(task.id);
      } else {
        this.createTask();
      }
    });
    
    // Focus on title
    setTimeout(() => {
      document.getElementById('taskTitle').focus();
    }, 100);
  }

  closeTaskModal() {
    document.getElementById('modalContainer').innerHTML = '';
  }

  async createTask() {
    try {
      this.showLoading(true);
      
      const form = document.getElementById('taskForm');
      if (!form) {
        throw new Error('Form not found');
      }
      
      const formData = new FormData(form);
      const taskData = {};
      
      // Traiter les données du formulaire
      for (let [key, value] of formData.entries()) {
        taskData[key] = value; // Laisser JSON.stringify gérer l'échappement
      }
      
      console.log('Données tâche à envoyer:', taskData);
      
      const response = await fetch(`/api/dev/projects/${this.currentProject.id}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        await this.loadTasks(this.currentProject.id);
        this.closeTaskModal();
        this.showSuccess('Task created successfully');
      } else {
        const error = await response.json();
        console.error('API error:', error);
        this.showError(error.message || 'Error during creation');
      }
    } catch (error) {
      console.error('Task creation error:', error);
      this.showError('Error while creating task');
    } finally {
      this.showLoading(false);
    }
  }

  async updateTask(taskId) {
    try {
      this.showLoading(true);
      
      const formData = new FormData(document.getElementById('taskForm'));
      const taskData = Object.fromEntries(formData.entries());
      
      const response = await fetch(`/api/dev/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.ok) {
        await this.loadTasks(this.currentProject.id);
        this.closeTaskModal();
        this.showSuccess('Task updated successfully');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Error while updating');
      }
    } catch (error) {
      console.error('Task update error:', error);
      this.showError('Error while updating task');
    } finally {
      this.showLoading(false);
    }
  }

  formatDateTimeLocal(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  hideAdminViews() {
    document.getElementById('allProjectsView').style.display = 'none';
    document.getElementById('archivedProjectsView').style.display = 'none';
    document.getElementById('manageDevelopersView').style.display = 'none';
  }

  handleAdminAction(action) {
    // Bloquer toute action admin pour les non-admins
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      return;
    }
    this.hideAdminViews();
    document.getElementById('kanbanView').style.display = 'none';
    document.getElementById('welcomeView').style.display = 'none';
    
    // Désélectionner le projet actuel
    document.querySelectorAll('.project-item').forEach(item => {
      item.classList.remove('active');
    });
    
    document.getElementById('projectTitle').textContent = this.getAdminActionTitle(action);
    document.getElementById('createTaskBtn').style.display = 'none';
    document.getElementById('projectSettingsBtn').style.display = 'none';
    
    switch (action) {
      case 'all-projects':
        document.getElementById('allProjectsView').style.display = 'block';
        this.loadAllProjects();
        break;
      case 'archived-projects':
        document.getElementById('archivedProjectsView').style.display = 'block';
        this.loadArchivedProjects();
        break;
      case 'manage-developers':
        document.getElementById('manageDevelopersView').style.display = 'block';
        this.loadDevelopersManagement();
        break;
    }
  }

  getAdminActionTitle(action) {
    const titles = {
      'all-projects': 'All projects',
      'archived-projects': 'Projets archivés', 
      'manage-developers': 'Gestion des développeurs'
    };
    return titles[action] || 'Administration';
  }

  async loadAllProjects() {
    try {
      const response = await fetch('/api/dev/projects?status=active', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Error while loading projects');
      
      const result = await response.json();
      const projects = result.data || [];
      
      this.renderAllProjects(projects);
      
    } catch (error) {
      console.error('loadAllProjects error:', error);
      document.getElementById('allProjectsList').innerHTML = 
        '<div class="error">Error while loading projects</div>';
    }
  }
  
  renderAllProjects(projects) {
    const container = document.getElementById('allProjectsList');
    
    // Hide the "New Task" button because no specific project is selected
    document.getElementById('createTaskBtn').style.display = 'none';
    document.getElementById('projectSettingsBtn').style.display = 'none';
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="info">No active projects found</div>';
      return;
    }
    
    const html = `
      <div class="projects-management">
        <div class="projects-grid">
          ${projects.map(project => `
            <div class="project-card" data-project-id="${project.id}">
              <div class="project-header">
                <h3>${this.escapeHtml(project.name)}</h3>
                <span class="project-code">${this.escapeHtml(project.code)}</span>
              </div>
              
              <div class="project-stats">
                <div class="stat">
                  <span class="stat-value">${project.task_count || 0}</span>
                  <span class="stat-label">Tasks</span>
                </div>
                <div class="stat">
                  <span class="stat-value">${project.developer_count || 0}</span>
                  <span class="stat-label">Developers</span>
                </div>
              </div>
              
              <div class="project-dates">
                <p>Créé le ${this.formatDate(project.created_at)}</p>
                ${project.updated_at !== project.created_at ? 
                  `<p>Updated on ${this.formatDate(project.updated_at)}</p>` : ''
                }
              </div>
              
              <div class="project-actions">
                <button class="btn btn-primary" data-action="select-project" data-project-id="${project.id}">
                  Voir les tâches
                </button>
                <button class="btn btn-warning" data-action="archive-project" data-project-id="${project.id}">
                  Archiver
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }

  async loadArchivedProjects() {
    try {
      const response = await fetch('/api/dev/projects?status=archived', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Error while loading archived projects');
      
      const result = await response.json();
      const projects = result.data || [];
      
      this.renderArchivedProjects(projects);
      
    } catch (error) {
      console.error('loadArchivedProjects error:', error);
      document.getElementById('archivedProjectsList').innerHTML = 
        '<div class="error">Error while loading archived projects</div>';
    }
  }
  
  renderArchivedProjects(projects) {
    const container = document.getElementById('archivedProjectsList');
    
    // Hide the "New Task" button because no specific project is selected
    document.getElementById('createTaskBtn').style.display = 'none';
    document.getElementById('projectSettingsBtn').style.display = 'none';
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="info">No archived projects found</div>';
      return;
    }
    
    const html = `
      <div class="projects-management">
        <div class="projects-grid">
          ${projects.map(project => `
            <div class="project-card archived" data-project-id="${project.id}">
              <div class="archived-badge">Archivé</div>
              
              <div class="project-header">
                <h3>${this.escapeHtml(project.name)}</h3>
                <span class="project-code">${this.escapeHtml(project.code)}</span>
              </div>
              
              <div class="project-stats">
                <div class="stat">
                  <span class="stat-value">${project.task_count || 0}</span>
                  <span class="stat-label">Tasks</span>
                </div>
                <div class="stat">
                  <span class="stat-value">${project.developer_count || 0}</span>
                  <span class="stat-label">Developers</span>
                </div>
              </div>
              
              <div class="project-dates">
                <p>Créé le ${this.formatDate(project.created_at)}</p>
                ${project.archived_at ? 
                  `<p>Archivé le ${this.formatDate(project.archived_at)}</p>` : ''
                }
              </div>
              
              <div class="project-actions">
                <button class="btn btn-secondary" data-action="select-project" data-project-id="${project.id}" disabled>
                  Lecture seule
                </button>
                <button class="btn btn-success" data-action="restore-project" data-project-id="${project.id}">
                  Restaurer
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }

  async loadDevelopersManagement() {
    try {
      // Charger la liste des développeurs
      const response = await fetch('/api/dev/developers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) throw new Error('Error while loading developers');
      
      const result = await response.json();
      const developers = result.data || [];
      
      // Charger aussi la liste des projets actifs pour les assignations
      const projectsResponse = await fetch('/api/dev/projects?status=active', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      let projects = [];
      if (projectsResponse.ok) {
        const projectsResult = await projectsResponse.json();
        projects = projectsResult.data || [];
      }
      
      this.renderDevelopersManagement(developers, projects);
      
    } catch (error) {
      console.error('loadDevelopersManagement error:', error);
      document.getElementById('developersList').innerHTML = 
        '<div class="error">Error while loading developers</div>';
    }
  }
  
  renderDevelopersManagement(developers, projects) {
    const container = document.getElementById('developersList');
    
    // Hide the "New Task" button because no specific project is selected
    document.getElementById('createTaskBtn').style.display = 'none';
    document.getElementById('projectSettingsBtn').style.display = 'none';
    
    if (developers.length === 0) {
      container.innerHTML = '<div class="info">No developers found</div>';
      return;
    }
    
    const html = `
      <div class="developers-management">
        <div class="developers-grid">
          ${developers.map(dev => `
            <div class="developer-card" data-user-id="${dev.id}">
              <div class="developer-header">
                <div class="developer-avatar">${dev.first_name.charAt(0)}</div>
                <div class="developer-info">
                  <h3>${dev.first_name} ${dev.last_name}</h3>
                  <p class="developer-email">${dev.email}</p>
                  <span class="developer-status ${dev.is_active ? 'active' : 'inactive'}">
                    ${dev.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
              
              <div class="developer-projects">
                <h4>Projets assignés (${dev.project_count || 0})</h4>
                <div class="assigned-projects">
                  ${dev.assigned_projects ? 
                    dev.assigned_projects.split(',').map(project => 
                      `<span class="project-tag">${project.trim()}</span>`
                    ).join('') : 
        '<span class="no-projects">No assigned projects</span>'
                  }
                </div>
              </div>
              
              <div class="developer-actions">
                <select class="project-selector" data-user-id="${dev.id}">
                  <option value="">Assign to a project...</option>
                  ${projects.map(project => 
                    `<option value="${project.id}">${project.name}</option>`
                  ).join('')}
                </select>
                <button class="btn-assign" data-action="assign-dev" data-user-id="${dev.id}">Assign</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }
  
  async assignToProject(userId) {
    const selector = document.querySelector(`select[data-user-id="${userId}"]`);
    const projectId = selector.value;
    
    if (!projectId) {
      this.showError('Please select a project');
      return;
    }
    
    try {
      const response = await fetch(`/api/dev/projects/${projectId}/developers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (response.ok) {
        this.showSuccess('Developer assigned to project');
        this.loadDevelopersManagement(); // Recharger la liste
      } else {
        const error = await response.json();
        this.showError(error.message || 'Error while assigning');
      }
    } catch (error) {
      console.error('Assignation error:', error);
      this.showError('Error while assigning');
    }
  }

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/connexion.html';
  }

  // Utilitaires
  getStatusLabel(status) {
    const labels = {
      todo_back: 'To-do Back',
      todo_front: 'To-do Front', 
      in_progress: 'In Progress',
      ready_for_review: 'Ready for Review',
      done: 'Done'
    };
    return labels[status] || status;
  }

  formatDate(date) {
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Europe/Paris'
      });
    } catch (e) { return String(date); }
  }

  formatDateTime(datetime) {
    try {
      return new Date(datetime).toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris'
      });
    } catch (e) { return String(datetime); }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }

  showNotification(message, type = 'info') {
    // Simple notification toast (peut être amélioré)
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 3000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#0369a1'};
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  async archiveProject(projectId) {
    if (!confirm('Are you sure you want to archive this project? It will become read-only.')) {
        return;
    }

    try {
        const response = await fetch(`/api/dev/projects/${projectId}/archive`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error while archiving project');
        }

        this.showNotification('Project archived successfully', 'success');
        
        // Recharger les listes de projets
        this.loadAllProjects();
        this.loadArchivedProjects();
        
    } catch (error) {
        console.error('archiveProject error:', error);
        this.showNotification('Error while archiving project', 'error');
    }
  }

  async restoreProject(projectId) {
    if (!confirm('Are you sure you want to restore this project?')) {
        return;
    }

    try {
        const response = await fetch(`/api/dev/projects/${projectId}/restore`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error while restoring project');
        }

        this.showNotification('Project restored successfully', 'success');
        
        // Recharger les listes de projets
        this.loadAllProjects();
        this.loadArchivedProjects();
        this.loadProjects(); // Recharger aussi la sidebar
        
    } catch (error) {
        console.error('restoreProject error:', error);
        this.showNotification('Error while restoring project', 'error');
    }
  }
}

// Initialiser le gestionnaire Kanban
let kanbanManager;

document.addEventListener('DOMContentLoaded', () => {
  kanbanManager = new KanbanManager();
});

// Styles pour les notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  .task-detail-section {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .task-detail-section h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .task-info > div {
    margin-bottom: 8px;
  }
  
  .linked-tickets, .attachments {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .linked-ticket, .attachment {
    padding: 8px 12px;
    background: var(--surface-color);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .ticket-status {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    background: #f3f4f6;
    color: #6b7280;
  }
  
  .no-projects, .info {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
  }
`;
document.head.appendChild(style);
