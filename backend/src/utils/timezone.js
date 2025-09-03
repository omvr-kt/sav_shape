/**
 * Utilitaire de gestion des dates/heures pour le timezone Paris
 * Gère automatiquement heure d'hiver/été
 */

/**
 * Obtient la date/heure actuelle à Paris
 * @returns {Date} Date à l'heure de Paris
 */
const getParisTime = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Paris"}));
};

/**
 * Convertit une date UTC vers l'heure de Paris
 * @param {Date|string} date - Date à convertir
 * @returns {Date} Date convertie à l'heure de Paris
 */
const toParisTime = (date) => {
  const utcDate = new Date(date);
  return new Date(utcDate.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
};

/**
 * Formate une date pour l'affichage avec timezone Paris
 * @param {Date|string} date - Date à formater
 * @param {Object} options - Options de formatage
 * @returns {string} Date formatée
 */
const formatParisDate = (date, options = {}) => {
  const parisDate = date ? toParisTime(date) : getParisTime();
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  
  return new Intl.DateTimeFormat('fr-FR', formatOptions).format(new Date(date || new Date()));
};

/**
 * Formate une date courte (JJ/MM/AAAA)
 * @param {Date|string} date - Date à formater
 * @returns {string} Date formatée courte
 */
const formatShortParisDate = (date) => {
  return formatParisDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Formate une heure (HH:MM)
 * @param {Date|string} date - Date à formater
 * @returns {string} Heure formatée
 */
const formatParisTime = (date) => {
  return formatParisDate(date, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Obtient une date SQL compatible avec SQLite en temps Paris
 * @param {Date} date - Date (optionnel, utilise maintenant si null)
 * @returns {string} Date au format SQLite
 */
const getSQLiteParisDateTime = (date = null) => {
  const parisDate = date ? toParisTime(date) : getParisTime();
  return parisDate.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Parse une date SQLite vers l'heure de Paris
 * @param {string} sqliteDate - Date SQLite
 * @returns {Date} Date parsée en heure Paris
 */
const parseSQLiteToParisDate = (sqliteDate) => {
  if (!sqliteDate) return null;
  
  // SQLite stocke en UTC, on convertit vers Paris
  const utcDate = new Date(sqliteDate + 'Z'); // Ajouter Z pour forcer UTC
  return toParisTime(utcDate);
};

/**
 * Calcule la différence en heures entre deux dates (Paris)
 * @param {Date|string} date1 - Première date
 * @param {Date|string} date2 - Seconde date (défaut: maintenant)
 * @returns {number} Différence en heures
 */
const getHoursDifference = (date1, date2 = null) => {
  const parisDate1 = toParisTime(date1);
  const parisDate2 = date2 ? toParisTime(date2) : getParisTime();
  
  return Math.abs(parisDate2 - parisDate1) / (1000 * 60 * 60);
};

/**
 * Ajoute des heures à une date (Paris)
 * @param {Date|string} date - Date de base
 * @param {number} hours - Nombre d'heures à ajouter
 * @returns {Date} Nouvelle date
 */
const addHours = (date, hours) => {
  const parisDate = toParisTime(date);
  parisDate.setHours(parisDate.getHours() + hours);
  return parisDate;
};

/**
 * Vérifie si on est en heure d'été ou d'hiver à Paris
 * @param {Date} date - Date à vérifier (défaut: maintenant)
 * @returns {boolean} true si heure d'été, false si heure d'hiver
 */
const isDST = (date = new Date()) => {
  const checkDate = new Date(date);
  const jan = new Date(checkDate.getFullYear(), 0, 1);
  const jul = new Date(checkDate.getFullYear(), 6, 1);
  
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return checkDate.getTimezoneOffset() < stdTimezoneOffset;
};

module.exports = {
  getParisTime,
  toParisTime,
  formatParisDate,
  formatShortParisDate,
  formatParisTime,
  getSQLiteParisDateTime,
  parseSQLiteToParisDate,
  getHoursDifference,
  addHours,
  isDST
};