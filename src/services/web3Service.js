const { ethers } = require('ethers');
const { logger } = require('../utils/logger');

let provider = null;
let signer = null;

// Initialize Web3 connection
const initializeWeb3 = async () => {
  try {
    // Try multiple RPC URLs in case one fails
    const rpcUrls = [
      process.env.CHILIZ_RPC_URL,
      'https://spicy-rpc.chiliz.com/',
      'https://testnet-rpc.chiliz.com',
      'https://rpc.ankr.com/chiliz'
    ].filter(Boolean);
    
    const chainId = process.env.CHILIZ_CHAIN_ID || 88882;
    
    let provider = null;
    let lastError = null;
    
    // Try each RPC URL until one works
    for (const rpcUrl of rpcUrls) {
      try {
        logger.info(`🔗 Trying RPC URL: ${rpcUrl}`);
        provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Test the connection
        await provider.getNetwork();
        
        logger.info(`✅ Successfully connected to RPC: ${rpcUrl}`);
        break;
      } catch (error) {
        lastError = error;
        logger.warn(`❌ Failed to connect to RPC: ${rpcUrl}`, error.message);
        continue;
      }
    }
    
    if (!provider) {
      throw new Error(`Failed to connect to any RPC URL. Last error: ${lastError?.message}`);
    }
    
    // Check if we're connected to the right network
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(chainId)) {
      logger.warn(`Connected to network ${network.chainId}, expected ${chainId}`);
    }
    
    logger.info('✅ Web3 provider initialized successfully');
    logger.info(`🌐 Connected to Chiliz ${process.env.CHILIZ_NETWORK || 'testnet'}`);
    
    return provider;
  } catch (error) {
    logger.error('❌ Failed to initialize Web3:', error);
    throw error;
  }
};

// Verify wallet signature
const verifySignature = async (message, signature, expectedAddress) => {
  try {
    logger.info(`🔍 Vérification de signature - Mode: ${process.env.NODE_ENV}, Signature: ${signature.substring(0, 20)}...`);
    
    // En mode développement, accepter les signatures simulées
    if (process.env.NODE_ENV === 'development') {
      // Vérifier si c'est une signature simulée (commence par 0x1111...)
      if (signature.startsWith('0x1111111111111111111111111111111111111111111111111111111111111111')) {
        logger.info('Mode développement: signature simulée acceptée');
        return true;
      }
      
      // En mode développement, accepter aussi les signatures qui commencent par 0x1...2...3...
      if (signature.startsWith('0x1'.repeat(32) + '2'.repeat(32) + '3'.repeat(2))) {
        logger.info('Mode développement: signature simulée alternative acceptée');
        return true;
      }
      
      // En mode développement, accepter toutes les signatures qui commencent par 0x
      if (signature.startsWith('0x') && signature.length >= 130) {
        logger.info('Mode développement: signature simulée générique acceptée');
        return true;
      }
    }
    
    // Utiliser la bonne méthode selon la version d'Ethers.js
    let recoveredAddress;
    try {
      // Essayer d'abord avec la nouvelle syntaxe (Ethers.js v6+)
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      // Si ça échoue, essayer avec l'ancienne syntaxe
      try {
        recoveredAddress = ethers.utils.verifyMessage(message, signature);
      } catch (error2) {
        logger.error('Signature verification failed with both methods:', error2);
        return false;
      }
    }
    
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    logger.error('Signature verification failed:', error);
    return false;
  }
};

// Verify transaction on blockchain
const verifyTransaction = async (txHash, expectedAmount, expectedTo) => {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed' };
    }
    
    // Verify amount (convert from wei to CHZ)
    const amountInWei = tx.value;
    const amountInCHZ = ethers.formatEther(amountInWei);
    
    if (parseFloat(amountInCHZ) < expectedAmount) {
      return { valid: false, error: 'Insufficient amount' };
    }
    
    // Verify recipient address
    if (tx.to && tx.to.toLowerCase() !== expectedTo.toLowerCase()) {
      return { valid: false, error: 'Invalid recipient address' };
    }
    
    return { valid: true, amount: amountInCHZ };
  } catch (error) {
    logger.error('Transaction verification failed:', error);
    return { valid: false, error: 'Verification failed' };
  }
};

// Get wallet balance
const getWalletBalance = async (address) => {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    logger.error('Failed to get wallet balance:', error);
    throw error;
  }
};

// Create subscription message for signing
const createSubscriptionMessage = (planType, amount, nonce) => {
  const message = `Subscribe to Chain League\n\nPlan: ${planType}\nAmount: ${amount} CHZ\nNonce: ${nonce}\n\nBy signing this message, you agree to subscribe to Chain League services.`;
  return message;
};

// Create betting message for signing
const createBettingMessage = (sessionId, teamId, amount, nonce) => {
  const message = `Place Bet on Chain League\n\nSession: ${sessionId}\nTeam: ${teamId}\nAmount: ${amount} CHZ\nNonce: ${nonce}\n\nBy signing this message, you agree to place this bet.`;
  return message;
};

// Get gas estimate for transaction
const estimateGas = async (to, value, data = '0x') => {
  try {
    const gasEstimate = await provider.estimateGas({
      to,
      value: ethers.parseEther(value.toString()),
      data
    });
    return gasEstimate;
  } catch (error) {
    logger.error('Gas estimation failed:', error);
    throw error;
  }
};

// Get current gas price
const getGasPrice = async () => {
  try {
    const gasPrice = await provider.getFeeData();
    return gasPrice.gasPrice;
  } catch (error) {
    logger.error('Failed to get gas price:', error);
    throw error;
  }
};

// Validate Ethereum address
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
};

// Get transaction details
const getTransactionDetails = async (txHash) => {
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx) {
      return null;
    }
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value),
      gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei'),
      gasUsed: receipt?.gasUsed?.toString(),
      status: receipt?.status === 1 ? 'success' : 'failed',
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp
    };
  } catch (error) {
    logger.error('Failed to get transaction details:', error);
    throw error;
  }
};

// Generate nonce for message signing
const generateNonce = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Send transaction to player (attack reward)
const sendTransactionToPlayer = async (playerAddress) => {
  try {
    if (!provider) {
      try {
        await initializeWeb3();
      } catch (error) {
        // In development mode, simulate transaction
        if (process.env.NODE_ENV === 'development') {
          logger.info('🔧 Development mode: simulating blockchain transaction');
          return {
            success: true,
            hash: '0x' + Math.random().toString(16).substring(2, 66),
            amount: '0.001',
            blockNumber: Math.floor(Math.random() * 1000000) + 1
          };
        }
        throw error;
      }
    }
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in environment variables');
    }
    
    // Create signer from private key
    const signer = new ethers.Wallet(privateKey, provider);
    
    // Amount to send (0.001 CHZ)
    const amount = ethers.parseEther("0.001");
    
    // Create transaction
    const tx = {
      to: playerAddress,
      value: amount,
      gasLimit: 21000 // Standard gas limit for simple transfers
    };
    
    // Estimate gas price
    const feeData = await provider.getFeeData();
    tx.gasPrice = feeData.gasPrice;
    
    // Send transaction
    const transaction = await signer.sendTransaction(tx);
    
    logger.info(`🚀 Transaction sent to ${playerAddress}: ${transaction.hash}`);
    
    // Wait for transaction to be mined
    const receipt = await transaction.wait();
    
    logger.info(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    return {
      success: true,
      hash: transaction.hash,
      amount: ethers.formatEther(amount),
      blockNumber: receipt.blockNumber
    };
    
  } catch (error) {
    logger.error('❌ Failed to send transaction to player:', error);
    throw error;
  }
};

module.exports = {
  initializeWeb3,
  verifySignature,
  verifyTransaction,
  getWalletBalance,
  createSubscriptionMessage,
  createBettingMessage,
  estimateGas,
  getGasPrice,
  isValidAddress,
  getTransactionDetails,
  generateNonce,
  sendTransactionToPlayer,
  getProvider: () => provider
}; 