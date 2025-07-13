import { ethers } from 'ethers';

// Configuration du réseau Chiliz testnet
export const CHILIZ_TESTNET_CONFIG = {
  chainId: '0x15B32', // 88888 en décimal
  chainName: 'Chiliz Spicy Testnet',
  nativeCurrency: {
    name: 'CHZ',
    symbol: 'CHZ',
    decimals: 18
  },
  rpcUrls: ['https://spicy-rpc.chiliz.com'],
  blockExplorerUrls: ['https://testnet.chiliscan.com']
};

export class Web3Service {
  private static provider: ethers.providers.Web3Provider | null = null;
  private static signer: ethers.Signer | null = null;

  // Initialiser Web3 avec MetaMask
  static async initializeWeb3(): Promise<ethers.providers.Web3Provider | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      console.warn('MetaMask n\'est pas disponible');
      return null;
    }

    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      await this.provider.send('eth_requestAccounts', []);
      this.signer = this.provider.getSigner();
      
      // Vérifier si on est sur le bon réseau
      const network = await this.provider.getNetwork();
      if (network.chainId !== 88888) {
        await this.switchToChilizTestnet();
      }
      
      return this.provider;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation Web3:', error);
      return null;
    }
  }

  // Basculer vers le réseau Chiliz testnet
  static async switchToChilizTestnet(): Promise<boolean> {
    if (!window.ethereum) return false;

    try {
      // Essayer de basculer vers le réseau
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHILIZ_TESTNET_CONFIG.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // Si le réseau n'existe pas, l'ajouter
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CHILIZ_TESTNET_CONFIG],
          });
          return true;
        } catch (addError) {
          console.error('Erreur lors de l\'ajout du réseau Chiliz:', addError);
          return false;
        }
      }
      console.error('Erreur lors du changement de réseau:', switchError);
      return false;
    }
  }

  // Récupérer le solde CHZ d'une adresse
  static async getChzBalance(walletAddress: string): Promise<number> {
    try {
      if (!this.provider) {
        await this.initializeWeb3();
      }

      if (!this.provider) {
        console.warn('Provider non disponible, utilisation du solde fictif');
        return 1000; // Valeur par défaut
      }

      const balance = await this.provider.getBalance(walletAddress);
      const chzBalance = parseFloat(ethers.utils.formatEther(balance));
      
      console.log(`Solde CHZ récupéré: ${chzBalance} CHZ pour ${walletAddress}`);
      return Math.floor(chzBalance * 100) / 100; // Arrondir à 2 décimales
    } catch (error) {
      console.error('Erreur lors de la récupération du solde CHZ:', error);
      return 1000; // Valeur par défaut en cas d'erreur
    }
  }

  // Vérifier si on est connecté au bon réseau
  static async isOnChilizTestnet(): Promise<boolean> {
    try {
      if (!this.provider) {
        await this.initializeWeb3();
      }

      if (!this.provider) return false;

      const network = await this.provider.getNetwork();
      return network.chainId === 88888;
    } catch (error) {
      console.error('Erreur lors de la vérification du réseau:', error);
      return false;
    }
  }

  // Récupérer l'adresse du wallet connecté
  static async getConnectedAddress(): Promise<string | null> {
    try {
      if (!this.provider) {
        await this.initializeWeb3();
      }

      if (!this.provider) return null;

      const accounts = await this.provider.listAccounts();
      return accounts[0] || null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'adresse:', error);
      return null;
    }
  }

  // Surveiller les changements de réseau
  static setupNetworkChangeListener(callback: (chainId: string) => void) {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', callback);
    }
  }

  // Surveiller les changements de compte
  static setupAccountChangeListener(callback: (accounts: string[]) => void) {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', callback);
    }
  }

  // Nettoyer les listeners
  static cleanup() {
    if (window.ethereum) {
      // Note: removeAllListeners n'existe pas dans tous les providers
      // On utilise removeListener pour chaque événement spécifique
      try {
        window.ethereum.removeListener('chainChanged', () => {});
        window.ethereum.removeListener('accountsChanged', () => {});
      } catch (error) {
        console.warn('Impossible de supprimer les listeners:', error);
      }
    }
  }
}

 