const express = require('express');
const { body } = require('express-validator');
const { query } = require('../database/connection');
const { generateToken, verifyToken } = require('../middleware/auth');
const { verifySignature, createSubscriptionMessage, generateNonce } = require('../services/web3Service');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new player with wallet
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - username
 *               - email
 *               - signature
 *               - message
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Ethereum wallet address
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *               signature:
 *                 type: string
 *                 description: Wallet signature
 *               message:
 *                 type: string
 *                 description: Message that was signed
 *     responses:
 *       201:
 *         description: Player registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Player already exists
 */
router.post('/register', [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum wallet address'),
  body('username')
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-20 characters, alphanumeric, underscore and dash only'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  body('signature')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Signature is required'),
  body('message')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Message is required')
], async (req, res) => {
  try {
    const { walletAddress, username, signature, message } = req.body;
    // Générer un email temporaire si non fourni
    const email = req.body.email || `${username}@chainleague.temp`;
    
    // Normaliser l'adresse wallet en minuscules
    const normalizedWalletAddress = walletAddress.toLowerCase();
    
    // Verify signature
    const isValidSignature = await verifySignature(message, signature, normalizedWalletAddress);
    if (!isValidSignature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'The provided signature is invalid'
      });
    }
    
    // Check if player already exists
    const existingPlayer = await query(
      'SELECT * FROM players WHERE wallet_address = $1 OR username = $2',
      [normalizedWalletAddress, username]
    );
    
    if (existingPlayer.rows.length > 0) {
      const existing = existingPlayer.rows[0];
      if (existing.wallet_address === normalizedWalletAddress) {
        return res.status(409).json({
          error: 'Wallet already registered',
          message: 'This wallet address is already registered'
        });
      }
      if (existing.username === username) {
        return res.status(409).json({
          error: 'Username taken',
          message: 'This username is already taken'
        });
      }
    }
    
    // Create new player
    const result = await query(
      `INSERT INTO players (wallet_address, username, email)
       VALUES ($1, $2, $3)
       RETURNING id, wallet_address, username, email, subscription_status, created_at`,
      [normalizedWalletAddress, username, email]
    );
    
    const player = result.rows[0];
    
    // Generate JWT token
    const token = generateToken({
      playerId: player.id,
      walletAddress: player.wallet_address.toLowerCase(),
      username: player.username
    });
    
    logger.info(`New player registered: ${player.username} (${player.wallet_address})`);
    
    res.status(201).json({
      message: 'Player registered successfully',
      player: {
        id: player.id,
        username: player.username,
        email: player.email,
        walletAddress: player.wallet_address,
        subscriptionStatus: player.subscription_status
      },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with wallet signature
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - signature
 *               - message
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Ethereum wallet address
 *               signature:
 *                 type: string
 *                 description: Wallet signature
 *               message:
 *                 type: string
 *                 description: Message that was signed
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum wallet address'),
  body('signature')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Signature is required'),
  body('message')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Message is required')
], async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    
    // Normaliser l'adresse wallet en minuscules
    const normalizedWalletAddress = walletAddress.toLowerCase();
    
    // Verify signature
    const isValidSignature = await verifySignature(message, signature, normalizedWalletAddress);
    if (!isValidSignature) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'The provided signature is invalid'
      });
    }
    
    // Find player by wallet address
    const playerResult = await query(
      `SELECT p.*, t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.wallet_address = $1`,
      [normalizedWalletAddress]
    );
    
    if (playerResult.rows.length === 0) {
      // Joueur non trouvé, retourner un code spécial pour indiquer qu'il faut créer un compte
      return res.status(404).json({
        error: 'Player not found',
        message: 'No player found with this wallet address',
        requiresRegistration: true,
        walletAddress: normalizedWalletAddress
      });
    }
    
    const player = playerResult.rows[0];
    
    // Check subscription status
    if (player.subscription_status === 'premium' && player.subscription_expires_at) {
      if (new Date() > new Date(player.subscription_expires_at)) {
        await query(
          'UPDATE players SET subscription_status = $1 WHERE id = $2',
          ['expired', player.id]
        );
        player.subscription_status = 'expired';
      }
    }
    
    // Generate JWT token
    const token = generateToken({
      playerId: player.id,
      walletAddress: player.wallet_address.toLowerCase(),
      username: player.username
    });
    
    logger.info(`Player logged in: ${player.username} (${player.wallet_address})`);
    
    res.json({
      message: 'Login successful',
      player: {
        id: player.id,
        username: player.username,
        email: player.email,
        walletAddress: player.wallet_address,
        subscriptionStatus: player.subscription_status,
        subscriptionExpiresAt: player.subscription_expires_at,
        teamId: player.team_id,
        teamName: player.team_name,
        teamColor: player.team_color,
        totalScore: player.total_score,
        totalClicks: player.total_clicks,
        totalCellsCaptured: player.total_cells_captured,
        chzBalance: player.chz_balance
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * @swagger
 * /api/auth/nonce:
 *   get:
 *     summary: Get nonce for wallet signature
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Ethereum wallet address
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 */
router.get('/nonce', [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum wallet address')
], async (req, res) => {
  try {
    const { walletAddress } = req.query;
    const nonce = generateNonce();
    const message = `Login to Chain League\n\nWallet: ${walletAddress}\nNonce: ${nonce}\n\nBy signing this message, you agree to authenticate with Chain League.`;
    
    // Store nonce in Redis for verification (optional)
    const { setWithExpiry } = require('../database/redis');
    await setWithExpiry(`nonce:${walletAddress}`, { nonce, timestamp: Date.now() }, 300); // 5 minutes
    
    res.json({
      nonce,
      message,
      expiresIn: 300
    });
  } catch (error) {
    logger.error('Nonce generation error:', error);
    res.status(500).json({
      error: 'Nonce generation failed',
      message: 'An error occurred while generating nonce'
    });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     summary: Verify JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token is invalid
 */
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Please provide a valid authentication token'
      });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }
    
    res.json({
      valid: true,
      player: {
        playerId: decoded.playerId,
        walletAddress: decoded.walletAddress,
        username: decoded.username
      }
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: 'An error occurred during token verification'
    });
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current player profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player profile retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token'
      });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }
    
    const playerResult = await query(
      `SELECT p.*, t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.id = $1 AND p.wallet_address = $2`,
      [decoded.playerId, decoded.walletAddress.toLowerCase()]
    );
    
    if (playerResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: 'The authenticated player does not exist'
      });
    }
    
    const player = playerResult.rows[0];
    
    res.json({
      player: {
        id: player.id,
        username: player.username,
        email: player.email,
        walletAddress: player.wallet_address,
        subscriptionStatus: player.subscription_status,
        subscriptionExpiresAt: player.subscription_expires_at,
        teamId: player.team_id,
        teamName: player.team_name,
        teamColor: player.team_color,
        totalScore: player.total_score,
        totalClicks: player.total_clicks,
        totalCellsCaptured: player.total_cells_captured,
        chzBalance: player.chz_balance,
        createdAt: player.created_at,
        updatedAt: player.updated_at
      }
    });
  } catch (error) {
    logger.error('Profile retrieval error:', error);
    res.status(500).json({
      error: 'Profile retrieval failed',
      message: 'An error occurred while retrieving the profile'
    });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new player
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - username
 *               - signature
 *               - message
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Ethereum wallet address
 *               username:
 *                 type: string
 *                 description: Player username
 *               signature:
 *                 type: string
 *                 description: Signature of the message
 *               message:
 *                 type: string
 *                 description: Message that was signed
 *     responses:
 *       201:
 *         description: Player registered successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Username already taken
 */
router.post('/register', [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum wallet address'),
  body('username')
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'),
  body('signature')
    .notEmpty()
    .withMessage('Signature is required'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg
      });
    }

    const { walletAddress, username, signature, message } = req.body;

    // Normaliser l'adresse wallet en minuscules
    const normalizedWalletAddress = walletAddress.toLowerCase();

    // Verify signature
    const isValidSignature = await verifySignature(message, signature, normalizedWalletAddress);
    if (!isValidSignature) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'The provided signature is invalid'
      });
    }

    // Check if wallet address already exists
    const existingWalletResult = await query(
      'SELECT id FROM players WHERE wallet_address = $1',
      [normalizedWalletAddress]
    );

    if (existingWalletResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Wallet already registered',
        message: 'This wallet address is already registered'
      });
    }

    // Check if username is already taken
    const existingUsernameResult = await query(
      'SELECT id FROM players WHERE username = $1',
      [username]
    );

    if (existingUsernameResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Username already taken',
        message: 'This username is already taken'
      });
    }

    // Create new player
    const newPlayerResult = await query(
      `INSERT INTO players (
        username, 
        wallet_address, 
        chz_balance, 
        level, 
        xp, 
        subscription_status,
        total_score,
        total_clicks,
        total_cells_captured,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [username, normalizedWalletAddress, 1000, 1, 0, 'basic', 0, 0, 0]
    );

    const newPlayer = newPlayerResult.rows[0];

    // Generate JWT token
    const token = generateToken({
      playerId: newPlayer.id,
      walletAddress: newPlayer.wallet_address.toLowerCase(),
      username: newPlayer.username
    });

    logger.info(`New player registered: ${newPlayer.username} (${newPlayer.wallet_address})`);

    res.status(201).json({
      message: 'Registration successful',
      player: {
        id: newPlayer.id,
        username: newPlayer.username,
        email: newPlayer.email,
        walletAddress: newPlayer.wallet_address,
        subscriptionStatus: newPlayer.subscription_status,
        subscriptionExpiresAt: newPlayer.subscription_expires_at,
        teamId: newPlayer.team_id,
        teamName: null,
        teamColor: null,
        totalScore: newPlayer.total_score,
        totalClicks: newPlayer.total_clicks,
        totalCellsCaptured: newPlayer.total_cells_captured,
        chzBalance: newPlayer.chz_balance
      },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

module.exports = router; 