class App {
  constructor() {
    this.init();
  }

  init() {
    this.setupRouting();
    this.setupEventListeners();
  }

  setupRouting() {
    const path = window.location.pathname;
    
    if (path === '/client' || path.startsWith('/client')) {
      this.loadClientApp();
    } else if (path === '/admin' || path.startsWith('/admin')) {
      this.loadAdminApp();
    }
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('a[href^="/"]')) {
        e.preventDefault();
        const href = e.target.getAttribute('href');
        this.navigate(href);
      }
    });

    window.addEventListener('popstate', () => {
      this.setupRouting();
    });
  }

  navigate(path) {
    history.pushState(null, '', path);
    this.setupRouting();
  }

  loadClientApp() {
    window.location.href = '/client/index.html';
  }

  loadAdminApp() {
    window.location.href = '/admin/index.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});