import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { MoralisAuthService, useMoralisAuth, UserProfile } from '@/lib/moralis';
import { authService } from '@/lib/api';
import { useChzBalance } from './useChzBalance';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const router = useRouter();
  const { toast } = useToast();
  const moralisAuth = useMoralisAuth();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });

  // Hook pour gérer le solde CHZ réel
  const chzBalance = useChzBalance(authState.user?.walletAddress || null);

  // Synchroniser l'état avec Moralis et le solde CHZ réel
  useEffect(() => {
    console.log('useAuth - Moralis state:', {
      isAuthenticated: moralisAuth.isAuthenticated,
      user: moralisAuth.user,
      loading: moralisAuth.loading,
      error: moralisAuth.error,
      chzBalance: chzBalance.balance,
    });
    
    // Éviter les mises à jour inutiles avec une comparaison plus stricte
    setAuthState(prev => {
      // Créer un utilisateur avec le solde CHZ réel si disponible
      const updatedUser = moralisAuth.user ? {
        ...moralisAuth.user,
        chzBalance: chzBalance.balance > 0 ? chzBalance.balance : moralisAuth.user.chzBalance,
      } : null;

      const newState = {
        isAuthenticated: moralisAuth.isAuthenticated,
        user: updatedUser,
        loading: moralisAuth.loading || chzBalance.loading,
        error: moralisAuth.error || chzBalance.error,
      };
      
      // Comparaison stricte pour éviter les re-renders inutiles
      if (
        prev.isAuthenticated !== newState.isAuthenticated ||
        prev.loading !== newState.loading ||
        prev.error !== newState.error ||
        JSON.stringify(prev.user) !== JSON.stringify(newState.user)
      ) {
        return newState;
      }
      return prev;
    });
  }, [moralisAuth.isAuthenticated, moralisAuth.user, moralisAuth.loading, moralisAuth.error, chzBalance.balance, chzBalance.loading, chzBalance.error]);

  // Fonction de redirection
  const redirectToHome = () => {
    toast({
      title: "Connexion réussie !",
      description: "Redirection vers la page principale...",
      duration: 2000,
    });
    console.log('Redirection vers la page principale...');
    window.location.href = '/';
  };

  // Type pour la fonction de callback d'inscription
  type RegistrationCallback = (username: string) => Promise<void>;

  // Se connecter avec un wallet (version Moralis)
  const login = async (walletAddress: string, onRegistrationRequired?: RegistrationCallback) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 1. Récupérer le message à signer
      const { message } = await MoralisAuthService.requestMessage(walletAddress);

      // 2. Demander la signature
      let signature: string;
      
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Utiliser MetaMask si disponible
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          signature = await signer.signMessage(message);
        } catch (error) {
          console.warn('Erreur MetaMask, utilisation d\'une signature simulée');
          // Signature simulée pour le développement
          signature = '0x1111111111111111111111111111111111111111111111111111111111111111';
        }
      } else {
        // Simulation pour le développement
        console.warn('MetaMask non disponible, utilisation d\'une signature simulée');
        signature = '0x1111111111111111111111111111111111111111111111111111111111111111';
      }

      // 3. Essayer de se connecter
      try {
        const loginData = await authService.login(walletAddress, signature, message);
        
        // Sauvegarder le token
        localStorage.setItem('auth_token', loginData.token);
        
        // Créer le profil utilisateur avec les vraies données
        const userProfile = {
          id: loginData.player.id,
          username: loginData.player.username,
          walletAddress: loginData.player.walletAddress,
          teamId: loginData.player.teamId,
          chzBalance: loginData.player.chzBalance || 0,
          level: loginData.player.level || 1,
          xp: loginData.player.xp || 0,
          subscriptionStatus: loginData.player.subscriptionStatus || 'basic',
        };

        // Mettre à jour l'état Moralis
        moralisAuth.setUser(userProfile);
        moralisAuth.setIsAuthenticated(true);

        // 4. Rediriger vers la page principale
        redirectToHome();

        return userProfile;
      } catch (loginError: any) {
        // Si le joueur n'existe pas, demander l'inscription
        if (loginError.response?.status === 404 && (loginError.response?.data?.needsRegistration || loginError.response?.data?.requiresRegistration)) {
          if (onRegistrationRequired) {
            // Utiliser le callback pour gérer l'inscription
            await onRegistrationRequired(walletAddress);
            return null; // Le callback gère la suite
          } else {
            // Fallback avec prompt si pas de callback
            const username = prompt('Choisissez un nom d\'utilisateur (3-20 caractères, lettres, chiffres, _ et - uniquement):');
            
            if (!username) {
              throw new Error('Nom d\'utilisateur requis');
            }

            // Valider le nom d'utilisateur
            if (username.length < 3 || username.length > 20) {
              throw new Error('Le nom d\'utilisateur doit faire entre 3 et 20 caractères');
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
              throw new Error('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, underscores (_) et tirets (-)');
            }

            // Créer le compte
            const registerData = await authService.register(walletAddress, username, signature, message, 'psg');
            
            // Sauvegarder le token
            localStorage.setItem('auth_token', registerData.token);
            
            // Créer le profil utilisateur avec les vraies données
            const userProfile = {
              id: registerData.player.id,
              username: registerData.player.username,
              walletAddress: registerData.player.walletAddress,
              teamId: registerData.player.teamId,
              chzBalance: registerData.player.chzBalance || 0,
              level: registerData.player.level || 1,
              xp: registerData.player.xp || 0,
              subscriptionStatus: registerData.player.subscriptionStatus || 'basic',
            };

            // Mettre à jour l'état Moralis
            moralisAuth.setUser(userProfile);
            moralisAuth.setIsAuthenticated(true);

            // Afficher un message de succès
            toast({
              title: "Compte créé avec succès !",
              description: `Bienvenue ${username} ! Votre compte a été créé avec 1000 CHZ de départ.`,
              duration: 3000,
            });

            // Rediriger vers la page principale
            redirectToHome();

            return userProfile;
          }
        } else {
          // Autre erreur, la relancer
          throw loginError;
        }
      }
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erreur de connexion';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      
      // Afficher une notification d'erreur mais ne pas rediriger
      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      
      // Ne pas lancer d'exception pour permettre à l'utilisateur de voir l'erreur
      return null;
    }
  };

  // Se déconnecter
  const logout = () => {
    console.log('Déconnexion en cours...');
    
    // Supprimer le token d'authentification
    localStorage.removeItem('auth_token');
    
    // Nettoyer le cache
    authService.clearCache();
    
    moralisAuth.logout();
    
    // Afficher une notification de déconnexion
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès",
      duration: 2000,
    });
    
    console.log('Redirection vers la page de connexion...');
    // Forcer la redirection avec window.location.href
    window.location.href = '/';
  };

  // Mettre à jour les données utilisateur
  const updateUser = async () => {
    if (authState.isAuthenticated && authState.user) {
      try {
        const user = await MoralisAuthService.getUserProfile(authState.user.id);
        if (user) {
          setAuthState(prev => ({
            ...prev,
            user,
          }));
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
      }
    }
  };

  // Fonction pour gérer l'inscription complète
  const handleRegistration = async (walletAddress: string, username: string, signature: string, message: string, teamId: string = 'psg', autoRedirect: boolean = true) => {
    try {
      // Créer le compte
      const registerData = await authService.register(walletAddress, username, signature, message, teamId);
      
      // Sauvegarder le token
      localStorage.setItem('auth_token', registerData.token);
      
      // Créer le profil utilisateur avec les vraies données
      const userProfile = {
        id: registerData.player.id,
        username: registerData.player.username,
        walletAddress: registerData.player.walletAddress,
        teamId: registerData.player.teamId,
        chzBalance: registerData.player.chzBalance || 0,
        level: registerData.player.level || 1,
        xp: registerData.player.xp || 0,
        subscriptionStatus: registerData.player.subscriptionStatus || 'basic',
      };

      // Mettre à jour l'état Moralis
      moralisAuth.setUser(userProfile);
      moralisAuth.setIsAuthenticated(true);

      // Afficher un message de succès
      toast({
        title: "Compte créé avec succès !",
        description: `Bienvenue ${username} ! Votre compte a été créé avec 1000 CHZ de départ.`,
        duration: 3000,
      });

      // Rediriger vers la page principale seulement si demandé
      if (autoRedirect) {
        redirectToHome();
      }

      return userProfile;
    } catch (error: any) {
      console.error('Erreur lors de la création du compte:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la création du compte';
      
      toast({
        title: "Erreur de création",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      
      throw error;
    }
  };

  return {
    ...authState,
    login,
    logout,
    updateUser,
    redirectToHome,
    handleRegistration,
    // Fonctions pour le solde CHZ réel
    chzBalance: {
      balance: chzBalance.balance,
      loading: chzBalance.loading,
      error: chzBalance.error,
      isOnCorrectNetwork: chzBalance.isOnCorrectNetwork,
      lastUpdated: chzBalance.lastUpdated,
      switchToChilizNetwork: chzBalance.switchToChilizNetwork,
      refreshBalance: chzBalance.refreshBalance,
    },
  };
}; 