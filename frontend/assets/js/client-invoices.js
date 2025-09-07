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
    const refreshInvoicesBtn = document.getElementById('refreshInvoicesBtn');
    if (refreshInvoicesBtn) {
      refreshInvoicesBtn.addEventListener('click', () => {
        this.loadInvoices();
      });
    }

    // Filter dropdown - utiliser la même logique que les tickets
    this.currentStatusFilter = '';
    this.setupFilterEventListeners();
  }

  setupFilterEventListeners() {
    // Event listener pour le select de filtrage des statuts
    const statusFilter = document.getElementById('invoiceStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.renderInvoicesTable();
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
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucune facture trouvée</p></div>';
      return;
    }

    // Filtrer selon le statut sélectionné
    let filteredInvoices = this.invoices;
    if (this.currentStatusFilter) {
      filteredInvoices = this.invoices.filter(invoice => invoice.status === this.currentStatusFilter);
    }

    if (filteredInvoices.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"></div><p>Aucune facture trouvée</p></div>';
      return;
    }

    const listHTML = filteredInvoices.map(invoice => {
      const statusText = this.getInvoiceStatusLabel(invoice.status);
      const statusColor = this.getInvoiceStatusColor(invoice.status);
      const formatDate = (dateStr) => {
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          return dateStr;
        }
      };

      return `
        <div class="list-item" style="border-bottom: 1px solid #e5e7eb; padding: 20px; transition: background-color 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #6b7280;">${invoice.invoice_number}</span>
                <span style="width: 8px; height: 8px; background: ${statusColor}; border-radius: 50%; display: inline-block;" title="${statusText}"></span>
                <span class="status-badge status-${invoice.status}" style="font-size: 12px;">${statusText}</span>
              </div>
              <h4 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0; line-height: 1.4;">
                Facture ${invoice.invoice_number}
              </h4>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.4; margin: 0 0 8px 0;">
                <strong>Montant:</strong> ${parseFloat(invoice.amount_ttc).toFixed(2)}€
              </p>
              <div style="font-size: 12px; color: #9ca3af;">
                ${invoice.due_date ? `Échéance: ${formatDate(invoice.due_date)}` : 'Pas d\'échéance'} • 
                Créée le ${formatDate(invoice.created_at)}
              </div>
              <div style="margin-top: 8px;">
                ${this.formatInvoiceSLA(invoice)}
              </div>
            </div>
            <div style="display: flex; gap: 8px; margin-left: 16px;">
              <button class="btn btn-primary btn-sm" data-invoice-id="${invoice.id}" data-action="view-invoice" style="padding: 6px 12px; font-size: 13px; background: #0e2433; border: 1px solid #0e2433; color: white; border-radius: 6px;">📄 Voir Facture</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = listHTML;
    
    // Ajouter les event listeners
    container.querySelectorAll('[data-action="view-invoice"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('Button clicked:', e.currentTarget);
        console.log('Dataset:', e.currentTarget.dataset);
        const invoiceId = parseInt(e.currentTarget.dataset.invoiceId);
        console.log('Invoice ID:', invoiceId);
        this.viewInvoice(invoiceId);
      });
    });
  }

  updateSummary() {
    const totalCount = this.invoices.length;
    const paidAmount = this.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);
    const pendingAmount = this.invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);
    const overdueAmount = this.invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + parseFloat(i.amount_ttc), 0);

    document.getElementById('totalInvoicesCount').textContent = totalCount;
    document.getElementById('paidAmount').textContent = `${paidAmount.toFixed(2)}€`;
    document.getElementById('pendingAmount').textContent = `${pendingAmount.toFixed(2)}€`;
    document.getElementById('overdueAmount').textContent = `${overdueAmount.toFixed(2)}€`;
  }

  getStatusLabel(status) {
    const labels = {
      'sent': 'Envoyée',
      'paid': 'Payée',
      'overdue': 'En retard',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }

  getInvoiceStatusLabel(status) {
    const labels = {
      'sent': 'Reçue',
      'paid': 'Payée',
      'overdue': 'En retard',
      'cancelled': 'Annulée'
    };
    return labels[status] || status;
  }

  getInvoiceStatusColor(status) {
    const colors = {
      'sent': '#2563eb',
      'paid': '#10b981',
      'overdue': '#dc2626',
      'cancelled': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  formatInvoiceSLA(invoice) {
    if (invoice.status === 'paid') {
      return '<span class="sla-status sla-good">Payée</span>';
    } else if (invoice.status === 'overdue') {
      return '<span class="sla-status sla-critical">En retard</span>';
    } else if (invoice.due_date) {
      const dueDate = new Date(invoice.due_date);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue < 0) {
        return '<span class="sla-status sla-critical">Échue</span>';
      } else if (daysUntilDue <= 3) {
        return '<span class="sla-status sla-warning">Bientôt due</span>';
      } else {
        return '<span class="sla-status sla-good">Dans les délais</span>';
      }
    }
    return '<span class="sla-status sla-good">-</span>';
  }


  async viewInvoice(invoiceId) {
    console.log('viewInvoice called with ID:', invoiceId);
    try {
      const invoice = this.invoices.find(i => i.id === invoiceId);
      console.log('Found invoice:', invoice);
      if (!invoice) {
        console.error('Invoice not found');
        return;
      }

      console.log('Creating modal...');
      const modal = this.createModal(`Facture ${invoice.invoice_number}`, `
        <div class="invoice-view">
          <!-- En-tête de la facture -->
          <div class="invoice-header">
            <div class="company-info">
              <div class="company-name">Shape</div>
              <div class="company-details">
                <div class="company-detail-item">
                  <span class="label">SIREN:</span>
                  <span class="value">990204588</span>
                </div>
                <div class="company-detail-item">
                  <span class="label">Adresse:</span>
                  <span class="value">55 Avenue Marceau, 75016 Paris</span>
                </div>
                <div class="company-detail-item">
                  <span class="label">Contact:</span>
                  <span class="value">omar@shape-conseil.fr</span>
                </div>
              </div>
            </div>
            <div class="invoice-info">
              <div class="invoice-number">${invoice.invoice_number}</div>
              <div class="invoice-dates">
                <div class="date-item">
                  <span class="label">Date d'émission:</span>
                  <span class="value">${api.formatDate(invoice.created_at)}</span>
                </div>
                <div class="date-item">
                  <span class="label">Échéance:</span>
                  <span class="value">${invoice.due_date ? api.formatDate(invoice.due_date) : '-'}</span>
                </div>
              </div>
              <div class="status-badge status-${invoice.status}">
                ${this.getInvoiceStatusLabel(invoice.status)}
              </div>
            </div>
          </div>

          <!-- Informations client -->
          <div class="client-info">
            <div class="section-title">Facturé à</div>
            <div class="client-details">
              <div class="client-name">${invoice.first_name} ${invoice.last_name}</div>
              <div class="client-email">${invoice.email}</div>
              ${invoice.company ? `<div class="client-company">${invoice.company}</div>` : ''}
              ${invoice.address ? `<div class="client-address">${invoice.address}</div>` : ''}
              ${invoice.city || invoice.country ? `<div class="client-location">${[invoice.city, invoice.country].filter(Boolean).join(', ')}</div>` : ''}
            </div>
          </div>

          <!-- Détails de la facture -->
          <div class="invoice-details">
            <div class="section-title">Prestations</div>
            <table class="invoice-items-table">
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
                  <td class="description">${invoice.description}</td>
                  <td class="amount">${parseFloat(invoice.amount_ht).toFixed(2)}€</td>
                  <td class="tax">${parseFloat(invoice.tva_rate).toFixed(0)}% <span class="tax-amount">(${parseFloat(invoice.amount_tva).toFixed(2)}€)</span></td>
                  <td class="total-amount">${parseFloat(invoice.amount_ttc).toFixed(2)}€</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Totaux -->
          <div class="invoice-totals">
            <div class="totals-row">
              <span class="total-label">Montant HT</span>
              <span class="total-value">${parseFloat(invoice.amount_ht).toFixed(2)}€</span>
            </div>
            <div class="totals-row">
              <span class="total-label">TVA (${parseFloat(invoice.tva_rate).toFixed(0)}%)</span>
              <span class="total-value">${parseFloat(invoice.amount_tva).toFixed(2)}€</span>
            </div>
            <div class="totals-row final-total">
              <span class="total-label">Total TTC</span>
              <span class="total-value">${parseFloat(invoice.amount_ttc).toFixed(2)}€</span>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary close-modal">Fermer</button>
            <button type="button" class="btn btn-primary download-pdf" data-invoice-id="${invoiceId}">
              <span>📄</span> Télécharger PDF
            </button>
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
    if (invoice.address) {
      clientY += 7;
      doc.text(invoice.address, 20, clientY);
    }
    if (invoice.city) {
      clientY += 7;
      const cityCountry = invoice.country ? `${invoice.city}, ${invoice.country}` : invoice.city;
      doc.text(cityCountry, 20, clientY);
    } else if (invoice.country) {
      clientY += 7;
      doc.text(invoice.country, 20, clientY);
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
    console.log('createModal called with:', { title, size });
    
    // Supprimer le modal existant s'il y en a un
    const existingModal = document.getElementById('modal');
    if (existingModal) {
      console.log('Removing existing modal');
      existingModal.remove();
    }

    const modalSizeClass = size === 'large' ? 'modal-large' : '';
    
    const modal = document.createElement('div');
    modal.id = 'modal';
    modal.className = 'modal';
    modal.style.cssText = 'display: flex !important; z-index: 10000 !important; position: fixed !important;';
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

    console.log('Appending modal to body');
    document.body.appendChild(modal);
    console.log('Modal appended, element:', modal);
    
    // Force visibility immediately
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active');
    
    // Event listeners pour fermer
    modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());
    modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    
    // Vérifier que le modal est visible
    setTimeout(() => {
      const modalInDOM = document.getElementById('modal');
      console.log('Modal in DOM after timeout:', modalInDOM);
      console.log('Modal computed style:', window.getComputedStyle(modalInDOM).display);
      console.log('Modal z-index:', window.getComputedStyle(modalInDOM).zIndex);
      console.log('Modal position:', window.getComputedStyle(modalInDOM).position);
      console.log('Body children count:', document.body.children.length);
      console.log('Modal is last child:', document.body.lastElementChild === modalInDOM);
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