// ============================================
// SYSTÈME D'AUTHENTIFICATION PROMETA
// ============================================

// Vérifier si l'utilisateur admin est connecté
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    console.log('❌ Utilisateur non connecté - Redirection vers login');
    window.location.href = 'index.html';
    return false;
  }
  
  console.log('✅ Utilisateur connecté:', JSON.parse(user).name);
  return true;
}

// Déconnecter l'utilisateur admin
function logout() {
  console.log('🔓 Déconnexion utilisateur');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// Headers d'authentification pour les requêtes API
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// Fonction pour faire des appels API sécurisés
async function secureApiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });
    
    // Si token invalide, rediriger vers login
    if (response.status === 401 || response.status === 403) {
      console.log('❌ Token invalide - Redirection vers login');
      logout();
      return null;
    }
    
    return response;
  } catch (error) {
    console.error('Erreur API:', error);
    throw error;
  }
}

// Afficher les infos utilisateur dans la console
function showUserInfo() {
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    console.log('👤 Utilisateur connecté:', userData.name, '(' + userData.email + ')');
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier l'auth au chargement de chaque page
  if (window.location.pathname.includes('index.html')) {
    console.log('📋 Page de connexion - Pas de vérification auth');
  } else if (window.location.pathname.includes('rapport_client.html')) {
    console.log('📊 Page client - Pas de vérification auth');
  } else {
    console.log('🔒 Page admin - Vérification auth requise');
    checkAuth();
    showUserInfo();
  }
});

console.log('🔐 Système d\'authentification Prometa chargé');