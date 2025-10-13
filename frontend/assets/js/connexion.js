// Vérifier si déjà connecté
function checkExistingAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenData.exp && tokenData.exp > currentTime) {
                // Token valide, rediriger selon le rôle
                const userRole = tokenData.role;
                let redirectUrl = '/client/tickets.html'; // Par défaut
                
                if (userRole === 'admin') {
                    redirectUrl = '/admin/';
                } else if (userRole === 'team') {
                    redirectUrl = '/admin/';
                } else if (userRole === 'developer') {
                    redirectUrl = '/dev/kanban.html';
                } else {
                    redirectUrl = '/client/tickets.html';
                }
                
                console.log(`Utilisateur déjà connecté (${userRole}), redirection vers ${redirectUrl}`);
                window.location.href = redirectUrl;
            } else {
                // Token expiré
                console.log('Token expiré détecté');
                clearStoredAuth();
            }
        } catch (error) {
            // Token invalide, le supprimer
            console.error('Token invalide détecté:', error);
            clearStoredAuth();
        }
    }
}

function clearStoredAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Fonction de validation email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Fonction de connexion
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    
    // Validation côté client
    if (!email || !password) {
        showError('Veuillez saisir votre email et mot de passe', errorDiv);
        return;
    }

    if (!validateEmail(email)) {
        showError('Format d\'email invalide', errorDiv);
        return;
    }
    
    // Réinitialiser les messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion en cours...';
    
    try {
        console.log('Tentative de connexion...');
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include', // Activer les cookies
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = 'Erreur de connexion';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = `Erreur ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            // Connexion réussie
            localStorage.setItem('token', data.data.token);

            // Stocker les données utilisateur sans les fichiers volumineux
            const userForStorage = { ...data.data.user };

            // Supprimer tous les champs de fichiers potentiellement volumineux
            const fileFields = ['quote_file_decrypted', 'confidential_file_decrypted', 'quote_file', 'confidential_file'];
            fileFields.forEach(field => delete userForStorage[field]);

            // Supprimer aussi tout champ qui pourrait contenir des données base64 ou JSON volumineux
            Object.keys(userForStorage).forEach(key => {
                const value = userForStorage[key];
                if (typeof value === 'string' && (
                    value.length > 10000 || // Plus de 10KB
                    value.startsWith('data:') || // Data URL (base64)
                    (value.startsWith('{') && value.includes('"data":"data:')) // JSON avec base64
                )) {
                    console.log(`Removing large field: ${key} (${value.length} chars)`);
                    delete userForStorage[key];
                }
            });

            // Log pour déboguer la taille
            const userJson = JSON.stringify(userForStorage);
            console.log('User data size after filtering:', userJson.length, 'chars');
            console.log('User fields after filtering:', Object.keys(userForStorage));

            try {
                localStorage.setItem('user', userJson);
            } catch (error) {
                console.error('Still too large, storing minimal user data');
                // En dernier recours, ne stocker que les données essentielles
                const minimalUser = {
                    id: userForStorage.id,
                    email: userForStorage.email,
                    role: userForStorage.role,
                    first_name: userForStorage.first_name,
                    last_name: userForStorage.last_name
                };
                localStorage.setItem('user', JSON.stringify(minimalUser));
            }
            
            const userRole = data.data.user.role;
            let redirectUrl = '/client/tickets.html'; // Par défaut
            let roleLabel = 'Client';
            
            // Déterminer l'URL de redirection selon le rôle
            if (userRole === 'admin') {
                redirectUrl = '/admin/';
                roleLabel = 'Admin';
            } else if (userRole === 'team') {
                redirectUrl = '/admin/'; // L'équipe va aussi sur l'admin
                roleLabel = 'Équipe';
            } else if (userRole === 'developer') {
                redirectUrl = '/dev/kanban.html';
                roleLabel = 'Développeur';
            } else {
                redirectUrl = '/client/tickets.html';
                roleLabel = 'Client';
            }
            
            successDiv.textContent = `Redirection en cours...`;
            successDiv.style.display = 'block';
            
            console.log(`Redirection vers ${redirectUrl} pour le rôle ${userRole}`);
            
            // Rediriger après 1 seconde
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1000);
            
        } else {
            // Erreur de connexion
            showError(data.message || 'Erreur de connexion', errorDiv);
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        let errorMessage = 'Erreur de connexion au serveur';
        
        if (error.message.includes('TypeError') && error.message.includes('fetch')) {
            errorMessage = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showError(errorMessage, errorDiv);
    }
    
    // Réactiver le bouton
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
}

function showError(message, errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Initialisation quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page de connexion chargée');
    
    // Vérifier l'authentification existante
    checkExistingAuth();
    
    // Ajouter l'event listener au formulaire
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});
