"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateWalletAddress } from '@/lib/moralis';
import { UsernameModal } from './UsernameModal';
import { TeamSelectionModal } from './TeamSelectionModal';

export default function WalletConnect() {
  const { login, loading, error, handleRegistration } = useAuth();
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [metamaskError, setMetamaskError] = useState<string | null>(null);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showTeamSelectionModal, setShowTeamSelectionModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{
    walletAddress: string;
    signature: string;
    message: string;
  } | null>(null);

  // Adresses de test valides
  const validTestAddresses = [
    { address: '0x1234567890123456789012345678901234567890', name: 'Admin' },
    { address: '0x9876543210987654321098765432109876543210', name: 'Test User' },
    { address: '0x1111111111111111111111111111111111111111', name: 'Test User 2' },
    { address: '0x2222222222222222222222222222222222222222', name: 'Test User 3' },
  ];

  const handleAddressChange = (address: string) => {
    setWalletAddress(address);
    if (address) {
      const isValid = validateWalletAddress(address);
      console.log('Validation adresse:', address, 'Résultat:', isValid);
      setAddressValid(isValid);
    } else {
      setAddressValid(null);
    }
  };

  const handleConnectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setIsConnecting(true);
        setMetamaskError(null);
        // Demander l'accès au wallet
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        setWalletAddress(address);
        
        // Se connecter avec l'adresse
        const result = await login(address, handleRegistrationRequired);
        if (result) {
          // Connexion réussie
          console.log('Connexion réussie avec Moralis');
        }
      } catch (error: any) {
        console.error('Erreur lors de la connexion wallet:', error);
        const errorMessage = error.message || 'Erreur lors de la connexion au wallet';
        setMetamaskError(errorMessage);
        toast({
          title: "Erreur de connexion",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
      } finally {
        setIsConnecting(false);
      }
    } else {
      const errorMessage = 'MetaMask n\'est pas installé. Veuillez installer MetaMask pour continuer.';
      setMetamaskError(errorMessage);
      toast({
        title: "MetaMask requis",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleManualConnect = async () => {
    if (!walletAddress) {
      toast({
        title: "Adresse requise",
        description: "Veuillez entrer une adresse wallet valide",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!addressValid) {
      toast({
        title: "Adresse invalide",
        description: "Veuillez entrer une adresse wallet valide",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      setIsConnecting(true);
      setMetamaskError(null);
      const result = await login(walletAddress, handleRegistrationRequired);
      if (result) {
        // Connexion réussie
        console.log('Connexion manuelle réussie avec Moralis');
      }
    } catch (error: any) {
      console.error('Erreur lors de la connexion manuelle:', error);
      const errorMessage = error.message || 'Erreur lors de la connexion manuelle';
      setMetamaskError(errorMessage);
      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestConnect = async (address: string) => {
    try {
      setIsConnecting(true);
      setMetamaskError(null);
      setWalletAddress(address);
      const result = await login(address, handleRegistrationRequired);
      if (result) {
        // Connexion réussie
        console.log('Connexion test réussie avec Moralis');
      }
    } catch (error: any) {
      console.error('Erreur lors de la connexion test:', error);
      const errorMessage = error.message || 'Erreur lors de la connexion test';
      setMetamaskError(errorMessage);
      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Fonction pour gérer l'inscription requise
  const handleRegistrationRequired = async (walletAddress: string) => {
    try {
      // Récupérer le message à signer
      const { message } = await import('@/lib/moralis').then(m => m.MoralisAuthService.requestMessage(walletAddress));

      // Demander la signature
      let signature: string;
      
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const { ethers } = await import('ethers');
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          signature = await signer.signMessage(message);
        } catch (error) {
          console.warn('Erreur MetaMask, utilisation d\'une signature simulée');
          signature = '0x1111111111111111111111111111111111111111111111111111111111111111';
        }
      } else {
        console.warn('MetaMask non disponible, utilisation d\'une signature simulée');
        signature = '0x1111111111111111111111111111111111111111111111111111111111111111';
      }

      // Stocker les données d'inscription en attente
      setPendingRegistration({ walletAddress, signature, message });
      setShowTeamSelectionModal(true);
    } catch (error) {
      console.error('Erreur lors de la préparation de l\'inscription:', error);
      toast({
        title: "Erreur",
        description: "Impossible de préparer l'inscription",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Fonction pour gérer la soumission du nom d'utilisateur et de l'équipe
  const handleTeamSelectionSubmit = async (username: string, teamId: string) => {
    if (!pendingRegistration) return;

    try {
      // Fermer le modal immédiatement pour éviter les soumissions multiples
      setShowTeamSelectionModal(false);
      setPendingRegistration(null);
      
      await handleRegistration(
        pendingRegistration.walletAddress,
        username,
        pendingRegistration.signature,
        pendingRegistration.message,
        teamId,
        true // Rediriger automatiquement
      );
      
      // La redirection sera gérée par handleRegistration
    } catch (error) {
      console.error('Erreur lors de la création du compte:', error);
      // En cas d'erreur, on peut rouvrir le modal si nécessaire
      // Mais pour l'instant, on laisse l'erreur être gérée par le toast
    }
  };

  // Fonction pour gérer la soumission du nom d'utilisateur (ancienne version)
  const handleUsernameSubmit = async (username: string) => {
    if (!pendingRegistration) return;

    try {
      // Fermer le modal immédiatement pour éviter les soumissions multiples
      setShowUsernameModal(false);
      setPendingRegistration(null);
      
      await handleRegistration(
        pendingRegistration.walletAddress,
        username,
        pendingRegistration.signature,
        pendingRegistration.message,
        'psg', // Équipe par défaut
        true // Rediriger automatiquement
      );
      
      // La redirection sera gérée par handleRegistration
    } catch (error) {
      console.error('Erreur lors de la création du compte:', error);
      // En cas d'erreur, on peut rouvrir le modal si nécessaire
      // Mais pour l'instant, on laisse l'erreur être gérée par le toast
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Connexion Wallet</h2>
        <p className="text-gray-400">Connectez-vous avec votre wallet pour jouer</p>
        <div className="mt-2 text-xs text-purple-400">
          🔥 Powered by Moralis Web3
        </div>
      </div>

      {/* Affichage des erreurs */}
      {(error || metamaskError) && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error || metamaskError}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Connexion MetaMask */}
        <Button
          onClick={handleConnectWallet}
          disabled={loading || isConnecting}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 rounded-xl font-bold"
        >
          {loading || isConnecting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Wallet className="mr-2 h-5 w-5" />
          )}
          {loading || isConnecting ? 'Connexion...' : 'Connecter MetaMask'}
        </Button>

        {/* Connexion manuelle */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="text"
              placeholder="Adresse wallet (0x...)"
              value={walletAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              className={`bg-gray-900 border-gray-700 text-white placeholder-gray-400 ${
                addressValid === true ? 'border-green-500' : 
                addressValid === false ? 'border-red-500' : ''
              }`}
            />
            {addressValid === true && (
              <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
            )}
            {addressValid === false && (
              <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-400" />
            )}
          </div>
          <Button
            onClick={handleManualConnect}
            disabled={loading || isConnecting || !walletAddress || !addressValid}
            variant="outline"
            className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-600/20 h-12 rounded-xl font-bold bg-transparent"
          >
            {loading || isConnecting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : null}
            Connexion manuelle
          </Button>
        </div>

        {/* Adresses de test */}
        <div className="pt-4 border-t border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <Info className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-blue-400">Adresses de test valides :</p>
          </div>
          <div className="space-y-2">
            {validTestAddresses.map((testAddress, index) => (
              <Button
                key={index}
                onClick={() => handleTestConnect(testAddress.address)}
                disabled={loading || isConnecting}
                variant="outline"
                className="w-full border-green-500/50 text-green-400 hover:bg-green-600/20 h-10 rounded-lg font-mono text-xs bg-transparent"
              >
                {testAddress.name}: {testAddress.address.slice(0, 6)}...{testAddress.address.slice(-4)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center">
        <p>💡 Seules les adresses valides et existantes peuvent se connecter</p>
        <p>🔒 L'authentification vérifie l'existence sur la blockchain</p>
      </div>

      {/* Modal pour le nom d'utilisateur */}
      {pendingRegistration && (
        <UsernameModal
          isOpen={showUsernameModal}
          onClose={() => {
            setShowUsernameModal(false);
            setPendingRegistration(null);
          }}
          onSubmit={handleUsernameSubmit}
          walletAddress={pendingRegistration.walletAddress}
        />
      )}

      {/* Modal pour la sélection d'équipe */}
      {pendingRegistration && (
        <TeamSelectionModal
          isOpen={showTeamSelectionModal}
          onClose={() => {
            setShowTeamSelectionModal(false);
            setPendingRegistration(null);
          }}
          onSubmit={handleTeamSelectionSubmit}
          walletAddress={pendingRegistration.walletAddress}
        />
      )}
    </div>
  );
} 