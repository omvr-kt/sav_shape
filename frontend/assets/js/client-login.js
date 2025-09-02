class LoginApp {
  constructor() {
    this.init();
  }

  init() {
    console.log('LoginApp: Initializing...');
    this.checkExistingAuth();
    this.setupEventListeners();
  }

  checkExistingAuth() {
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (tokenData.exp && tokenData.exp > currentTime) {
          // Token still valid, redirect to tickets
          window.location.href = '/client/tickets.html';
          return;
        } else {
          // Token expired, remove it
          localStorage.removeItem('token');
        }
      } catch (error) {
        // Invalid token, remove it
        localStorage.removeItem('token');
      }
    }
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  }

  async handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = document.querySelector('button[type="submit"]');

    // Reset error state
    errorDiv.style.display = 'none';
    
    // Disable submit button during login
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      const response = await api.login(email, password);
      
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        window.location.href = '/client/tickets.html';
      } else {
        errorDiv.textContent = response.message;
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorDiv.textContent = 'Erreur de connexion. Veuillez vérifier vos identifiants.';
      errorDiv.style.display = 'block';
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing LoginApp');
  window.loginApp = new LoginApp();
});