const express = require('express');
const { body } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { verifySignature, createSubscriptionMessage, generateNonce, verifyTransaction } = require('../services/web3Service');
const { logger } = require('../utils/logger');

const router = express.Router();

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'Monthly Premium',
    price: 10, // CHZ
    duration: 30, // days
    features: ['Unlimited clicks', 'Priority support', 'Exclusive events']
  },
  yearly: {
    name: 'Yearly Premium',
    price: 100, // CHZ
    duration: 365, // days
    features: ['Unlimited clicks', 'Priority support', 'Exclusive events', '2 months free']
  },
  lifetime: {
    name: 'Lifetime Premium',
    price: 500, // CHZ
    duration: 36500, // ~100 years
    features: ['Unlimited clicks', 'Priority support', 'Exclusive events', 'Lifetime access']
  }
};

/**
 * @swagger
 * /api/subscriptions/plans:
 *   get:
 *     summary: Get available subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 */
router.get('/plans', async (req, res) => {
  try {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      currency: 'CHZ',
      network: process.env.CHILIZ_NETWORK || 'testnet'
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription plans',
      message: 'An error occurred while retrieving subscription plans'
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/subscribe:
 *   post:
 *     summary: Subscribe to a premium plan
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - signature
 *               - message
 *               - transactionHash
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [monthly, yearly, lifetime]
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               transactionHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription successful
 *       400:
 *         description: Invalid subscription parameters
 */
router.post('/subscribe', [
  authenticateToken,
  body('planId')
    .isIn(['monthly', 'yearly', 'lifetime'])
    .withMessage('Invalid subscription plan'),
  body('signature')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Signature is required'),
  body('message')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Message is required'),
  body('transactionHash')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Transaction hash is required')
], async (req, res) => {
  try {
    const { planId, signature, message, transactionHash } = req.body;
    
    // Verify signature
    const isValidSignature = await verifySignature(message, signature, req.player.wallet_address);
    if (!isValidSignature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'The provided signature is invalid'
      });
    }
    
    // Get plan details
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: 'The specified subscription plan does not exist'
      });
    }
    
    // Verify transaction on blockchain
    const transactionVerification = await verifyTransaction(
      transactionHash,
      plan.price,
      process.env.CHILIZ_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'
    );
    
    if (!transactionVerification.valid) {
      return res.status(400).json({
        error: 'Transaction verification failed',
        message: transactionVerification.error
      });
    }
    
    // Check if player already has an active subscription
    const currentSubscriptionResult = await dbQuery(
      'SELECT * FROM subscriptions WHERE player_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.player.id, 'active']
    );
    
    let startDate = new Date();
    let endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));
    
    // If player has active subscription, extend it
    if (currentSubscriptionResult.rows.length > 0) {
      const currentSubscription = currentSubscriptionResult.rows[0];
      const currentEndDate = new Date(currentSubscription.end_date);
      
      if (currentEndDate > startDate) {
        startDate = currentEndDate;
        endDate = new Date(startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));
      }
    }
    
    // Create subscription record
    const subscriptionResult = await dbQuery(
      `INSERT INTO subscriptions (player_id, plan_type, amount, start_date, end_date, transaction_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.player.id, planId, plan.price, startDate, endDate, transactionHash]
    );
    
    const subscription = subscriptionResult.rows[0];
    
    // Update player subscription status
    await dbQuery(
      `UPDATE players 
       SET subscription_status = $1, subscription_expires_at = $2
       WHERE id = $3`,
      ['premium', endDate, req.player.id]
    );
    
    logger.info(`Player ${req.player.username} subscribed to ${planId} plan for ${plan.price} CHZ`);
    
    res.json({
      message: 'Subscription successful',
      subscription: {
        id: subscription.id,
        planType: subscription.plan_type,
        amount: subscription.amount,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        status: subscription.status
      },
      plan: {
        name: plan.name,
        features: plan.features
      }
    });
  } catch (error) {
    logger.error('Error processing subscription:', error);
    res.status(500).json({
      error: 'Subscription failed',
      message: 'An error occurred while processing the subscription'
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/status:
 *   get:
 *     summary: Get player's subscription status
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status retrieved successfully
 */
router.get('/status', [
  authenticateToken
], async (req, res) => {
  try {
    // Get current subscription
    const subscriptionResult = await dbQuery(
      `SELECT s.*, p.subscription_status, p.subscription_expires_at
       FROM subscriptions s
       JOIN players p ON s.player_id = p.id
       WHERE s.player_id = $1 AND s.status = $2
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [req.player.id, 'active']
    );
    
    let subscription = null;
    if (subscriptionResult.rows.length > 0) {
      subscription = subscriptionResult.rows[0];
      
      // Check if subscription is still valid
      if (new Date() > new Date(subscription.end_date)) {
        // Update subscription status to expired
        await dbQuery(
          'UPDATE players SET subscription_status = $1 WHERE id = $2',
          ['expired', req.player.id]
        );
        
        await dbQuery(
          'UPDATE subscriptions SET status = $1 WHERE id = $2',
          ['expired', subscription.id]
        );
        
        subscription.status = 'expired';
        req.player.subscription_status = 'expired';
      }
    }
    
    // Get subscription history
    const historyResult = await dbQuery(
      `SELECT s.*, p.subscription_status
       FROM subscriptions s
       JOIN players p ON s.player_id = p.id
       WHERE s.player_id = $1
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [req.player.id]
    );
    
    res.json({
      currentSubscription: subscription,
      subscriptionStatus: req.player.subscription_status,
      subscriptionExpiresAt: req.player.subscription_expires_at,
      history: historyResult.rows
    });
  } catch (error) {
    logger.error('Error fetching subscription status:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription status',
      message: 'An error occurred while retrieving subscription status'
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/nonce:
 *   get:
 *     summary: Get nonce for subscription signature
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [monthly, yearly, lifetime]
 *         description: Subscription plan ID
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 */
router.get('/nonce', [
  authenticateToken,
  body('planId').isIn(['monthly', 'yearly', 'lifetime'])
], async (req, res) => {
  try {
    const { planId } = req.query;
    
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: 'The specified subscription plan does not exist'
      });
    }
    
    const nonce = generateNonce();
    const message = createSubscriptionMessage(planId, plan.price, nonce);
    
    // Store nonce in Redis for verification
    const { setWithExpiry } = require('../database/redis');
    await setWithExpiry(`sub_nonce:${req.player.id}:${planId}`, { 
      nonce, 
      planId, 
      amount: plan.price, 
      timestamp: Date.now() 
    }, 300); // 5 minutes
    
    res.json({
      nonce,
      message,
      plan: {
        id: planId,
        name: plan.name,
        price: plan.price,
        duration: plan.duration,
        features: plan.features
      },
      expiresIn: 300
    });
  } catch (error) {
    logger.error('Error generating subscription nonce:', error);
    res.status(500).json({
      error: 'Nonce generation failed',
      message: 'An error occurred while generating nonce'
    });
  }
});

/**
 * @swagger
 * /api/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       400:
 *         description: No active subscription to cancel
 */
router.post('/cancel', [
  authenticateToken
], async (req, res) => {
  try {
    // Check if player has active subscription
    if (req.player.subscription_status !== 'premium') {
      return res.status(400).json({
        error: 'No active subscription',
        message: 'You do not have an active subscription to cancel'
      });
    }
    
    // Get current subscription
    const subscriptionResult = await dbQuery(
      'SELECT * FROM subscriptions WHERE player_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.player.id, 'active']
    );
    
    if (subscriptionResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No active subscription',
        message: 'No active subscription found'
      });
    }
    
    const subscription = subscriptionResult.rows[0];
    
    // Cancel subscription (set to expire at current time)
    await dbQuery(
      'UPDATE subscriptions SET status = $1 WHERE id = $2',
      ['cancelled', subscription.id]
    );
    
    await dbQuery(
      'UPDATE players SET subscription_status = $1 WHERE id = $2',
      ['cancelled', req.player.id]
    );
    
    logger.info(`Player ${req.player.username} cancelled their subscription`);
    
    res.json({
      message: 'Subscription cancelled successfully',
      cancelledAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: 'An error occurred while cancelling the subscription'
    });
  }
});

module.exports = router; 