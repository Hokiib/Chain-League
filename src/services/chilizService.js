const { ethers } = require('ethers');
const winston = require('winston');

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'chiliz-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class ChilizService {
  constructor() {
    // Configuration Chiliz Testnet
    this.rpcUrl = 'https://spicy-rpc.chiliz.com';
    this.chainId = 88882; // Chiliz Testnet Chain ID
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    // Wallet pour les transactions automatiques (vous devrez fournir votre clé privée)
    this.privateKey = process.env.CHILIZ_PRIVATE_KEY;
    this.wallet = null;
    
    if (this.privateKey) {
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      logger.info(`🔐 Wallet configuré: ${this.wallet.address}`);
    } else {
      logger.warn('⚠️ CHILIZ_PRIVATE_KEY non configurée - transactions désactivées');
    }
  }

  /**
   * Vérifier le solde d'une adresse
   */
  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      const balanceInCHZ = ethers.formatEther(balance);
      return parseFloat(balanceInCHZ);
    } catch (error) {
      logger.error('Erreur lors de la récupération du solde:', error);
      return 0;
    }
  }

  /**
   * Envoyer des CHZ à une adresse
   */
  async sendCHZ(toAddress, amountInCHZ, reason = 'Récompense de jeu') {
    if (!this.wallet) {
      throw new Error('Wallet non configuré - impossible d\'envoyer des CHZ');
    }

    try {
      // Vérifier le solde du wallet
      const senderBalance = await this.getBalance(this.wallet.address);
      if (senderBalance < amountInCHZ) {
        throw new Error(`Solde insuffisant: ${senderBalance} CHZ disponibles`);
      }

      // Préparer la transaction
      const amountWei = ethers.parseEther(amountInCHZ.toString());
      
      const transaction = {
        to: toAddress,
        value: amountWei,
        gasLimit: 21000, // Gas standard pour un transfert simple
      };

      // Estimer les frais de gas
      const gasPrice = await this.provider.getFeeData();
      transaction.gasPrice = gasPrice.gasPrice;

      logger.info(`💸 Envoi de ${amountInCHZ} CHZ à ${toAddress} (${reason})`);

      // Envoyer la transaction
      const txResponse = await this.wallet.sendTransaction(transaction);
      
      logger.info(`📤 Transaction envoyée: ${txResponse.hash}`);

      // Attendre la confirmation
      const receipt = await txResponse.wait();
      
      logger.info(`✅ Transaction confirmée: ${receipt.transactionHash}`);

      return {
        success: true,
        hash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        amount: amountInCHZ,
        to: toAddress,
        from: this.wallet.address
      };

    } catch (error) {
      logger.error('Erreur lors de l\'envoi de CHZ:', error);
      throw error;
    }
  }

  /**
   * Générer une récompense aléatoire pour le jeu
   */
  generateGameReward() {
    // Récompenses entre 0.001 et 0.01 CHZ (très petites sommes pour les tests)
    const rewards = [0.001, 0.002, 0.003, 0.005, 0.007, 0.01];
    return rewards[Math.floor(Math.random() * rewards.length)];
  }

  /**
   * Récompenser un joueur pour une action de jeu
   */
  async rewardPlayer(playerAddress, actionType = 'attack') {
    if (!this.wallet) {
      // Si pas de wallet configuré, retourner une récompense simulée
      return {
        success: true,
        simulated: true,
        amount: this.generateGameReward(),
        message: 'Récompense simulée (wallet non configuré)'
      };
    }

    try {
      const rewardAmount = this.generateGameReward();
      const reason = `Récompense ${actionType}`;
      
      const result = await this.sendCHZ(playerAddress, rewardAmount, reason);
      
      return {
        ...result,
        simulated: false,
        actionType,
        message: `Récompense de ${rewardAmount} CHZ envoyée !`
      };

    } catch (error) {
      logger.error(`Erreur lors de la récompense du joueur ${playerAddress}:`, error);
      
      // En cas d'erreur, retourner une récompense simulée
      return {
        success: false,
        simulated: true,
        amount: this.generateGameReward(),
        error: error.message,
        message: 'Récompense simulée (erreur transaction)'
      };
    }
  }

  /**
   * Vérifier la connectivité au réseau Chiliz
   */
  async checkNetwork() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      logger.info(`🌐 Connecté au réseau Chiliz - Chain ID: ${network.chainId}, Block: ${blockNumber}`);
      
      return {
        connected: true,
        chainId: network.chainId.toString(),
        blockNumber,
        networkName: network.name
      };
    } catch (error) {
      logger.error('Erreur de connexion au réseau Chiliz:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir les informations du wallet
   */
  async getWalletInfo() {
    if (!this.wallet) {
      return {
        configured: false,
        message: 'Wallet non configuré'
      };
    }

    try {
      const balance = await this.getBalance(this.wallet.address);
      const nonce = await this.provider.getTransactionCount(this.wallet.address);
      
      return {
        configured: true,
        address: this.wallet.address,
        balance: balance,
        nonce: nonce,
        network: await this.checkNetwork()
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des infos wallet:', error);
      return {
        configured: true,
        address: this.wallet.address,
        error: error.message
      };
    }
  }
}

module.exports = new ChilizService(); 