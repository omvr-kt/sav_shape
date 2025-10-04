// Utilitaires d'authentification avec auto-refresh
const AuthUtils = (() => {
  const API_BASE_URL = '/api';
  let refreshTimer = null;

  // Décoder le JWT pour obtenir l'expiration
  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Erreur de décodage du token:', error);
      return null;
    }
  };

  // Vérifier si le token est proche de l'expiration (moins de 5 min)
  const isTokenExpiringSoon = (token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;

    // Rafraîchir si moins de 5 minutes restantes
    return timeLeft < 5 * 60;
  };

  // Rafraîchir le token
  const refreshToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Envoyer le cookie
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Refresh token expiré');
      }

      const data = await response.json();

      if (data.success && data.data.token) {
        // Mettre à jour le token dans localStorage
        localStorage.setItem('token', data.data.token);
        console.log('Token rafraîchi avec succès');
        return data.data.token;
      }

      throw new Error('Pas de nouveau token reçu');
    } catch (error) {
      console.error('Erreur refresh token:', error);
      // Rediriger vers la page de connexion
      localStorage.clear();
      window.location.href = '/connexion.html';
      return null;
    }
  };

  // Configurer l'auto-refresh du token
  const setupAutoRefresh = () => {
    const token = localStorage.getItem('token');

    if (!token) return;

    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const timeLeft = decoded.exp - now;

    // Rafraîchir 5 minutes avant l'expiration
    const refreshIn = Math.max((timeLeft - 5 * 60) * 1000, 0);

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(async () => {
      await refreshToken();
      setupAutoRefresh(); // Re-configurer après refresh
    }, refreshIn);

    console.log(`Auto-refresh programmé dans ${Math.floor(refreshIn / 1000 / 60)} minutes`);
  };

  // Intercepter les requêtes fetch pour vérifier/rafraîchir le token
  const fetchWithAuth = async (url, options = {}) => {
    let token = localStorage.getItem('token');

    // Vérifier si le token expire bientôt
    if (token && isTokenExpiringSoon(token)) {
      console.log('Token expire bientôt, rafraîchissement...');
      token = await refreshToken();
    }

    // Ajouter le token aux headers
    const authOptions = {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    };

    try {
      const response = await fetch(url, authOptions);

      // Si 401, tenter de rafraîchir le token
      if (response.status === 401) {
        console.log('401 reçu, tentative de refresh...');
        const newToken = await refreshToken();

        if (newToken) {
          // Réessayer la requête avec le nouveau token
          authOptions.headers['Authorization'] = `Bearer ${newToken}`;
          return await fetch(url, authOptions);
        }
      }

      return response;
    } catch (error) {
      console.error('Erreur fetch:', error);
      throw error;
    }
  };

  // Initialiser l'auto-refresh au chargement de la page
  const init = () => {
    const token = localStorage.getItem('token');
    if (token) {
      setupAutoRefresh();
    }
  };

  return {
    init,
    setupAutoRefresh,
    refreshToken,
    fetchWithAuth,
    isTokenExpiringSoon,
    decodeToken
  };
})();

// Auto-initialiser
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthUtils.init());
} else {
  AuthUtils.init();
}
