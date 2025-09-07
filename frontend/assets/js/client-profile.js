class ProfileApp {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.init();
  }

  init() {
    console.log('ProfileApp: Initializing...');
    this.checkAuth();
    this.setupEventListeners();
    // Initialiser le badge tickets dans la sidebar
    initTicketBadge();
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
      this.loadProfile();
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

    // Back to tickets button
    const backToTicketsBtn = document.getElementById('backToTicketsBtn');
    if (backToTicketsBtn) {
      backToTicketsBtn.addEventListener('click', () => {
        window.location.href = '/client/tickets.html';
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.handleLogout();
      });
    }

    // Password change form
    document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange();
    });

    // Navigation links work as normal links - no preventDefault needed
  }

  async loadProfile() {
    const container = document.getElementById('profileInfo');
    
    try {
      // Get full user profile from API
      const response = await api.getProfile();
      this.userProfile = response.data.user;
      this.renderProfile();
    } catch (error) {
      console.error('Profile load error:', error);
      // Fallback to token data if API fails
      this.userProfile = {
        email: this.currentUser.email,
        role: this.currentUser.role,
        first_name: '',
        last_name: '',
        company: ''
      };
      this.renderProfile();
    }
  }

  renderProfile() {
    const container = document.getElementById('profileInfo');
    const user = this.userProfile;
    
    container.innerHTML = `
      <div class="profile-view" id="profileView">
        <div class="profile-info-item">
          <span class="profile-info-label">Prénom</span>
          <span class="profile-info-value">${user.first_name || 'Non spécifié'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Nom</span>
          <span class="profile-info-value">${user.last_name || 'Non spécifié'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Email</span>
          <span class="profile-info-value">${user.email}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Entreprise</span>
          <span class="profile-info-value">${user.company || 'Non spécifiée'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Adresse</span>
          <span class="profile-info-value">${user.address || 'Non spécifiée'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Ville</span>
          <span class="profile-info-value">${user.city || 'Non spécifiée'}</span>
        </div>
        <div class="profile-info-item">
          <span class="profile-info-label">Pays</span>
          <span class="profile-info-value">${user.country || 'Non spécifié'}</span>
        </div>
        ${user.created_at ? `
        <div class="profile-info-item">
          <span class="profile-info-label">Membre depuis</span>
          <span class="profile-info-value">${this.formatDate(user.created_at)}</span>
        </div>
        ` : ''}
        <div class="profile-actions" style="margin-top: var(--space-4); padding-top: var(--space-3);">
          <button class="btn btn-primary" id="editProfileBtn">Modifier mes informations</button>
        </div>
      </div>

      <div class="profile-edit" id="profileEdit" style="display: none;">
        <form id="profileEditForm" class="form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="editFirstName">Prénom</label>
              <input type="text" id="editFirstName" name="first_name" class="form-input" 
                     value="${user.first_name || ''}" maxlength="50">
            </div>
            <div class="form-group">
              <label class="form-label" for="editLastName">Nom</label>
              <input type="text" id="editLastName" name="last_name" class="form-input" 
                     value="${user.last_name || ''}" maxlength="50">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editEmail">Email</label>
            <input type="email" id="editEmail" name="email" class="form-input" 
                   value="${user.email}" disabled>
            <small class="form-help">L'email ne peut pas être modifié</small>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editCompany">Entreprise</label>
            <input type="text" id="editCompany" name="company" class="form-input" 
                   value="${user.company || ''}" maxlength="100">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="editAddress">Adresse</label>
            <input type="text" id="editAddress" name="address" class="form-input" 
                   value="${user.address || ''}" maxlength="200">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="editCity">Ville</label>
              <input type="text" id="editCity" name="city" class="form-input" 
                     value="${user.city || ''}" maxlength="100">
            </div>
            <div class="form-group">
              <label class="form-label" for="editCountry">Pays</label>
              <input type="text" id="editCountry" name="country" class="form-input" 
                     value="${user.country || ''}" maxlength="100">
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancelEditBtn">Annuler</button>
            <button type="submit" class="btn btn-primary">Sauvegarder</button>
          </div>
          
          <div id="profileEditResult" class="profile-edit-result" style="display: none;"></div>
        </form>
      </div>
    `;

    // Setup edit profile button
    document.getElementById('editProfileBtn').addEventListener('click', () => {
      this.showEditForm();
    });

    // Setup cancel button
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      this.hideEditForm();
    });

    // Setup form submission
    document.getElementById('profileEditForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleProfileUpdate();
    });
  }

  showEditForm() {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'block';
  }

  hideEditForm() {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('profileEdit').style.display = 'none';
    // Reset form to original values
    this.renderProfile();
  }

  async handleProfileUpdate() {
    const formData = new FormData(document.getElementById('profileEditForm'));
    const profileData = {
      first_name: formData.get('first_name').trim(),
      last_name: formData.get('last_name').trim(),
      company: formData.get('company').trim(),
      address: formData.get('address').trim(),
      city: formData.get('city').trim(),
      country: formData.get('country').trim()
    };

    try {
      const submitBtn = document.querySelector('#profileEditForm button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sauvegarde...';

      const response = await api.updateProfile(profileData);
      
      if (response.success) {
        // Update local profile data
        this.userProfile = { ...this.userProfile, ...profileData };
        this.hideEditForm();
        this.showProfileResult('Profil mis à jour avec succès !', 'success');
      } else {
        this.showProfileResult(response.message || 'Erreur lors de la mise à jour', 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      
      if (error.response && error.response.data && error.response.data.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg).join('\n');
        this.showProfileResult('Erreurs de validation:\n' + errorMessages, 'error');
      } else {
        this.showProfileResult('Erreur lors de la mise à jour du profil', 'error');
      }
    } finally {
      const submitBtn = document.querySelector('#profileEditForm button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sauvegarder';
      }
    }
  }

  showProfileResult(message, type) {
    const resultDiv = document.getElementById('profileEditResult');
    resultDiv.textContent = message;
    resultDiv.className = `profile-edit-result ${type === 'success' ? 'success-message' : 'error-message'}`;
    resultDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (resultDiv) {
        resultDiv.style.display = 'none';
      }
    }, 5000);
  }

  async handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const resultDiv = document.getElementById('passwordChangeResult');

    // Client-side validation
    if (newPassword.length < 6) {
      this.showResult('Le nouveau mot de passe doit contenir au moins 6 caractères', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showResult('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    if (currentPassword === newPassword) {
      this.showResult('Le nouveau mot de passe doit être différent de l\'ancien', 'error');
      return;
    }

    try {
      const response = await api.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        this.showResult('Mot de passe modifié avec succès', 'success');
        document.getElementById('changePasswordForm').reset();
      } else {
        this.showResult(response.message, 'error');
      }
    } catch (error) {
      console.error('Password change error:', error);
      this.showResult('Erreur lors du changement de mot de passe', 'error');
    }
  }

  showResult(message, type) {
    const resultDiv = document.getElementById('passwordChangeResult');
    resultDiv.textContent = message;
    resultDiv.className = type === 'success' ? 'success-message' : 'error-message';
    resultDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      resultDiv.style.display = 'none';
    }, 5000);
  }

  formatDate(dateString) {
    return formatParisDate(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async handleLogout() {
    await api.logout();
    window.location.href = '/';
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing ProfileApp');
  window.profileApp = new ProfileApp();
});