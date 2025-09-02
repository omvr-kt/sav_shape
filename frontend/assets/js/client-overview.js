class OverviewApp {
  constructor() {
    this.currentUser = null;
    this.projects = [];
    this.tickets = [];
    this.init();
  }

  init() {
    console.log('OverviewApp: Initializing...');
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
      this.loadStats();
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('token');
      window.location.href = '/client/';
    }
  }

  loadUserInfo() {
    const userNameEl = document.getElementById('currentUser');
    if (userNameEl && this.currentUser) {
      userNameEl.textContent = this.currentUser.email;
    }
  }

  setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Navigation tabs - let them work as normal links, no preventDefault
    // The URLs will change naturally and load the correct pages
  }

  async loadStats() {
    try {
      // Load projects and tickets data
      const [projectsResponse, ticketsResponse] = await Promise.all([
        api.getProjects({ client_id: this.currentUser.id }),
        api.getTickets({ client_id: this.currentUser.id })
      ]);

      this.projects = projectsResponse.data.projects;
      this.tickets = ticketsResponse.data.tickets;

      // Update statistics
      const activeProjects = this.projects.filter(p => p.status === 'active');
      const openTickets = this.tickets.filter(t => t.status === 'open');
      const inProgressTickets = this.tickets.filter(t => t.status === 'in_progress');
      const currentMonth = new Date().toISOString().slice(0, 7);
      const resolvedTickets = this.tickets.filter(t => 
        t.status === 'resolved' && 
        t.updated_at?.startsWith(currentMonth)
      );

      // Update DOM elements
      document.getElementById('projectCount').textContent = activeProjects.length;
      document.getElementById('openTickets').textContent = openTickets.length;
      document.getElementById('pendingTickets').textContent = inProgressTickets.length;
      document.getElementById('resolvedTickets').textContent = resolvedTickets.length;

      // Load dashboard sections
      this.renderActiveProjects();
      this.renderRecentTickets();

    } catch (error) {
      console.error('Stats load error:', error);
      document.getElementById('projectCount').textContent = '?';
      document.getElementById('openTickets').textContent = '?';
      document.getElementById('pendingTickets').textContent = '?';
      document.getElementById('resolvedTickets').textContent = '?';
    }
  }

  renderActiveProjects() {
    const container = document.getElementById('activeProjectsList');
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
          <span>${this.formatDate(project.created_at)}</span>
        </div>
      </div>
    `).join('');
  }

  renderRecentTickets() {
    const container = document.getElementById('recentTicketsList');
    const recentTickets = this.tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    
    if (recentTickets.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun ticket récent</div>';
      return;
    }

    container.innerHTML = recentTickets.map(ticket => `
      <div class="ticket-overview-item">
        <div class="ticket-overview-title">#${ticket.id} - ${ticket.title}</div>
        <div class="ticket-overview-meta">
          <span class="ticket-status-${ticket.status}">${this.getStatusLabel(ticket.status)}</span>
          <span>${this.formatDate(ticket.created_at)}</span>
        </div>
      </div>
    `).join('');
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

  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  }

  handleLogout() {
    localStorage.removeItem('token');
    window.location.href = '/client/';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing OverviewApp');
  window.overviewApp = new OverviewApp();
});