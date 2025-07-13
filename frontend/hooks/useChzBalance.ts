import { useState, useEffect, useCallback } from 'react';
import { Web3Service } from '@/lib/web3-service';

export interface ChzBalanceState {
  balance: number;
  loading: boolean;
  error: string | null;
  isOnCorrectNetwork: boolean;
  lastUpdated: number | null;
}

export const useChzBalance = (walletAddress: string | null) => {
  const [state, setState] = useState<ChzBalanceState>({
    balance: 0,
    loading: false,
    error: null,
    isOnCorrectNetwork: false,
    lastUpdated: null,
  });

  // Fonction pour récupérer le solde
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setState(prev => ({
        ...prev,
        balance: 0,
        loading: false,
        error: null,
        lastUpdated: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Vérifier le réseau
      const isOnCorrectNetwork = await Web3Service.isOnChilizTestnet();
      
      // Récupérer le solde
      const balance = await Web3Service.getChzBalance(walletAddress);
      
      setState(prev => ({
        ...prev,
        balance,
        loading: false,
        error: null,
        isOnCorrectNetwork,
        lastUpdated: Date.now(),
      }));

      console.log(`Solde CHZ mis à jour: ${balance} CHZ pour ${walletAddress}`);
    } catch (error: any) {
      console.error('Erreur lors de la récupération du solde CHZ:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Erreur lors de la récupération du solde',
        lastUpdated: Date.now(),
      }));
    }
  }, [walletAddress]);

  // Fonction pour basculer vers le réseau Chiliz
  const switchToChilizNetwork = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const success = await Web3Service.switchToChilizTestnet();
      
      if (success) {
        // Attendre un peu pour que le réseau se stabilise
        setTimeout(() => {
          fetchBalance();
        }, 1000);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Impossible de basculer vers le réseau Chiliz',
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Erreur lors du changement de réseau',
      }));
    }
  }, [fetchBalance]);

  // Fonction pour rafraîchir manuellement
  const refreshBalance = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Récupérer le solde au montage et quand l'adresse change
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Configurer les listeners pour les changements de réseau et de compte
  useEffect(() => {
    const handleNetworkChange = (chainId: string) => {
      console.log('Réseau changé:', chainId);
      // Attendre un peu pour que le changement se stabilise
      setTimeout(() => {
        fetchBalance();
      }, 1000);
    };

    const handleAccountChange = (accounts: string[]) => {
      console.log('Compte changé:', accounts);
      if (accounts.length > 0 && accounts[0] !== walletAddress) {
        // Le compte a changé, le parent doit gérer cela
        console.log('Changement de compte détecté');
      }
    };

    Web3Service.setupNetworkChangeListener(handleNetworkChange);
    Web3Service.setupAccountChangeListener(handleAccountChange);

    return () => {
      Web3Service.cleanup();
    };
  }, [walletAddress, fetchBalance]);

  // Refresh automatique supprimé pour éviter les rechargements de page

  return {
    ...state,
    switchToChilizNetwork,
    refreshBalance,
    fetchBalance,
  };
}; 