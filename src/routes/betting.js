const express = require('express');
const { body, query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken, requireSubscription } = require('../middleware/auth');
const { verifySignature, createBettingMessage, generateNonce } = require('../services/web3Service');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/betting/sessions:
 *   get:
 *     summary: Get betting sessions
 *     tags: [Betting]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, all]
 *         description: Filter by session status
 *     responses:
 *       200:
 *         description: Betting sessions retrieved successfully
 */
router.get('/sessions', [
  query('status').optional().isIn(['active', 'completed', 'all'])
], async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    
    let query = `
      SELECT gs.*, 
             COUNT(DISTINCT b.player_id) as total_bettors,
             SUM(b.amount) as total_bets,
             COUNT(DISTINCT b.team_id) as teams_bet_on
      FROM game_sessions gs
      LEFT JOIN bets b ON gs.id = b.session_id
      WHERE gs.status IN ('betting', 'active', 'completed')
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status !== 'all') {
      query += ` AND gs.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` GROUP BY gs.id ORDER BY gs.created_at DESC`;
    
    const sessionsResult = await dbQuery(query, params);
    
    res.json({
      sessions: sessionsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching betting sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch betting sessions',
      message: 'An error occurred while retrieving betting sessions'
    });
  }
});

/**
 * @swagger
 * /api/betting/sessions/{sessionId}:
 *   get:
 *     summary: Get betting session details
 *     tags: [Betting]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session details retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionResult = await dbQuery(
      `SELECT gs.*, 
              COUNT(DISTINCT b.player_id) as total_bettors,
              SUM(b.amount) as total_bets,
              COUNT(DISTINCT b.team_id) as teams_bet_on
       FROM game_sessions gs
       LEFT JOIN bets b ON gs.id = b.session_id
       WHERE gs.id = $1
       GROUP BY gs.id`,
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The specified session does not exist'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get team betting statistics
    const teamBetsResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(b.id) as bet_count,
              SUM(b.amount) as total_amount,
              AVG(b.amount) as avg_amount
       FROM teams t
       LEFT JOIN bets b ON t.id = b.team_id AND b.session_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY total_amount DESC`,
      [sessionId]
    );
    
    // Get recent bets
    const recentBetsResult = await dbQuery(
      `SELECT b.*, p.username, t.name as team_name, t.color as team_color
       FROM bets b
       JOIN players p ON b.player_id = p.id
       JOIN teams t ON b.team_id = t.id
       WHERE b.session_id = $1
       ORDER BY b.created_at DESC
       LIMIT 20`,
      [sessionId]
    );
    
    res.json({
      session,
      teamBets: teamBetsResult.rows,
      recentBets: recentBetsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching betting session:', error);
    res.status(500).json({
      error: 'Failed to fetch betting session',
      message: 'An error occurred while retrieving session details'
    });
  }
});

/**
 * @swagger
 * /api/betting/place:
 *   post:
 *     summary: Place a bet
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - teamId
 *               - amount
 *               - signature
 *               - message
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               teamId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 minimum: 0.1
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bet placed successfully
 *       400:
 *         description: Invalid bet parameters
 *       403:
 *         description: Subscription required
 */
router.post('/place', [
  authenticateToken,
  requireSubscription,
  body('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),
  body('teamId')
    .isUUID()
    .withMessage('Invalid team ID'),
  body('amount')
    .isFloat({ min: 0.1 })
    .withMessage('Bet amount must be at least 0.1 CHZ'),
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
    const { sessionId, teamId, amount, signature, message } = req.body;
    
    // Verify signature
    const isValidSignature = await verifySignature(message, signature, req.player.wallet_address);
    if (!isValidSignature) {
      return res.status(400).json({
        error: 'Invalid signature',
        message: 'The provided signature is invalid'
      });
    }
    
    // Check if session exists and is in betting phase
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE id = $1 AND status = $2',
      [sessionId, 'betting']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid session',
        message: 'Session is not in betting phase or does not exist'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Check if betting period is still open
    const now = new Date();
    if (now < session.betting_start_date || now > session.betting_end_date) {
      return res.status(400).json({
        error: 'Betting closed',
        message: 'Betting period is not open for this session'
      });
    }
    
    // Check if team exists
    const teamResult = await dbQuery(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );
    
    if (teamResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Team not found',
        message: 'The specified team does not exist'
      });
    }
    
    // Check if player has already bet on this session
    const existingBetResult = await dbQuery(
      'SELECT * FROM bets WHERE player_id = $1 AND session_id = $2',
      [req.player.id, sessionId]
    );
    
    if (existingBetResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Already bet',
        message: 'You have already placed a bet on this session'
      });
    }
    
    // Check if player has sufficient balance
    if (req.player.chz_balance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: 'You do not have enough CHZ to place this bet'
      });
    }
    
    // Place the bet
    const betResult = await dbQuery(
      `INSERT INTO bets (player_id, session_id, team_id, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.player.id, sessionId, teamId, amount]
    );
    
    const bet = betResult.rows[0];
    
    // Deduct amount from player balance
    await dbQuery(
      'UPDATE players SET chz_balance = chz_balance - $1 WHERE id = $2',
      [amount, req.player.id]
    );
    
    // Update session total bets
    await dbQuery(
      'UPDATE game_sessions SET total_bets = total_bets + $1 WHERE id = $2',
      [amount, sessionId]
    );
    
    logger.info(`Player ${req.player.username} placed bet of ${amount} CHZ on team ${teamResult.rows[0].name}`);
    
    res.json({
      message: 'Bet placed successfully',
      bet: {
        id: bet.id,
        amount: bet.amount,
        teamId: bet.team_id,
        sessionId: bet.session_id,
        status: bet.status,
        createdAt: bet.created_at
      }
    });
  } catch (error) {
    logger.error('Error placing bet:', error);
    res.status(500).json({
      error: 'Failed to place bet',
      message: 'An error occurred while placing the bet'
    });
  }
});

/**
 * @swagger
 * /api/betting/my-bets:
 *   get:
 *     summary: Get player's bets
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player bets retrieved successfully
 */
router.get('/my-bets', [
  authenticateToken
], async (req, res) => {
  try {
    const betsResult = await dbQuery(
      `SELECT b.*, gs.name as session_name, gs.status as session_status,
              t.name as team_name, t.color as team_color,
              gs.winner_team_id
       FROM bets b
       JOIN game_sessions gs ON b.session_id = gs.id
       JOIN teams t ON b.team_id = t.id
       WHERE b.player_id = $1
       ORDER BY b.created_at DESC`,
      [req.player.id]
    );
    
    res.json({
      bets: betsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching player bets:', error);
    res.status(500).json({
      error: 'Failed to fetch bets',
      message: 'An error occurred while retrieving your bets'
    });
  }
});

/**
 * @swagger
 * /api/betting/odds:
 *   get:
 *     summary: Get current betting odds
 *     tags: [Betting]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Odds retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/odds', [
  query('sessionId').isUUID()
], async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    // Check if session exists
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The specified session does not exist'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get total bets for this session
    const totalBetsResult = await dbQuery(
      'SELECT SUM(amount) as total_amount FROM bets WHERE session_id = $1',
      [sessionId]
    );
    
    const totalAmount = parseFloat(totalBetsResult.rows[0].total_amount) || 0;
    
    // Get team betting statistics
    const teamBetsResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(b.id) as bet_count,
              SUM(b.amount) as total_amount
       FROM teams t
       LEFT JOIN bets b ON t.id = b.team_id AND b.session_id = $1
       GROUP BY t.id, t.name, t.color
       ORDER BY total_amount DESC`,
      [sessionId]
    );
    
    // Calculate odds for each team
    const odds = teamBetsResult.rows.map(team => {
      const teamAmount = parseFloat(team.total_amount) || 0;
      const odds = totalAmount > 0 ? (totalAmount / teamAmount).toFixed(2) : 0;
      
      return {
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        betCount: parseInt(team.bet_count),
        totalAmount: parseFloat(team.total_amount) || 0,
        odds: parseFloat(odds),
        percentage: totalAmount > 0 ? ((teamAmount / totalAmount) * 100).toFixed(2) : 0
      };
    });
    
    res.json({
      session: {
        id: session.id,
        name: session.name,
        status: session.status
      },
      totalAmount,
      odds
    });
  } catch (error) {
    logger.error('Error calculating odds:', error);
    res.status(500).json({
      error: 'Failed to calculate odds',
      message: 'An error occurred while calculating betting odds'
    });
  }
});

/**
 * @swagger
 * /api/betting/nonce:
 *   get:
 *     summary: Get nonce for betting signature
 *     tags: [Betting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Bet amount
 *     responses:
 *       200:
 *         description: Nonce generated successfully
 */
router.get('/nonce', [
  authenticateToken,
  query('sessionId').isUUID(),
  query('teamId').isUUID(),
  query('amount').isFloat({ min: 0.1 })
], async (req, res) => {
  try {
    const { sessionId, teamId, amount } = req.query;
    const nonce = generateNonce();
    const message = createBettingMessage(sessionId, teamId, amount, nonce);
    
    // Store nonce in Redis for verification
    const { setWithExpiry } = require('../database/redis');
    await setWithExpiry(`bet_nonce:${req.player.id}:${sessionId}`, { 
      nonce, 
      teamId, 
      amount, 
      timestamp: Date.now() 
    }, 300); // 5 minutes
    
    res.json({
      nonce,
      message,
      expiresIn: 300
    });
  } catch (error) {
    logger.error('Error generating betting nonce:', error);
    res.status(500).json({
      error: 'Nonce generation failed',
      message: 'An error occurred while generating nonce'
    });
  }
});

module.exports = router; 