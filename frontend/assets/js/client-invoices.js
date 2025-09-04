class ClientInvoicesApp {
  constructor() {
    this.currentUser = null;
    this.invoices = [];
    this.init();
  }

  async init() {
    await this.checkAuth();
    this.setupEventListeners();
    await this.loadInvoices();
    // Initialiser le badge tickets dans la sidebar
    initTicketBadge();
  }

  async checkAuth() {
    console.log('=== checkAuth called ===');
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      console.log('Getting user profile...');
      const response = await api.getProfile();
      console.log('Profile response:', response);
      this.currentUser = response.data.user;
      
      if (this.currentUser.role !== 'client') {
        alert('Accès non autorisé - Espace client uniquement');
        window.location.href = '/';
        return;
      }

      this.showMainApp();
    } catch (error) {
      console.error('Profile load error:', error);
      localStorage.removeItem('token');
      window.location.href = '/';
    }
  }

  showMainApp() {
    // App est déjà visible, pas besoin de le montrer
    
    // Mettre à jour les infos du profil si les éléments existent
    const profileInitials = document.getElementById('profileInitials');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    
    if (profileInitials) {
      const initials = `${this.currentUser.first_name.charAt(0)}${this.currentUser.last_name.charAt(0)}`.toUpperCase();
      profileInitials.textContent = initials;
    }
    
    if (profileName) {
      profileName.textContent = `${this.currentUser.first_name} ${this.currentUser.last_name}`;
    }
    
    if (profileEmail) {
      profileEmail.textContent = this.currentUser.email;
    }
  }

  setupEventListeners() {
    // Profile menu
    const profileAvatar = document.getElementById('profileAvatar');
    const profileDropdown = document.getElementById('profileDropdown');
    
    if (profileAvatar && profileDropdown) {
      profileAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        profileDropdown.classList.remove('show');
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await api.logout();
        window.location.href = '/';
      });
    }

    // Profile
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        window.location.href = '/client/profile.html';
      });
    }

    // Confidential file
    const confidentialFileBtn = document.getElementById('confidentialFileBtn');
    if (confidentialFileBtn) {
      confidentialFileBtn.addEventListener('click', () => {
        this.showConfidentialFileModal();
      });
    }

    // Refresh button
    const refreshInvoicesBtn = document.getElementById('refreshInvoices');
    if (refreshInvoicesBtn) {
      refreshInvoicesBtn.addEventListener('click', () => {
        this.loadInvoices();
      });
    }

    // Filter
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    if (invoiceStatusFilter) {
      invoiceStatusFilter.addEventListener('change', () => {
        this.loadInvoices();
      });
    }
  }

  async loadInvoices() {
    console.log('=== loadInvoices called ===');
    const container = document.getElementById('invoicesList');
    if (!container) {
      console.error('invoicesList container not found');
      return;
    }
    
    container.innerHTML = '<div class="loading">Chargement de vos factures...</div>';

    try {
      console.log('Current user:', this.currentUser);
      
      const filters = {};
      const statusFilter = document.getElementById('invoiceStatusFilter')?.value;
      if (statusFilter) filters.status = statusFilter;
      
      if (!this.currentUser || !this.currentUser.id) {
        container.innerHTML = '<div class="error-message">Utilisateur non connecté</div>';
        return;
      }
      
      // Charger les factures du client connecté
      console.log('Récupération factures pour client ID:', this.currentUser.id);
      console.log('Current user object:', this.currentUser);
      const response = await api.getClientInvoices(this.currentUser.id);
      console.log('Réponse API factures:', response);
      
      if (response.data && response.data.invoices) {
        this.invoices = response.data.invoices;
        this.renderInvoicesTable();
        this.updateSummary();
      } else {
        container.innerHTML = '<div class="error-message">Format de réponse invalide</div>';
      }
    } catch (error) {
      console.error('Invoices load error:', error);
      console.error('Error details:', error.message, error.stack);
      container.innerHTML = `<div class="error-message">Erreur lors du chargement des factures: ${error.message}</div>`;
    }
    console.log('=== loadInvoices finished ===');
  }

  renderInvoicesTable() {
    const container = document.getElementById('invoicesList');
    
    if (!this.invoices || this.invoices.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">No Invoices</div>
          <h3>Aucune facture</h3>
          <p>Vos factures apparaîtront ici lorsqu'elles seront créées.</p>
        </div>`;
      return;
    }

    // Filtrer selon le statut sélectionné
    const statusFilter = document.getElementById('invoiceStatusFilter')?.value;
    let filteredInvoices = this.invoices;
    if (statusFilter) {
      filteredInvoices = this.invoices.filter(invoice => invoice.status === statusFilter);
    }

    const tableHTML = `
      <div class="invoices-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Numéro de facture</th>
              <th>Description</th>
              <th>Montant HT</th>
              <th>TVA</th>
              <th>Montant TTC</th>
              <th>Statut</th>
              <th>Date d'émission</th>
              <th>Échéance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredInvoices.map(invoice => `
              <tr>
                <td><strong>${invoice.invoice_number}</strong></td>
                <td>${invoice.description}</td>
                <td>${parseFloat(invoice.amount_ht).toFixed(2)}€</td>
                <td>${parseFloat(invoice.tva_rate).toFixed(0)}% (${parseFloat(invoice.amount_tva).toFixed(2)}€)</td>
                <td><strong>${parseFloat(invoice.amount_ttc).toFixed(2)}€</strong></td>
                <td>
                  <span class="invoice-status status-${invoice.status}">
                    ${this.getStatusLabel(invoice.status)}
                  </span>
                </td>
                <td>${api.formatDate(invoice.created_at)}</td>
                <td>${invoice.due_date ? api.formatDate(invoice.due_date) : '-'}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-action btn-view" data-invoice-id="${invoice.id}">Voir</button>
                    <button class="btn-action btn-download" data-invoice-id="${invoice.id}">PDF</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHTML;
    
    // Ajouter les event listeners
    container.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const invoiceId = parseInt(e.target.dataset.invoiceId);
        this.viewInvoice(invoiceId);
      });
    });
    
    container.querySelectorAll('.btn-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const invoiceId = parseInt(e.target.dataset.invoiceId);
        this.downloadInvoice(invoiceId);
      });
    });
  }

  updateSummary() {
    const totalCount = this.invoices.length;
    const paidAmount = this.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);
    const pendingAmount = this.invoices.filter(i => ['draft', 'sent'].includes(i.status)).reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);
    const overdueAmount = this.invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);

    document.getElementById('totalInvoicesCount').textContent = totalCount;
    document.getElementById('paidAmount').textContent = `${paidAmount.toFixed(2)}€`;
    document.getElementById('pendingAmount').textContent = `${pendingAmount.toFixed(2)}€`;
    document.getElementById('overdueAmount').textContent = `${overdueAmount.toFixed(2)}€`;
  }

  getStatusLabel(status) {
    const labels = {
      'draft': 'Brouillon',
      'sent': 'Envoyée',
      'paid': 'Payée',
      'overdue': 'En retard',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }

  async viewInvoice(invoiceId) {
    try {
      const invoice = this.invoices.find(i => i.id === invoiceId);
      if (!invoice) return;

      const modal = this.createModal(`Facture ${invoice.invoice_number}`, `
        <div class="invoice-view">
          <!-- En-tête de la facture -->
          <div class="invoice-header">
            <div class="company-info">
              <h3>Shape</h3>
              <div class="company-details">
                <p><strong>SIREN:</strong> 990204588</p>
                <p><strong>Adresse:</strong> 55 Avenue Marceau, 75016 Paris</p>
                <p><strong>Contact:</strong> omar@shape-conseil.fr</p>
              </div>
            </div>
            <div class="invoice-info">
              <h2>${invoice.invoice_number}</h2>
              <p><strong>Date d'émission:</strong> ${api.formatDate(invoice.created_at)}</p>
              <p><strong>Échéance:</strong> ${invoice.due_date ? api.formatDate(invoice.due_date) : '-'}</p>
              <div class="status-badge status-${invoice.status}">
                ${this.getStatusLabel(invoice.status)}
              </div>
            </div>
          </div>

          <!-- Informations client -->
          <div class="client-info">
            <h4>Facturé à</h4>
            <div class="client-details">
              <p><strong>${this.currentUser.first_name} ${this.currentUser.last_name}</strong></p>
              <p>${this.currentUser.email}</p>
              ${this.currentUser.company ? `<p>${this.currentUser.company}</p>` : ''}
            </div>
          </div>

          <!-- Détails de la facture -->
          <div class="invoice-details">
            <h4>Prestations</h4>
            <table class="invoice-items">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Montant HT</th>
                  <th>TVA</th>
                  <th>Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${invoice.description}</td>
                  <td>${parseFloat(invoice.amount_ht).toFixed(2)}€</td>
                  <td>${parseFloat(invoice.tva_rate).toFixed(0)}% (${parseFloat(invoice.amount_tva).toFixed(2)}€)</td>
                  <td><strong>${parseFloat(invoice.amount_ttc).toFixed(2)}€</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Totaux -->
          <div class="invoice-totals">
            <div class="totals-row">
              <span>Montant HT:</span>
              <span>${parseFloat(invoice.amount_ht).toFixed(2)}€</span>
            </div>
            <div class="totals-row">
              <span>TVA (${parseFloat(invoice.tva_rate).toFixed(0)}%):</span>
              <span>${parseFloat(invoice.amount_tva).toFixed(2)}€</span>
            </div>
            <div class="totals-row total">
              <strong>Total TTC:</strong>
              <strong>${parseFloat(invoice.amount_ttc).toFixed(2)}€</strong>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary close-modal">Fermer</button>
            <button type="button" class="btn btn-primary download-pdf" data-invoice-id="${invoiceId}">Télécharger PDF</button>
          </div>
        </div>
      `, 'large');

      // Event listeners
      modal.querySelector('.close-modal').addEventListener('click', () => {
        this.closeModal();
      });

      modal.querySelector('.download-pdf').addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.invoiceId);
        this.downloadInvoice(id);
      });

    } catch (error) {
      this.showNotification('Erreur lors du chargement de la facture', 'error');
    }
  }

  async downloadInvoice(invoiceId) {
    try {
      // Récupérer les données de la facture
      const response = await api.request(`/invoices/${invoiceId}/pdf`);
      const invoice = response.data.invoice;
      
      // Générer le PDF avec jsPDF
      window.generateSafeInvoicePDF(invoice);
      
      this.showNotification('PDF téléchargé avec succès', 'success');
    } catch (error) {
      this.showNotification('Erreur lors de la génération du PDF', 'error');
      console.error('PDF generation error:', error);
    }
  }

  generatePDF(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configuration des couleurs et polices
    const primaryColor = [0, 123, 255];
    const darkColor = [33, 37, 41];
    
    // En-tête de la facture
    doc.setFontSize(20);
    doc.setTextColor(...primaryColor);
    doc.text('FACTURE', 20, 30);
    
    // Informations de l'entreprise (Shape)
    doc.setFontSize(16);
    doc.setTextColor(...darkColor);
    doc.text('SHAPE', 140, 30);
    
    doc.setFontSize(10);
    doc.text('SIREN: 990204588', 140, 40);
    doc.text('55 Avenue Marceau', 140, 45);
    doc.text('75016 Paris', 140, 50);
    doc.text('omar@shape-conseil.fr', 140, 55);
    
    // Numéro et date de facture
    doc.setFontSize(12);
    doc.text(`Numéro: ${invoice.invoice_number}`, 20, 50);
    doc.text(`Date: ${api.formatDate(invoice.created_at)}`, 20, 57);
    if (invoice.due_date) {
      doc.text(`Échéance: ${api.formatDate(invoice.due_date)}`, 20, 64);
    }
    
    // Informations client
    doc.setFontSize(14);
    doc.text('Facturé à:', 20, 85);
    
    doc.setFontSize(10);
    let clientY = 95;
    doc.text(`${invoice.first_name} ${invoice.last_name}`, 20, clientY);
    clientY += 7;
    doc.text(invoice.email, 20, clientY);
    if (invoice.company) {
      clientY += 7;
      doc.text(invoice.company, 20, clientY);
    }
    
    // Ligne de séparation
    doc.setDrawColor(...primaryColor);
    doc.line(20, clientY + 15, 190, clientY + 15);
    
    // Détails de la prestation
    const tableY = clientY + 30;
    
    // En-tête du tableau
    doc.setFillColor(...primaryColor);
    doc.rect(20, tableY, 170, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Description', 25, tableY + 7);
    doc.text('Montant HT', 110, tableY + 7);
    doc.text('TVA', 140, tableY + 7);
    doc.text('Montant TTC', 160, tableY + 7);
    
    // Contenu du tableau
    doc.setTextColor(...darkColor);
    doc.setFillColor(245, 245, 245);
    doc.rect(20, tableY + 10, 170, 15, 'F');
    
    // Description (limitée à 50 caractères)
    const description = invoice.description.length > 50 ? 
      invoice.description.substring(0, 50) + '...' : invoice.description;
    
    doc.text(description, 25, tableY + 20);
    doc.text(`${parseFloat(invoice.amount_ht).toFixed(2)}€`, 110, tableY + 20);
    doc.text(`${parseFloat(invoice.tva_rate).toFixed(0)}%`, 140, tableY + 20);
    doc.text(`${parseFloat(invoice.amount_ttc).toFixed(2)}€`, 160, tableY + 20);
    
    // Totaux
    const totalY = tableY + 40;
    
    doc.setFontSize(10);
    doc.text('Total HT:', 130, totalY);
    doc.text(`${parseFloat(invoice.amount_ht).toFixed(2)}€`, 165, totalY);
    
    doc.text(`TVA (${parseFloat(invoice.tva_rate).toFixed(0)}%):`, 130, totalY + 7);
    doc.text(`${parseFloat(invoice.amount_tva).toFixed(2)}€`, 165, totalY + 7);
    
    // Total TTC en gras
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Total TTC:', 130, totalY + 17);
    doc.text(`${parseFloat(invoice.amount_ttc).toFixed(2)}€`, 165, totalY + 17);
    
    // Statut de la facture
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const statusY = totalY + 30;
    doc.text('Statut:', 20, statusY);
    
    // Statut simple en noir
    doc.setTextColor(...darkColor);
    const statusText = invoice.status === 'paid' ? 'Payée' : 'Non payée';
    doc.text(statusText, 40, statusY);
    
    // Pied de page
    doc.setTextColor(...darkColor);
    doc.setFontSize(8);
    doc.text('Merci pour votre confiance !', 20, 270);
    doc.text('En cas de question, contactez-nous à omar@shape-conseil.fr', 20, 275);
    
    // Télécharger le PDF
    doc.save(`Facture-${invoice.invoice_number}.pdf`);
  }

  async showConfidentialFileModal() {
    this.showNotification('Fonctionnalité en cours de développement', 'info');
  }

  createModal(title, content, size = 'normal') {
    // Supprimer le modal existant s'il y en a un
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
    
    // Event listeners pour fermer
    modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());
    modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    
    return modal;
  }

  closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
      modal.remove();
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  window.clientInvoicesApp = new ClientInvoicesApp();
});