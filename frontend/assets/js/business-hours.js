/**
 * Utilitaires pour la gestion des heures ouvrables
 * Heures de travail : 9h-18h du lundi au vendredi
 */

class BusinessHours {
  constructor() {
    this.START_HOUR = 9;  // 9h du matin
    this.END_HOUR = 18;   // 18h (6h du soir)
    this.WORK_DAYS = [1, 2, 3, 4, 5]; // Lundi à vendredi (0 = dimanche, 6 = samedi)
  }

  /**
   * Convertit une date vers l'heure de Paris
   * @param {Date} date - Date à convertir
   * @returns {Date} - Date convertie en heure de Paris
   */
  toParisTime(date) {
    return new Date(date.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
  }

  /**
   * Vérifie si une date donnée est en heures ouvrables
   * @param {Date} date - La date à vérifier
   * @returns {boolean} - True si en heures ouvrables
   */
  isBusinessTime(date) {
    // Convertir vers l'heure de Paris pour les calculs
    const parisDate = this.toParisTime(date);
    const dayOfWeek = parisDate.getDay();
    const hour = parisDate.getHours();
    
    return this.WORK_DAYS.includes(dayOfWeek) && 
           hour >= this.START_HOUR && 
           hour < this.END_HOUR;
  }

  /**
   * Trouve la prochaine heure ouvrable après une date donnée
   * @param {Date} date - Date de départ
   * @returns {Date} - Prochaine heure ouvrable
   */
  getNextBusinessTime(date) {
    const nextTime = new Date(date);
    
    // Si on est déjà en heures ouvrables, retourner la date actuelle
    if (this.isBusinessTime(nextTime)) {
      return nextTime;
    }
    
    const dayOfWeek = nextTime.getDay();
    const hour = nextTime.getHours();
    
    // Si c'est un jour ouvrable mais hors horaires
    if (this.WORK_DAYS.includes(dayOfWeek)) {
      if (hour < this.START_HOUR) {
        // Avant 9h : aller à 9h le même jour
        nextTime.setHours(this.START_HOUR, 0, 0, 0);
      } else {
        // Après 18h : aller à 9h le prochain jour ouvrable
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(this.START_HOUR, 0, 0, 0);
        return this.getNextBusinessTime(nextTime);
      }
    } else {
      // Weekend : aller au prochain lundi à 9h
      const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
      nextTime.setDate(nextTime.getDate() + daysUntilMonday);
      nextTime.setHours(this.START_HOUR, 0, 0, 0);
    }
    
    return nextTime;
  }

  /**
   * Trouve la dernière heure ouvrable avant une date donnée
   * @param {Date} date - Date de départ
   * @returns {Date} - Dernière heure ouvrable
   */
  getPreviousBusinessTime(date) {
    const prevTime = new Date(date);
    
    // Si on est déjà en heures ouvrables, retourner la date actuelle
    if (this.isBusinessTime(prevTime)) {
      return prevTime;
    }
    
    const dayOfWeek = prevTime.getDay();
    const hour = prevTime.getHours();
    
    // Si c'est un jour ouvrable mais hors horaires
    if (this.WORK_DAYS.includes(dayOfWeek)) {
      if (hour >= this.END_HOUR) {
        // Après 18h : aller à 18h le même jour
        prevTime.setHours(this.END_HOUR - 1, 59, 59, 999);
      } else {
        // Avant 9h : aller à 18h le jour ouvrable précédent
        prevTime.setDate(prevTime.getDate() - 1);
        prevTime.setHours(this.END_HOUR - 1, 59, 59, 999);
        return this.getPreviousBusinessTime(prevTime);
      }
    } else {
      // Weekend : aller au vendredi précédent à 18h
      const daysUntilFriday = dayOfWeek === 0 ? 2 : 1; // Dimanche -> 2 jours, Samedi -> 1 jour
      prevTime.setDate(prevTime.getDate() - daysUntilFriday);
      prevTime.setHours(this.END_HOUR - 1, 59, 59, 999);
    }
    
    return prevTime;
  }

  /**
   * Calcule le nombre d'heures ouvrables entre deux dates
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @returns {number} - Nombre d'heures ouvrables
   */
  getBusinessHoursBetween(startDate, endDate) {
    if (startDate >= endDate) {
      return 0;
    }

    let totalHours = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    // Ajuster le début à la prochaine heure ouvrable
    current = this.getNextBusinessTime(current);

    while (current < end) {
      const dayOfWeek = current.getDay();
      
      if (this.WORK_DAYS.includes(dayOfWeek)) {
        const startHour = Math.max(current.getHours(), this.START_HOUR);
        const endOfDay = new Date(current);
        endOfDay.setHours(this.END_HOUR, 0, 0, 0);
        
        const endHour = Math.min(end.getTime(), endOfDay.getTime());
        const currentEndTime = new Date(Math.min(end.getTime(), endOfDay.getTime()));
        
        if (currentEndTime > current) {
          const hoursInDay = (currentEndTime - current) / (1000 * 60 * 60);
          totalHours += Math.max(0, hoursInDay);
        }
      }
      
      // Passer au jour suivant à 9h
      current.setDate(current.getDate() + 1);
      current.setHours(this.START_HOUR, 0, 0, 0);
    }

    return totalHours;
  }

  /**
   * Ajoute des heures ouvrables à une date
   * @param {Date} startDate - Date de début
   * @param {number} hoursToAdd - Nombre d'heures ouvrables à ajouter
   * @returns {Date} - Date résultante
   */
  addBusinessHours(startDate, hoursToAdd) {
    if (hoursToAdd <= 0) {
      return new Date(startDate);
    }

    let current = this.getNextBusinessTime(new Date(startDate));
    let remainingHours = hoursToAdd;
    const HOURS_PER_DAY = this.END_HOUR - this.START_HOUR; // 9 heures par jour

    while (remainingHours > 0) {
      const hoursLeftInDay = Math.min(
        remainingHours,
        this.END_HOUR - current.getHours()
      );

      if (hoursLeftInDay <= 0) {
        // Passer au jour ouvrable suivant
        current.setDate(current.getDate() + 1);
        current = this.getNextBusinessTime(current);
        continue;
      }

      current.setTime(current.getTime() + (hoursLeftInDay * 60 * 60 * 1000));
      remainingHours -= hoursLeftInDay;

      // Si on dépasse 18h, passer au jour suivant
      if (current.getHours() >= this.END_HOUR && remainingHours > 0) {
        current.setDate(current.getDate() + 1);
        current = this.getNextBusinessTime(current);
      }
    }

    return current;
  }

  /**
   * Formate le temps restant en tenant compte des heures ouvrables
   * @param {Date} startDate - Date de création
   * @param {string} priority - Priorité du ticket
   * @returns {string} - Temps formaté
   */
  getBusinessCountdown(startDate, priority) {
    const thresholds = {
      'urgent': 2,
      'high': 8, 
      'normal': 24,
      'low': 72
    };

    const thresholdHours = thresholds[priority] || 24;
    const now = new Date();
    const deadline = this.addBusinessHours(startDate, thresholdHours);
    
    // Si on est passé la deadline
    if (now >= deadline) {
      const overdueHours = this.getBusinessHoursBetween(deadline, now);
      const days = Math.floor(overdueHours / 9); // 9h par jour ouvrable
      const hours = Math.floor(overdueHours % 9);
      
      if (days > 0) {
        return `En retard de ${days}j ${hours}h`;
      } else {
        return `En retard de ${Math.floor(overdueHours)}h`;
      }
    }
    
    // Temps restant jusqu'à la deadline
    const remainingHours = this.getBusinessHoursBetween(now, deadline);
    const days = Math.floor(remainingHours / 9); // 9h par jour ouvrable
    const hours = Math.floor(remainingHours % 9);
    
    if (days > 0) {
      return `${days}j ${hours}h restantes`;
    } else if (remainingHours >= 1) {
      return `${Math.floor(remainingHours)}h restantes`;
    } else {
      const minutes = Math.floor(remainingHours * 60);
      return `${minutes}min restantes`;
    }
  }

  /**
   * Obtient la classe CSS pour le countdown basé sur les heures ouvrables
   * @param {Date} startDate - Date de création
   * @param {string} priority - Priorité du ticket
   * @returns {string} - Classe CSS
   */
  getBusinessDelayClass(startDate, priority) {
    const thresholds = {
      'urgent': 2,
      'high': 8, 
      'normal': 24,
      'low': 72
    };

    const thresholdHours = thresholds[priority] || 24;
    const now = new Date();
    const deadline = this.addBusinessHours(startDate, thresholdHours);
    const elapsedHours = this.getBusinessHoursBetween(startDate, now);
    const remainingHours = this.getBusinessHoursBetween(now, deadline);
    
    // Si on est en retard
    if (now >= deadline) {
      return 'delay-critical';
    }
    
    // Pourcentage du temps écoulé
    const progressPercent = (elapsedHours / thresholdHours) * 100;
    
    if (progressPercent >= 90) {
      return 'delay-critical';
    } else if (progressPercent >= 75) {
      return 'delay-warning';
    } else {
      return 'delay-ok';
    }
  }
}

// Instance globale
const businessHours = new BusinessHours();