// Logs activés par défaut; utilisez ?debug=1 pour mode verbeux

class ProfileApp {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.init();
  }

  async init() {
    console.log('ProfileApp: Initializing...');
    await this.checkAuth();
    this.setupEventListeners();
    // Initialiser le badge tickets dans la sidebar
    initTicketBadge();
  }

  async checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/client/';
      return;
    }

    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      console.log('Token data decoded:', tokenData);

      this.currentUser = {
        id: tokenData.userId || tokenData.id,
        email: tokenData.email,
        role: tokenData.role
      };

      console.log('Current user set:', this.currentUser);

      this.loadUserInfo();

      // Attendre le chargement du profil avant de charger les documents
      await this.loadProfile();

      // Petit délai pour s'assurer que tout est bien initialisé
      setTimeout(async () => {
        await this.loadDocuments();
      }, 100);
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

  async loadDocuments() {
    console.log('LoadDocuments called, currentUser:', this.currentUser);
    const documentsSection = document.getElementById('documentsSection');

    try {
      // Vérifier que l'utilisateur est bien chargé
      if (!this.currentUser || !this.currentUser.id) {
        console.error('Utilisateur non initialisé lors du chargement des documents');
        console.error('currentUser:', this.currentUser);
        documentsSection.innerHTML = '<p class="no-data">Erreur: utilisateur non identifié</p>';
        return;
      }

      console.log('Loading documents for user ID:', this.currentUser.id);

      // Récupérer le profil utilisateur pour les documents directs
      const userResponse = await api.getUser(this.currentUser.id);

      const documents = [];

      if (userResponse.data && userResponse.data.user) {
        const user = userResponse.data.user;

        // Ajouter le devis s'il existe
        if (user.quote_file_decrypted) {
          documents.push({
            type: 'quote',
            file: user.quote_file_decrypted,
            label: 'Devis',
            icon: '📋',
            source: 'profile'
          });
        }

        // Ajouter le cahier des charges s'il existe
        if (user.confidential_file_decrypted) {
          documents.push({
            type: 'specifications',
            file: user.confidential_file_decrypted,
            label: 'Cahier des charges',
            icon: '📄',
            source: 'profile'
          });
        }
      }

      // Également récupérer les documents des factures
      try {
        const invoiceResponse = await api.getClientInvoices(this.currentUser.id);

        if (invoiceResponse.data && invoiceResponse.data.invoices) {
          const invoicesWithFiles = invoiceResponse.data.invoices.filter(invoice =>
            invoice.quote_file || invoice.specifications_file
          );

          const seenFiles = new Set();

          invoicesWithFiles.forEach(invoice => {
            if (invoice.quote_file && !seenFiles.has(invoice.quote_file)) {
              documents.push({
                type: 'quote',
                file: invoice.quote_file,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                label: 'Devis (Facture)',
                icon: '📋',
                source: 'invoice'
              });
              seenFiles.add(invoice.quote_file);
            }

            if (invoice.specifications_file && !seenFiles.has(invoice.specifications_file)) {
              documents.push({
                type: 'specifications',
                file: invoice.specifications_file,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                label: 'Cahier des charges (Facture)',
                icon: '📄',
                source: 'invoice'
              });
              seenFiles.add(invoice.specifications_file);
            }
          });
        }
      } catch (invoiceError) {
        console.warn('Impossible de charger les documents des factures:', invoiceError);
      }

      // Afficher les documents ou un message d'absence
      if (documents.length === 0) {
        documentsSection.innerHTML = `
          <div style="text-align: center; padding: var(--space-4); color: var(--color-muted);">
            <p>Aucun document disponible</p>
            <small>Vos documents contractuels apparaîtront ici.</small>
          </div>
        `;
        return;
      }

      documentsSection.innerHTML = `
        <div class="documents-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-3);">
          ${documents.map(doc => `
            <div class="document-item" style="border: 1px solid var(--color-border); border-radius: 8px; padding: var(--space-3); background: var(--color-white);">
              <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
                <span style="font-size: 24px;">${doc.icon}</span>
                <div>
                  <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text);">${doc.label}</h4>
                  ${doc.invoiceNumber ? `<p style="margin: 0; font-size: 12px; color: var(--color-muted);">Facture ${doc.invoiceNumber}</p>` : ''}
                </div>
              </div>
              <button type="button"
                      class="btn btn-sm btn--primary download-document-btn"
                      data-source="${doc.source}"
                      data-invoice-id="${doc.invoiceId || ''}"
                      data-file-type="${doc.type}"
                      style="width: 100%;">
                Télécharger
              </button>
            </div>
          `).join('')}
        </div>
      `;

      // Ajouter les event listeners pour les boutons de téléchargement
      documentsSection.querySelectorAll('.download-document-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const source = e.target.dataset.source;
          const fileType = e.target.dataset.fileType;

          if (source === 'profile') {
            const document = documents.find(d => d.type === fileType && d.source === 'profile');
            // Utiliser displayDocument qui gère maintenant les deux formats
            this.displayDocument(document);
          } else {
            // Pour les documents des factures, utiliser l'ancienne méthode
            const invoiceId = parseInt(e.target.dataset.invoiceId);
            await this.downloadDocument(invoiceId, fileType);
          }
        });
      });

    } catch (error) {
      console.error('Error loading documents:', error);
      documentsSection.innerHTML = `
        <div style="text-align: center; padding: var(--space-4); color: var(--color-muted);">
          <p>Erreur lors du chargement des documents</p>
        </div>
      `;
    }
  }

  async downloadDocument(invoiceId, fileType) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${api.baseURL}/invoices/${invoiceId}/files/${fileType}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors du téléchargement');
      }

      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = fileType === 'quote' ? 'devis.pdf' : 'cahier_des_charges.pdf';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.showResult('Fichier téléchargé avec succès', 'success');
    } catch (error) {
      console.error('Download error:', error);
      this.showResult(error.message || 'Erreur lors du téléchargement du fichier', 'error');
    }
  }

  displayDocument(document) {
    // Vérifier si c'est un fichier avec métadonnées JSON
    if (this.isFileMetadata(document.file)) {
      this.downloadFileFromMetadata(document.file, document.label);
    } else {
      // Ancien format: afficher le contenu texte
      const newWindow = window.open('', '_blank');
      newWindow.document.write(`
        <html>
          <head>
            <title>${document.label}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                white-space: pre-wrap;
                line-height: 1.6;
              }
              .header {
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
                margin-bottom: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${document.label}</h1>
            </div>
            <div class="content">
              ${document.file.replace(/\n/g, '<br>')}
            </div>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  }

  formatDate(dateString) {
    return formatParisDate(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
      // Fallback: essayer d'afficher le contenu directement
      this.displayDocument({ file: metadataString, label: fallbackName });
      return false;
    }
  }

  isFileMetadata(content) {
    try {
      const parsed = JSON.parse(content);
      return parsed.name && parsed.type && parsed.data && parsed.data.startsWith('data:');
    } catch {
      return false;
    }
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
