// Logs activés par défaut; utilisez ?debug=1 pour mode verbeux

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
          // Token valide, rediriger selon le rôle
          const userRole = tokenData.role;
          let redirectUrl = '/client/tickets.html';
          
          if (userRole === 'admin' || userRole === 'team') {
            redirectUrl = '/admin/';
          }
          
          console.log(`Utilisateur déjà connecté (${userRole}), redirection vers ${redirectUrl}`);
          window.location.href = redirectUrl;
          return;
        } else {
          // Token expiré, le supprimer
          console.log('Token expiré détecté');
          this.clearStoredAuth();
        }
      } catch (error) {
        // Token invalide, le supprimer
        console.error('Token invalide détecté:', error);
        this.clearStoredAuth();
      }
    }
  }
  
  clearStoredAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
  }

  async handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = document.querySelector('button[type="submit"]');

    // Validation côté client
    if (!email || !password) {
      this.showError('Veuillez saisir votre email et mot de passe', errorDiv);
      return;
    }

    if (!this.validateEmail(email)) {
      this.showError('Format d\'email invalide', errorDiv);
      return;
    }

    // Reset error state
    errorDiv.style.display = 'none';
    
    // Disable submit button during login
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      const response = await api.login(email, password);
      
      if (response && response.success) {
        // Stocker les informations utilisateur
        localStorage.setItem('token', response.data.token);

        // Stocker les données utilisateur sans les fichiers volumineux
        const userForStorage = { ...response.data.user };

        // Supprimer tous les champs de fichiers potentiellement volumineux
        const fileFields = ['quote_file_decrypted', 'confidential_file_decrypted', 'quote_file', 'confidential_file'];
        fileFields.forEach(field => delete userForStorage[field]);

        // Supprimer aussi tout champ qui pourrait contenir des données base64 ou JSON volumineux
        Object.keys(userForStorage).forEach(key => {
            const value = userForStorage[key];
            if (typeof value === 'string' && (
                value.length > 10000 || // Plus de 10KB
                value.startsWith('data:') || // Data URL (base64)
                (value.startsWith('{') && value.includes('"data":"data:')) // JSON avec base64
            )) {
                console.log(`Removing large field: ${key} (${value.length} chars)`);
                delete userForStorage[key];
            }
        });

        try {
            localStorage.setItem('user', JSON.stringify(userForStorage));
        } catch (error) {
            console.error('Still too large, storing minimal user data');
            // En dernier recours, ne stocker que les données essentielles
            const minimalUser = {
                id: userForStorage.id,
                email: userForStorage.email,
                role: userForStorage.role,
                first_name: userForStorage.first_name,
                last_name: userForStorage.last_name
            };
            localStorage.setItem('user', JSON.stringify(minimalUser));
        }
        
        // Redirection selon le rôle
        const userRole = response.data.user.role;
        let redirectUrl = '/client/tickets.html';
        
        if (userRole === 'admin' || userRole === 'team') {
          redirectUrl = '/admin/';
        }
        
        console.log(`Connexion réussie, redirection vers ${redirectUrl}`);
        window.location.href = redirectUrl;
      } else {
        this.showError(response?.message || 'Erreur de connexion inconnue', errorDiv);
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Erreur de connexion. Veuillez vérifier vos identifiants.';
      
      if (error.message.includes('connexion au serveur')) {
        errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Email ou mot de passe incorrect.';
      }
      
      this.showError(errorMessage, errorDiv);
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }
  
  showError(message, errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
  
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing LoginApp');
  window.loginApp = new LoginApp();
});
