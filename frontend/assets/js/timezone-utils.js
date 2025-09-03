/**
 * Utilitaires timezone côté client pour Paris
 * Synchronisé avec les utilitaires backend
 */

/**
 * Formate une date en heure de Paris
 * @param {Date|string} date - Date à formater
 * @param {Object} options - Options de formatage
 * @returns {string} Date formatée
 */
function formatParisDate(date, options = {}) {
  if (!date) return '-';
  
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  try {
    return new Intl.DateTimeFormat('fr-FR', formatOptions).format(parsedDate);
  } catch (error) {
    console.error('Erreur formatage date:', error);
    return parsedDate.toLocaleString('fr-FR');
  }
}

/**
 * Formate une date courte (JJ/MM/AAAA)
 * @param {Date|string} date - Date à formater
 * @returns {string} Date formatée courte
 */
function formatShortParisDate(date) {
  return formatParisDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Formate une heure (HH:MM)
 * @param {Date|string} date - Date à formater
 * @returns {string} Heure formatée
 */
function formatParisTime(date) {
  return formatParisDate(date, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formate une date pour les inputs datetime-local
 * @param {Date|string} date - Date à formater
 * @returns {string} Date au format datetime-local
 */
function formatDateTimeLocal(date) {
  if (!date) return '';
  
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  
  // Convertir vers l'heure de Paris
  const parisDate = new Date(parsedDate.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
  
  const year = parisDate.getFullYear();
  const month = String(parisDate.getMonth() + 1).padStart(2, '0');
  const day = String(parisDate.getDate()).padStart(2, '0');
  const hours = String(parisDate.getHours()).padStart(2, '0');
  const minutes = String(parisDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Calcule le temps écoulé depuis une date
 * @param {Date|string} date - Date de référence
 * @returns {string} Temps écoulé formaté
 */
function getTimeAgo(date) {
  if (!date) return '-';
  
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - parsedDate;
  
  if (diffMs < 0) return 'Dans le futur';
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'À l\'instant';
  if (diffMinutes < 60) return `Il y a ${diffMinutes}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 30) return `Il y a ${diffDays}j`;
  
  return formatShortParisDate(date);
}

/**
 * Vérifie si une deadline est dépassée
 * @param {Date|string} deadline - Date limite
 * @returns {boolean} true si dépassée
 */
function isOverdue(deadline) {
  if (!deadline) return false;
  
  const now = new Date();
  const parsedDeadline = typeof deadline === 'string' ? new Date(deadline) : deadline;
  
  return parsedDeadline < now;
}

/**
 * Vérifie si une deadline approche (dans les 2h)
 * @param {Date|string} deadline - Date limite
 * @returns {boolean} true si elle approche
 */
function isApproaching(deadline) {
  if (!deadline) return false;
  
  const now = new Date();
  const parsedDeadline = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const diffMs = parsedDeadline - now;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  
  return diffMs > 0 && diffMs <= twoHoursMs;
}

/**
 * Obtient le statut SLA d'une deadline
 * @param {Date|string} deadline - Date limite
 * @returns {string} 'overdue', 'warning', 'ok'
 */
function getSLAStatus(deadline) {
  if (!deadline) return 'ok';
  
  if (isOverdue(deadline)) return 'overdue';
  if (isApproaching(deadline)) return 'warning';
  return 'ok';
}

/**
 * Obtient une date au format ISO pour envoi vers l'API
 * @param {Date|string} date - Date à formater
 * @returns {string} Date ISO
 */
function toISOString(date) {
  if (!date) return null;
  
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  return parsedDate.toISOString();
}

// Fonction globale pour remplacer toutes les dates dans le DOM
function updateAllDatesInDOM() {
  // Dates complètes
  document.querySelectorAll('[data-date]').forEach(element => {
    const dateValue = element.getAttribute('data-date');
    if (dateValue) {
      element.textContent = formatParisDate(dateValue);
    }
  });
  
  // Dates courtes
  document.querySelectorAll('[data-date-short]').forEach(element => {
    const dateValue = element.getAttribute('data-date-short');
    if (dateValue) {
      element.textContent = formatShortParisDate(dateValue);
    }
  });
  
  // Heures uniquement
  document.querySelectorAll('[data-time]').forEach(element => {
    const dateValue = element.getAttribute('data-time');
    if (dateValue) {
      element.textContent = formatParisTime(dateValue);
    }
  });
  
  // Temps écoulé
  document.querySelectorAll('[data-time-ago]').forEach(element => {
    const dateValue = element.getAttribute('data-time-ago');
    if (dateValue) {
      element.textContent = getTimeAgo(dateValue);
    }
  });
  
  // Statuts SLA
  document.querySelectorAll('[data-sla-deadline]').forEach(element => {
    const deadline = element.getAttribute('data-sla-deadline');
    if (deadline) {
      const status = getSLAStatus(deadline);
      element.className = element.className.replace(/sla-(ok|warning|overdue)/g, '');
      element.classList.add(`sla-${status}`);
    }
  });
}

// Auto-actualisation des temps écoulés toutes les minutes
let timeUpdateInterval = null;

function startTimeUpdates() {
  if (timeUpdateInterval) return;
  
  timeUpdateInterval = setInterval(updateAllDatesInDOM, 60000); // 1 minute
}

function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

// Démarrer les mises à jour automatiques
document.addEventListener('DOMContentLoaded', () => {
  updateAllDatesInDOM();
  startTimeUpdates();
});

// Arrêter les mises à jour quand la page n'est plus visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTimeUpdates();
  } else {
    updateAllDatesInDOM();
    startTimeUpdates();
  }
});