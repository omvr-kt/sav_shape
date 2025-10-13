// Script global pour gérer l'affichage des informations utilisateur dans la sidebar
async function initSidebarUser() {
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
  
  if (!sidebarUserName || !sidebarUserAvatar) {
    return; // Pas de sidebar sur cette page
  }

  const token = localStorage.getItem('token');
  
  // Si pas de token, utiliser des données de test
  if (!token) {
    sidebarUserName.textContent = 'Client Test';
    sidebarUserAvatar.textContent = 'CT';
    return;
  }
  
  try {
    // Récupérer les vraies informations utilisateur via l'API
    const response = await api.getProfile();
    const user = response.data.user;
    
    // Mettre à jour le nom
    const fullName = `${user.first_name} ${user.last_name}`;
    sidebarUserName.textContent = fullName;
    
    // Mettre à jour l'avatar avec les initiales
    const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    sidebarUserAvatar.textContent = initials;
    
  } catch (e) {
    console.error('Erreur lors de la récupération du profil utilisateur:', e);
    // En cas d'erreur, utiliser l'email du token comme fallback
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = payload.email || 'client@test.com';
      sidebarUserName.textContent = email;
      sidebarUserAvatar.textContent = email.charAt(0).toUpperCase();
    } catch (tokenError) {
      // Fallback final
      sidebarUserName.textContent = 'Client Test';
      sidebarUserAvatar.textContent = 'CT';
    }
  }
}

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initSidebarUser);

// Rendre la fonction disponible globalement
window.initSidebarUser = initSidebarUser;

// Lier le bouton de déconnexion sans inline script (CSP)
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try { localStorage.removeItem('token'); } catch (e) {}
      window.location.href = '/connexion.html';
    });
  }
});
