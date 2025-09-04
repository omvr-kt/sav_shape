/**
 * Solution simple et fiable pour le formatage des dates en timezone Paris
 * Corrige le problème d'affichage UTC lors de l'ajout de commentaires
 */

(function() {
    'use strict';
    
    // Fonction de formatage simple et robuste
    function formatParisDateTime(dateString) {
        if (!dateString) return '-';
        
        try {
            let date;
            
            // Si format YYYY-MM-DD HH:mm:ss (sans timezone), traiter comme UTC
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
                date = new Date(dateString + 'Z');
            } else {
                date = new Date(dateString);
            }
            
            if (isNaN(date.getTime())) return dateString;
            
            return date.toLocaleString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Paris',
                hour12: false
            });
            
        } catch (error) {
            console.error('Erreur formatage date:', error);
            return dateString;
        }
    }
    
    // Override des fonctions API dès que disponible
    function initTimezoneCorrection() {
        // Override API.prototype si disponible
        if (window.API && window.API.prototype) {
            window.API.prototype.formatDateTime = formatParisDateTime;
        }
        
        // Override instance globale api si disponible
        if (window.api && typeof window.api.formatDateTime === 'function') {
            window.api.formatDateTime = formatParisDateTime;
        }
        
        // Override fonction globale formatParisDate
        if (typeof window.formatParisDate === 'function') {
            window.formatParisDate = formatParisDateTime;
        }
        
        // Mise à jour des éléments DOM existants
        updateDatesInDOM();
    }
    
    // Mise à jour des dates dans le DOM
    function updateDatesInDOM() {
        document.querySelectorAll('[data-date]').forEach(element => {
            const dateValue = element.getAttribute('data-date');
            if (dateValue) {
                element.textContent = formatParisDateTime(dateValue);
            }
        });
    }
    
    // Observer pour les nouveaux éléments
    function setupDOMObserver() {
        if (!window.MutationObserver) return;
        
        const observer = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && (
                            node.querySelector && node.querySelector('[data-date]') ||
                            node.classList && node.classList.contains('modal')
                        )) {
                            shouldUpdate = true;
                        }
                    });
                }
            });
            
            if (shouldUpdate) {
                setTimeout(updateDatesInDOM, 10);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialisation
    function init() {
        initTimezoneCorrection();
        setupDOMObserver();
        
        // Réessayer l'override après chargement des scripts
        setTimeout(initTimezoneCorrection, 1000);
        setTimeout(initTimezoneCorrection, 3000);
    }
    
    // Démarrer
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
