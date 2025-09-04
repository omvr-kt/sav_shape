// Script global pour gérer l'affichage des informations utilisateur dans la sidebar
function initSidebarUser() {
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
    const payload = JSON.parse(atob(token.split('.')[1]));
    const email = payload.email || 'client@test.com';
    sidebarUserName.textContent = email;
    sidebarUserAvatar.textContent = email.charAt(0).toUpperCase();
  } catch (e) {
    console.error('Token invalide', e);
    // Au lieu de rediriger, utiliser des données par défaut
    sidebarUserName.textContent = 'Client Test';
    sidebarUserAvatar.textContent = 'CT';
  }
}

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', initSidebarUser);

// Rendre la fonction disponible globalement
window.initSidebarUser = initSidebarUser;