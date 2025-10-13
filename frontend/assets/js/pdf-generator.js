// Générateur PDF sécurisé pour les factures
window.generateSafeInvoicePDF = function(invoice) {
  
  
  if (!invoice) {
    throw new Error('Données de facture manquantes');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Valeurs par défaut pour éviter les erreurs undefined
  const safeInvoice = {
    invoice_number: invoice.invoice_number || 'N/A',
    created_at: invoice.created_at || new Date().toISOString(),
    due_date: invoice.due_date || null,
    first_name: invoice.first_name || 'Prénom',
    last_name: invoice.last_name || 'Nom',
    email: invoice.email || 'email@example.com',
    company: invoice.company || '',
    address: invoice.address || '',
    city: invoice.city || '',
    country: invoice.country || '',
    description: invoice.description || 'Prestation',
    amount_ht: parseFloat(invoice.amount_ht) || 0,
    amount_tva: parseFloat(invoice.amount_tva) || 0,
    amount_ttc: parseFloat(invoice.amount_ttc) || 0,
    tva_rate: parseFloat(invoice.tva_rate) || 0,
    status: invoice.status || 'sent'
  };
  
  
  
  // Configuration des couleurs Shape Conseil
  const primaryColor = [14, 36, 51];    // #0E2433 - Bleu marine 
  const accentColor = [199, 161, 107];  // #C7A16B - Beige doré
  const darkColor = [31, 41, 55];       // #1F2937 - Texte principal
  
  // En-tête de la facture
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text('FACTURE', 20, 30);
  
  // Informations de l'entreprise (Shape Conseil)
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('SHAPE', 140, 30);
  
  doc.setFontSize(10);
  doc.text('SIREN: 990204588', 140, 40);
  doc.text('55 Avenue Marceau', 140, 45);
  doc.text('75016 Paris', 140, 50);
  doc.text('omar@shape-conseil.fr', 140, 55);
  
  // Numéro et date de facture
  doc.setFontSize(12);
  doc.text(`Numéro: ${safeInvoice.invoice_number}`, 20, 50);
  doc.text(`Date: ${formatDateSafe(safeInvoice.created_at)}`, 20, 57);
  if (safeInvoice.due_date) {
    doc.text(`Échéance: ${formatDateSafe(safeInvoice.due_date)}`, 20, 64);
  }
  
  // Informations client
  doc.setFontSize(14);
  doc.text('Facturé à:', 20, 85);
  
  doc.setFontSize(10);
  let clientY = 95;
  doc.text(`${safeInvoice.first_name} ${safeInvoice.last_name}`, 20, clientY);
  clientY += 7;
  
  if (safeInvoice.company) {
    doc.text(safeInvoice.company, 20, clientY);
    clientY += 7;
  }
  
  if (safeInvoice.address) {
    doc.text(safeInvoice.address, 20, clientY);
    clientY += 7;
  }
  
  if (safeInvoice.city || safeInvoice.country) {
    let addressLine = '';
    if (safeInvoice.city) addressLine += safeInvoice.city;
    if (safeInvoice.city && safeInvoice.country) addressLine += ', ';
    if (safeInvoice.country) addressLine += safeInvoice.country;
    doc.text(addressLine, 20, clientY);
    clientY += 7;
  }
  
  doc.text(safeInvoice.email, 20, clientY);
  
  // Ligne de séparation
  doc.setDrawColor(...accentColor);
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
  doc.setFillColor(247, 247, 245);  // #F7F7F5 - Fond Shape
  doc.rect(20, tableY + 10, 170, 15, 'F');
  
  // Description (limitée à 50 caractères)
  const description = safeInvoice.description.length > 50 ? 
    safeInvoice.description.substring(0, 50) + '...' : safeInvoice.description;
  
  doc.text(description, 25, tableY + 20);
  doc.text(`${safeInvoice.amount_ht.toFixed(2)}€`, 110, tableY + 20);
  doc.text(`${safeInvoice.tva_rate.toFixed(0)}%`, 140, tableY + 20);
  doc.text(`${safeInvoice.amount_ttc.toFixed(2)}€`, 160, tableY + 20);
  
  // Totaux
  const totalY = tableY + 40;
  
  doc.setFontSize(10);
  doc.text('Total HT:', 130, totalY);
  doc.text(`${safeInvoice.amount_ht.toFixed(2)}€`, 165, totalY);
  
  doc.text(`TVA (${safeInvoice.tva_rate.toFixed(0)}%):`, 130, totalY + 7);
  doc.text(`${safeInvoice.amount_tva.toFixed(2)}€`, 165, totalY + 7);
  
  // Total TTC en gras
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Total TTC:', 130, totalY + 17);
  doc.text(`${safeInvoice.amount_ttc.toFixed(2)}€`, 165, totalY + 17);
  
  // Statut de la facture
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  
  const statusY = totalY + 30;
  doc.text('Statut:', 20, statusY);
  
  // Couleur selon le statut (couleurs Shape sobres)
  switch(safeInvoice.status) {
    case 'paid':
      doc.setTextColor(26, 127, 90);   // #1A7F5A - Succès sobre
      break;
    case 'overdue':
      doc.setTextColor(138, 59, 47);   // #8A3B2F - Urgent sobre
      break;
    default:
      doc.setTextColor(199, 161, 107); // #C7A16B - Accent
  }
  doc.text(getInvoiceStatusLabel(safeInvoice.status), 40, statusY);
  
  // Pied de page
  doc.setTextColor(...darkColor);
  doc.setFontSize(8);
  doc.text('Merci pour votre confiance !', 20, 270);
  doc.text('En cas de question, contactez-nous à contact@shape-conseil.fr', 20, 275);
  
  // Télécharger le PDF
  doc.save(`Facture-${safeInvoice.invoice_number}.pdf`);
};

// Fonction utilitaire pour formater les dates de manière sécurisée
function formatDateSafe(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'Europe/Paris'
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'N/A';
  }
}

// Fonction utilitaire pour les labels de statut
function getInvoiceStatusLabel(status) {
  const labels = {
    'sent': 'Envoyée',
    'paid': 'Payée',
    'overdue': 'En retard'
  };
  return labels[status] || status;
}
