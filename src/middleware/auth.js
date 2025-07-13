const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const { logger } = require('../utils/logger');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
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
    
    // Get player data from database
    const playerResult = await query(
      'SELECT * FROM players WHERE id = $1 AND wallet_address = $2',
      [decoded.playerId, decoded.walletAddress]
    );
    
    if (playerResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Player not found',
        message: 'The authenticated player does not exist'
      });
    }
    
    const player = playerResult.rows[0];
    
    // Check if subscription is still valid
    if (player.subscription_status === 'premium' && player.subscription_expires_at) {
      if (new Date() > new Date(player.subscription_expires_at)) {
        // Update subscription status to expired
        await query(
          'UPDATE players SET subscription_status = $1 WHERE id = $2',
          ['expired', player.id]
        );
        player.subscription_status = 'expired';
      }
    }
    
    req.player = player;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return next();
    }
    
    const playerResult = await query(
      'SELECT * FROM players WHERE id = $1 AND wallet_address = $2',
      [decoded.playerId, decoded.walletAddress]
    );
    
    if (playerResult.rows.length > 0) {
      req.player = playerResult.rows[0];
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

// Check if player has active subscription
const requireSubscription = (req, res, next) => {
  if (!req.player) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please authenticate to access this feature'
    });
  }
  
  if (req.player.subscription_status !== 'premium') {
    return res.status(403).json({ 
      error: 'Subscription required',
      message: 'This feature requires an active premium subscription'
    });
  }
  
  next();
};

// Check if player is in a team
const requireTeam = (req, res, next) => {
  if (!req.player) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please authenticate to access this feature'
    });
  }
  
  if (!req.player.team_id) {
    return res.status(403).json({ 
      error: 'Team membership required',
      message: 'You must join a team to access this feature'
    });
  }
  
  next();
};

// Rate limiting for clicks
const clickRateLimit = async (req, res, next) => {
  if (!req.player) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please authenticate to access this feature'
    });
  }
  
  const cooldownSeconds = parseInt(process.env.CLICK_COOLDOWN_SECONDS) || 180;
  const lastClickKey = `last_click:${req.player.id}`;
  
  try {
    const { get, setWithExpiry } = require('../database/redis');
    const lastClick = await get(lastClickKey);
    
    if (lastClick) {
      const timeSinceLastClick = (Date.now() - lastClick.timestamp) / 1000;
      const remainingCooldown = cooldownSeconds - timeSinceLastClick;
      
      if (remainingCooldown > 0) {
        return res.status(429).json({ 
          error: 'Click cooldown',
          message: `Please wait ${Math.ceil(remainingCooldown)} seconds before clicking again`,
          remainingCooldown: Math.ceil(remainingCooldown)
        });
      }
    }
    
    // Set new click timestamp
    await setWithExpiry(lastClickKey, {
      playerId: req.player.id,
      timestamp: Date.now()
    }, cooldownSeconds);
    
    next();
  } catch (error) {
    logger.error('Click rate limit error:', error);
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireSubscription,
  requireTeam,
  clickRateLimit
}; 