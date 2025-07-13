import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Configuration axios avec intercepteur pour ajouter le token
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // Timeout de 10 secondes
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ne pas rediriger automatiquement en cas d'erreur 401
    // pour permettre à l'utilisateur de voir les erreurs d'authentification
    if (error.response?.status === 401) {
      // Supprimer le token seulement s'il existe
      if (localStorage.getItem('auth_token')) {
        localStorage.removeItem('auth_token');
        // Nettoyer le cache du profil
        sessionStorage.removeItem('profile_cache');
        // Ne pas rediriger automatiquement, laisser l'utilisateur voir l'erreur
        console.log('Token supprimé suite à une erreur 401');
      }
    }
    
    return Promise.reject(error);
  }
);

// Types pour l'API
export interface AuthResponse {
  token: string;
  player: Player;
}

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  logo: string;
  subscribers: number;
  base_position: { q: number; r: number };
}

export interface MapCell {
  id: string;
  session_id: string;
  x_coordinate: number;
  y_coordinate: number;
  current_hp: number;
  max_hp: number;
  owner: string;
  is_base: boolean;
  last_attacker?: string;
}

export interface GameSession {
  id: string;
  status: 'active' | 'ended';
  start_time: string;
  end_time?: string;
  total_players: number;
  current_leader?: string;
}

export interface Player {
  id: string;
  username: string;
  walletAddress: string;
  chzBalance: number;
  subscriptionStatus: string;
  teamId?: string;
  level: number;
  xp: number;
  is_admin: boolean;
  email?: string;
  subscriptionExpiresAt?: string;
  teamName?: string;
  teamColor?: string;
  totalScore?: number;
  totalClicks?: number;
  totalCellsCaptured?: number;
}

// Services API
export const authService = {
  // Générer un nonce pour l'authentification
  getNonce: async (walletAddress: string): Promise<NonceResponse> => {
    const response = await api.get(`/auth/nonce?walletAddress=${walletAddress}`);
    return response.data;
  },

  // Se connecter avec signature
  login: async (walletAddress: string, signature: string, message: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', {
      walletAddress,
      signature,
      message,
    });
    // Nettoyer le cache après connexion
    sessionStorage.removeItem('profile_cache');
    return response.data;
  },

  // S'inscrire avec signature
  register: async (walletAddress: string, username: string, signature: string, message: string, teamId?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', {
      walletAddress,
      username,
      signature,
      message,
      teamId,
    });
    // Nettoyer le cache après inscription
    sessionStorage.removeItem('profile_cache');
    return response.data;
  },

  // Récupérer le profil utilisateur
  getProfile: async (): Promise<Player> => {
    // Protection contre les appels multiples
    const cacheKey = 'profile_cache';
    const cacheTime = 5000; // 5 secondes
    
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTime) {
        console.log('getProfile - Utilisation du cache');
        return data;
      }
    }
    
    const response = await api.get('/auth/profile');
    console.log('getProfile - Réponse complète:', response.data);
    
    // Le backend retourne les données dans un objet 'player'
    const data = response.data.player || response.data;
    
    // Mettre en cache
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    
    return data;
  },

  // Nettoyer le cache
  clearCache: () => {
    sessionStorage.removeItem('profile_cache');
  },
};

export const teamsService = {
  // Lister toutes les équipes
  getTeams: async (): Promise<Team[]> => {
    const response = await api.get('/teams');
    return response.data.teams || response.data;
  },

  // Détails d'une équipe
  getTeam: async (teamId: string): Promise<Team> => {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },

  // Rejoindre une équipe
  joinTeam: async (teamId: string): Promise<void> => {
    await api.post(`/teams/${teamId}/join`);
  },

  // Quitter une équipe
  leaveTeam: async (): Promise<void> => {
    await api.post('/teams/leave');
  },
};

export const gameService = {
  // Récupérer la session de jeu actuelle
  getCurrentSession: async (): Promise<GameSession> => {
    const response = await api.get('/game/current-session');
    return response.data;
  },

  // Cliquer sur une cellule de la carte
  clickCell: async (x: number, y: number): Promise<{ damage: number; newHp: number }> => {
    const response = await api.post('/game/click', { x, y });
    return response.data;
  },

  // Récupérer les cellules de la carte
  getMapCells: async (filters?: any): Promise<MapCell[]> => {
    const response = await api.get('/map/cells', { params: filters });
    return response.data;
  },

  // Détails d'une cellule
  getCellDetails: async (x: number, y: number): Promise<MapCell> => {
    const response = await api.get(`/map/cells/${x}/${y}`);
    return response.data;
  },
};

export const shopService = {
  // Cache pour éviter les appels multiples
  _cache: new Map<string, { data: any; timestamp: number }>(),
  _pendingRequests: new Map<string, Promise<any>>(),

  // Fonction utilitaire pour gérer le cache
  _getCachedData: (key: string, ttl: number = 5000) => {
    const cached = shopService._cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  },

  // Fonction utilitaire pour mettre en cache
  _setCachedData: (key: string, data: any) => {
    shopService._cache.set(key, { data, timestamp: Date.now() });
  },

  // Récupérer tous les items de la boutique
  getItems: async (): Promise<any> => {
    const cacheKey = 'shop_items';
    const cached = shopService._getCachedData(cacheKey, 10000); // Cache 10 secondes
    if (cached) {
      return cached;
    }

    // Vérifier si une requête est déjà en cours
    if (shopService._pendingRequests.has(cacheKey)) {
      return await shopService._pendingRequests.get(cacheKey);
    }

    const request = api.get('/shop/items').then(response => {
      const data = response.data.items; // Retourne les items depuis la réponse de l'API
      shopService._setCachedData(cacheKey, data);
      shopService._pendingRequests.delete(cacheKey);
      return data;
    }).catch(error => {
      shopService._pendingRequests.delete(cacheKey);
      throw error;
    });

    shopService._pendingRequests.set(cacheKey, request);
    return request;
  },

  // Acheter un item
  purchaseItem: async (itemId: string, itemType: string): Promise<any> => {
    const response = await api.post('/shop/buy', {
      itemId,
      itemType
    });
    
    // Nettoyer le cache après un achat
    shopService._cache.delete('shop_items');
    shopService._cache.delete('shop_inventory');
    
    return response.data;
  },

  // Récupérer l'inventaire du joueur
  getInventory: async (): Promise<any> => {
    const cacheKey = 'shop_inventory';
    const cached = shopService._getCachedData(cacheKey, 5000); // Cache 5 secondes
    if (cached) {
      return cached;
    }

    // Vérifier si une requête est déjà en cours
    if (shopService._pendingRequests.has(cacheKey)) {
      return await shopService._pendingRequests.get(cacheKey);
    }

    const request = api.get('/shop/inventory').then(response => {
      const data = response.data.inventory; // Retourne l'inventaire depuis la réponse de l'API
      shopService._setCachedData(cacheKey, data);
      shopService._pendingRequests.delete(cacheKey);
      return data;
    }).catch(error => {
      shopService._pendingRequests.delete(cacheKey);
      throw error;
    });

    shopService._pendingRequests.set(cacheKey, request);
    return request;
  },

  // Activer un boost
  activateBoost: async (itemId: string): Promise<any> => {
    const response = await api.post('/shop/activate-boost', {
      itemId
    });
    
    // Nettoyer le cache après activation
    shopService._cache.delete('shop_inventory');
    
    return response.data;
  },

  // Confirmer un achat avec hash de transaction blockchain
  confirmPurchase: async (itemId: string, itemType: string, transactionHash: string): Promise<any> => {
    const response = await api.post('/shop/confirm-purchase', {
      itemId,
      itemType,
      transactionHash
    });
    
    // Nettoyer le cache après confirmation
    shopService._cache.delete('shop_items');
    shopService._cache.delete('shop_inventory');
    
    return response.data;
  },

  // Récupérer l'historique des transactions
  getTransactions: async (page: number = 1, limit: number = 20): Promise<any> => {
    const response = await api.get(`/shop/transactions?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Nettoyer le cache
  clearCache: () => {
    shopService._cache.clear();
    shopService._pendingRequests.clear();
  },
};

export const bettingService = {
  // Récupérer les sessions de paris
  getBettingSessions: async (): Promise<any[]> => {
    const response = await api.get('/betting/sessions');
    return response.data;
  },

  // Placer un pari
  placeBet: async (sessionId: string, amount: number, teamId: string, signature: string): Promise<void> => {
    await api.post('/betting/place-bet', {
      session_id: sessionId,
      amount,
      team_id: teamId,
      signature,
    });
  },
};

export const leaderboardService = {
  // Classement des joueurs
  getPlayerLeaderboard: async (): Promise<Player[]> => {
    const response = await api.get('/leaderboard/players');
    return response.data;
  },

  // Classement des équipes
  getTeamLeaderboard: async (): Promise<Team[]> => {
    const response = await api.get('/leaderboard/teams');
    return response.data;
  },
};

export default api; 