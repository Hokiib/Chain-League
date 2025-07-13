import Moralis from 'moralis';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { authService } from './api';

// Configuration Moralis
export const MORALIS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_MORALIS_API_KEY || '',
  // Réseaux supportés pour les NFTs et tokens
  chains: ['chiliz', 'ethereum', 'polygon'] as const,
  // Réseau par défaut pour l'authentification (doit être 'evm' pour tous les réseaux EVM)
  authNetwork: 'evm' as const,
  // Réseau par défaut pour les NFTs/tokens
  defaultChain: 'chiliz' as const,
};

// Initialisation de Moralis
export const initializeMoralis = async () => {
  if (!Moralis.Core.isStarted) {
    try {
      await Moralis.start({
        apiKey: MORALIS_CONFIG.apiKey,
      });
    } catch (error) {
      console.warn('Erreur d\'initialisation Moralis (mode développement):', error);
      // En mode développement, on peut continuer sans Moralis
    }
  }
};

// Validation d'adresse wallet
export const validateWalletAddress = (address: string): boolean => {
  try {
    // Validation stricte avec ethers
    const isValidEthers = ethers.utils.isAddress(address);
    
    // En mode développement, être plus permissif
    if (!MORALIS_CONFIG.apiKey || MORALIS_CONFIG.apiKey === 'development_key') {
      // Accepter les adresses qui commencent par 0x et ont la bonne longueur
      const isDevelopmentValid = /^0x[a-fA-F0-9]{40}$/.test(address);
      console.log('Mode développement - Validation:', address, 'Ethers:', isValidEthers, 'Dev:', isDevelopmentValid);
      return isDevelopmentValid;
    }
    
    return isValidEthers;
  } catch (error) {
    console.error('Erreur validation adresse:', error);
    return false;
  }
};

// Vérification de l'existence de l'adresse sur la blockchain
export const checkWalletExists = async (address: string): Promise<boolean> => {
  try {
    // Vérifier que l'adresse est valide
    if (!validateWalletAddress(address)) {
      return false;
    }

    // En mode développement, accepter toutes les adresses valides
    if (!MORALIS_CONFIG.apiKey || MORALIS_CONFIG.apiKey === 'development_key') {
      // En mode développement, on accepte toutes les adresses Ethereum valides
      return validateWalletAddress(address);
    }

    // En production, vérifier avec Moralis
    await initializeMoralis();
    
    try {
      // Vérifier si l'adresse a des transactions ou des NFTs
      const nfts = await Moralis.EvmApi.nft.getWalletNFTs({
        address,
        chain: 'chiliz' as any,
      });
      
      // Si on peut récupérer des données, l'adresse existe
      return true;
    } catch (error) {
      console.log('Adresse non trouvée sur la blockchain:', address);
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'adresse:', error);
    return false;
  }
};

// Types pour l'authentification
export interface AuthMessage {
  message: string;
  signature: string;
  network: string;
}

export interface UserProfile {
  id: string;
  username: string;
  walletAddress: string;
  teamId?: string;
  chzBalance: number;
  level: number;
  xp: number;
  subscriptionStatus: string;
}

// Service d'authentification Moralis
export class MoralisAuthService {
  static async requestMessage(walletAddress: string): Promise<{ message: string; nonce: string }> {
    await initializeMoralis();
    
    const message = `Login to Chain League\n\nWallet: ${walletAddress}\nNonce: ${Date.now()}\n\nBy signing this message, you agree to authenticate with Chain League.`;
    
    return {
      message,
      nonce: Date.now().toString(),
    };
  }

  static async authenticate(walletAddress: string, signature: string, message: string): Promise<UserProfile> {
    await initializeMoralis();
    
    // 1. Valider le format de l'adresse
    if (!validateWalletAddress(walletAddress)) {
      throw new Error('Adresse wallet invalide');
    }
    
    // 2. Vérifier que l'adresse existe sur la blockchain
    const walletExists = await checkWalletExists(walletAddress);
    if (!walletExists) {
      throw new Error('Adresse wallet non trouvée sur la blockchain');
    }
    
    // Mode développement : authentification simulée
    if (!MORALIS_CONFIG.apiKey || MORALIS_CONFIG.apiKey === 'development_key') {
      console.log('Mode développement : authentification simulée pour', walletAddress);
      const user = await this.getOrCreateUser(walletAddress);
      return user;
    }
    
    try {
      // Vérifier la signature avec Moralis (utilise 'evm' pour tous les réseaux EVM)
      const { result } = await Moralis.Auth.verify({
        message,
        signature,
        network: MORALIS_CONFIG.authNetwork, // Utilise 'evm' pour tous les réseaux EVM
      });

      // Note: Dans ethers v5, si aucune erreur n'est levée, la signature est valide

      // Créer ou récupérer l'utilisateur
      const user = await this.getOrCreateUser(walletAddress);
      
      return user;
    } catch (error) {
      console.error('Erreur d\'authentification Moralis:', error);
      throw new Error('Échec de l\'authentification: ' + (error as any).message);
    }
  }

  static async getOrCreateUser(walletAddress: string): Promise<UserProfile> {
    try {
      // Récupérer les vraies données depuis le backend
      const userData = await authService.getProfile();
      console.log('getOrCreateUser - Données reçues:', userData);
      
      // Le backend retourne les données directement
      const playerData = userData;
      
      return {
        id: playerData.id,
        username: playerData.username,
        walletAddress: playerData.walletAddress,
        teamId: playerData.teamId,
        chzBalance: playerData.chzBalance || 0,
        level: playerData.level || 1,
        xp: playerData.xp || 0,
        subscriptionStatus: playerData.subscriptionStatus || 'basic',
      };
    } catch (error) {
      console.warn('Erreur lors de la récupération du profil, utilisation des données simulées:', error);
    }

    // Fallback : données simulées si le backend n'est pas disponible
    const existingUser = await this.findUserByWallet(walletAddress);
    
    if (existingUser) {
      return existingUser;
    }

    // Créer un nouvel utilisateur
    const newUser: UserProfile = {
      id: Date.now().toString(),
      username: `Player_${walletAddress.slice(-6)}`,
      walletAddress,
      chzBalance: 1000,
      level: 1,
      xp: 0,
      subscriptionStatus: 'basic',
    };

    // Sauvegarder dans Moralis (simulé pour l'instant)
    await this.saveUser(newUser);
    
    return newUser;
  }

  static async findUserByWallet(walletAddress: string): Promise<UserProfile | null> {
    // Simuler la recherche d'utilisateur
    // En production, cela utiliserait Moralis.Object
    const users = await this.getAllUsers();
    return users.find(user => user.walletAddress.toLowerCase() === walletAddress.toLowerCase()) || null;
  }

  static async getAllUsers(): Promise<UserProfile[]> {
    // Simuler la récupération des utilisateurs
    // En production, cela utiliserait Moralis.Object
    return [
      {
        id: '1',
        username: 'admin',
        walletAddress: '0x1234567890123456789012345678901234567890',
        chzBalance: 10000,
        level: 12,
        xp: 2340,
        subscriptionStatus: 'premium',
      },
      {
        id: '2',
        username: 'testuser',
        walletAddress: '0x9876543210987654321098765432109876543210',
        chzBalance: 1000,
        level: 5,
        xp: 500,
        subscriptionStatus: 'basic',
      },
    ];
  }

  static async saveUser(user: UserProfile): Promise<void> {
    // Simuler la sauvegarde d'utilisateur
    // En production, cela utiliserait Moralis.Object
    console.log('Saving user to Moralis:', user);
  }

  static async updateUser(userId: string, updates: Partial<UserProfile>): Promise<void> {
    // Simuler la mise à jour d'utilisateur
    console.log('Updating user in Moralis:', userId, updates);
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Récupérer les vraies données depuis le backend
      const userData = await authService.getProfile();
      console.log('getUserProfile - Données reçues:', userData);
      
      // Le backend retourne les données directement
      const playerData = userData;
      
      return {
        id: playerData.id,
        username: playerData.username,
        walletAddress: playerData.walletAddress,
        teamId: playerData.teamId,
        chzBalance: playerData.chzBalance || 0,
        level: playerData.level || 1,
        xp: playerData.xp || 0,
        subscriptionStatus: playerData.subscriptionStatus || 'basic',
      };
    } catch (error) {
      console.warn('Erreur lors de la récupération du profil, utilisation des données simulées:', error);
    }

    // Fallback : données simulées
    const users = await this.getAllUsers();
    return users.find(user => user.id === userId) || null;
  }
}

// Hook personnalisé pour l'authentification Moralis
export const useMoralisAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const login = async (walletAddress: string, signature: string, message: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const userProfile = await MoralisAuthService.authenticate(walletAddress, signature, message);
      
      setUser(userProfile);
      setIsAuthenticated(true);
      
      // Sauvegarder le token (simulé)
      localStorage.setItem('moralis_user', JSON.stringify(userProfile));
      
      return userProfile;
    } catch (err: any) {
      setError(err.message || 'Erreur d\'authentification');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('moralis_user');
  };

  const checkAuth = async () => {
    // Éviter les appels multiples
    if (isInitialized) {
      return;
    }
    
    console.log('checkAuth - Début de la vérification d\'authentification');
    setLoading(true);
    
    const authToken = localStorage.getItem('auth_token');
    console.log('checkAuth - Token trouvé:', !!authToken);
    
    if (authToken) {
      try {
        console.log('checkAuth - Appel API getProfile...');
        // Vérifier le token et récupérer les vraies données
        const userData = await authService.getProfile();
        console.log('checkAuth - Données reçues du backend:', userData);
        
        // Le backend retourne les données directement
        const playerData = userData;
        
        const userProfile = {
          id: playerData.id,
          username: playerData.username,
          walletAddress: playerData.walletAddress,
          teamId: playerData.teamId,
          chzBalance: playerData.chzBalance || 0,
          level: playerData.level || 1,
          xp: playerData.xp || 0,
          subscriptionStatus: playerData.subscriptionStatus || 'basic',
        };
        
        console.log('checkAuth - Profil utilisateur créé:', userProfile);
        setUser(userProfile);
        setIsAuthenticated(true);
      } catch (error) {
        console.warn('checkAuth - Erreur lors de la vérification du token:', error);
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setUser(null);
      }
    } else {
      console.log('checkAuth - Pas de token, vérification du système Moralis');
      // Fallback : vérifier l'ancien système Moralis
      const savedUser = localStorage.getItem('moralis_user');
      if (savedUser) {
        try {
          const userProfile = JSON.parse(savedUser);
          setUser(userProfile);
          setIsAuthenticated(true);
          console.log('checkAuth - Utilisateur Moralis trouvé:', userProfile.username);
        } catch (error) {
          console.warn('checkAuth - Erreur lors de la lecture du profil sauvegardé:', error);
          localStorage.removeItem('moralis_user');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        // Pas de token, pas d'utilisateur sauvegardé
        console.log('checkAuth - Aucun utilisateur trouvé, mode non authentifié');
        setIsAuthenticated(false);
        setUser(null);
      }
    }
    
    console.log('checkAuth - Fin de la vérification, setLoading(false)');
    setLoading(false);
    setIsInitialized(true);
  };

  useEffect(() => {
    // Éviter les appels multiples en vérifiant si déjà initialisé
    if (!isInitialized) {
      checkAuth();
    }
  }, [isInitialized]);

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    logout,
    checkAuth,
    setUser,
    setIsAuthenticated,
  };
}; 