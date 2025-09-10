// Timezone helpers not required here; remove unused import for clarity

class BusinessHours {
  constructor() {
    this.START_HOUR = 9;  // 9h du matin
    this.END_HOUR = 18;   // 18h (6h du soir)
    this.WORK_DAYS = [1, 2, 3, 4, 5]; // Lundi à vendredi (0 = dimanche, 6 = samedi)
    this.HOURS_PER_DAY = this.END_HOUR - this.START_HOUR; // 9 heures par jour
  }

  /**
   * Vérifie si une date/heure donnée est dans les horaires de bureau
   * @param {Date} date - La date à vérifier
   * @returns {boolean} - True si c'est dans les horaires de bureau
   */
  isBusinessTime(date) {
    const day = date.getDay(); // 0 = dimanche, 6 = samedi
    const hour = date.getHours();
    
    return this.WORK_DAYS.includes(day) && 
           hour >= this.START_HOUR && 
           hour < this.END_HOUR;
  }

  /**
   * Obtient la prochaine heure de début des horaires de bureau
   * @param {Date} date - Date de référence
   * @returns {Date} - Prochaine heure de début de bureau
   */
  getNextBusinessStart(date) {
    const nextStart = new Date(date);
    
    // Si c'est un jour ouvré mais après les heures de bureau, passer au jour suivant
    if (this.WORK_DAYS.includes(date.getDay()) && date.getHours() >= this.END_HOUR) {
      nextStart.setDate(nextStart.getDate() + 1);
    }
    
    // Trouver le prochain jour ouvré
    while (!this.WORK_DAYS.includes(nextStart.getDay())) {
      nextStart.setDate(nextStart.getDate() + 1);
    }
    
    // Définir l'heure de début
    nextStart.setHours(this.START_HOUR, 0, 0, 0);
    return nextStart;
  }

  /**
   * Calcule l'heure de fin des horaires de bureau pour une date donnée
   * @param {Date} date - Date de référence
   * @returns {Date} - Heure de fin de bureau pour cette date
   */
  getBusinessEnd(date) {
    if (!this.WORK_DAYS.includes(date.getDay())) {
      return null; // Pas un jour ouvré
    }
    
    const end = new Date(date);
    end.setHours(this.END_HOUR, 0, 0, 0);
    return end;
  }

  /**
   * Calcule la deadline SLA en respectant les horaires de bureau
   * @param {number} businessHoursNeeded - Nombre d'heures de bureau nécessaires
   * @param {Date} startDate - Date de début (optionnel, par défaut maintenant)
   * @returns {Date} - Date de deadline calculée
   */
  calculateSLADeadline(businessHoursNeeded, startDate = new Date()) {
    let remainingHours = businessHoursNeeded;
    let currentDate = new Date(startDate);
    
    // Si on est déjà dans les horaires de bureau, commencer maintenant
    // Sinon, commencer au prochain début d'horaires de bureau
    if (!this.isBusinessTime(currentDate)) {
      currentDate = this.getNextBusinessStart(currentDate);
    }
    
    while (remainingHours > 0) {
      // Si on n'est pas dans un jour ouvré, passer au suivant
      if (!this.WORK_DAYS.includes(currentDate.getDay())) {
        currentDate = this.getNextBusinessStart(currentDate);
        continue;
      }
      
      const businessEnd = this.getBusinessEnd(currentDate);
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      
      // Calculer les heures restantes dans cette journée de travail
      let hoursLeftInDay = this.END_HOUR - currentHour;
      if (currentMinute > 0) {
        hoursLeftInDay -= currentMinute / 60;
      }
      
      if (remainingHours <= hoursLeftInDay) {
        // On peut finir aujourd'hui
        currentDate.setTime(currentDate.getTime() + remainingHours * 60 * 60 * 1000);
        remainingHours = 0;
      } else {
        // On doit continuer le jour suivant
        remainingHours -= hoursLeftInDay;
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate = this.getNextBusinessStart(currentDate);
      }
    }
    
    return currentDate;
  }

  /**
   * Calcule le nombre d'heures de bureau entre deux dates
   * @param {Date} startDate - Date de début
   * @param {Date} endDate - Date de fin
   * @returns {number} - Nombre d'heures de bureau
   */
  calculateBusinessHoursBetween(startDate, endDate) {
    if (startDate >= endDate) return 0;
    
    let totalHours = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      if (this.WORK_DAYS.includes(currentDate.getDay())) {
        const dayStart = Math.max(currentDate.getTime(), 
          new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), this.START_HOUR).getTime());
        const dayEnd = Math.min(endDate.getTime(),
          new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), this.END_HOUR).getTime());
        
        if (dayEnd > dayStart) {
          totalHours += (dayEnd - dayStart) / (1000 * 60 * 60);
        }
      }
      
      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }
    
    return totalHours;
  }

  /**
   * Vérifie si une deadline SLA est en retard en tenant compte des horaires de bureau
   * @param {Date} deadline - Date de deadline
   * @param {Date} currentDate - Date actuelle (optionnel)
   * @returns {boolean} - True si en retard
   */
  isSLAOverdue(deadline, currentDate = new Date()) {
    // Si nous ne sommes pas dans les horaires de bureau, la deadline ne peut pas être dépassée
    if (!this.isBusinessTime(currentDate)) {
      return false;
    }
    
    return currentDate > deadline;
  }
}

module.exports = new BusinessHours();
