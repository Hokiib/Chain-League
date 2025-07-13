const express = require('express');
const { query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { body } = require('express-validator');

const router = express.Router();

/**
 * @swagger
 * /api/players:
 *   get:
 *     summary: Get all players
 *     tags: [Players]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of players per page
 *       - in: query
 *         name: team_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by team ID
 *       - in: query
 *         name: subscription_status
 *         schema:
 *           type: string
 *           enum: [free, premium, expired]
 *         description: Filter by subscription status
 *     responses:
 *       200:
 *         description: List of players retrieved successfully
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('team_id').optional().isUUID(),
  query('subscription_status').optional().isIn(['free', 'premium', 'expired'])
], async (req, res) => {
  try {
    const { page = 1, limit = 20, team_id, subscription_status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT p.*, t.name as team_name, t.color as team_color
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (team_id) {
      query += ` AND p.team_id = $${paramIndex}`;
      params.push(team_id);
      paramIndex++;
    }
    
    if (subscription_status) {
      query += ` AND p.subscription_status = $${paramIndex}`;
      params.push(subscription_status);
      paramIndex++;
    }
    
    query += ` ORDER BY p.total_score DESC, p.created_at ASC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const playersResult = await dbQuery(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) FROM players p WHERE 1=1
    `;
    
    const countParams = [];
    let countParamIndex = 1;
    
    if (team_id) {
      countQuery += ` AND p.team_id = $${countParamIndex}`;
      countParams.push(team_id);
      countParamIndex++;
    }
    
    if (subscription_status) {
      countQuery += ` AND p.subscription_status = $${countParamIndex}`;
      countParams.push(subscription_status);
      countParamIndex++;
    }
    
    const countResult = await dbQuery(countQuery, countParams);
    const totalPlayers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPlayers / limit);
    
    res.json({
      players: playersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPlayers,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching players:', error);
    res.status(500).json({
      error: 'Failed to fetch players',
      message: 'An error occurred while retrieving players'
    });
  }
});

/**
 * @swagger
 * /api/players/{id}:
 *   get:
 *     summary: Get player by ID
 *     tags: [Players]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Player ID
 *     responses:
 *       200:
 *         description: Player details retrieved successfully
 *       404:
 *         description: Player not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const playerResult = await dbQuery(
      `SELECT p.*, t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.id = $1`,
      [id]
    );
    
    if (playerResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: 'The specified player does not exist'
      });
    }
    
    const player = playerResult.rows[0];
    
    // Get player's recent activity
    const recentActivityResult = await dbQuery(
      `SELECT pc.damage_dealt, pc.created_at, gs.name as session_name,
              mc.x_coordinate, mc.y_coordinate
       FROM player_clicks pc
       JOIN game_sessions gs ON pc.session_id = gs.id
       JOIN map_cells mc ON pc.cell_id = mc.id
       WHERE pc.player_id = $1
       ORDER BY pc.created_at DESC
       LIMIT 20`,
      [id]
    );
    
    // Get player's session statistics
    const sessionStatsResult = await dbQuery(
      `SELECT gs.name as session_name, gs.status as session_status,
              COUNT(pc.id) as clicks,
              SUM(pc.damage_dealt) as damage,
              COUNT(DISTINCT pc.cell_id) as cells_clicked
       FROM player_clicks pc
       JOIN game_sessions gs ON pc.session_id = gs.id
       WHERE pc.player_id = $1
       GROUP BY gs.id, gs.name, gs.status
       ORDER BY gs.created_at DESC`,
      [id]
    );
    
    // Get player's subscription history
    const subscriptionHistoryResult = await dbQuery(
      `SELECT s.plan_type, s.amount, s.start_date, s.end_date, s.status, s.transaction_hash
       FROM subscriptions s
       WHERE s.player_id = $1
       ORDER BY s.created_at DESC`,
      [id]
    );
    
    res.json({
      player: {
        ...player,
        recentActivity: recentActivityResult.rows,
        sessionStats: sessionStatsResult.rows,
        subscriptionHistory: subscriptionHistoryResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching player:', error);
    res.status(500).json({
      error: 'Failed to fetch player',
      message: 'An error occurred while retrieving player details'
    });
  }
});

/**
 * @swagger
 * /api/players/search:
 *   get:
 *     summary: Search players by username
 *     tags: [Players]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 */
router.get('/search', [
  query('q').isString().isLength({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    const searchResult = await dbQuery(
      `SELECT p.id, p.username, p.total_score, p.total_clicks, p.total_cells_captured,
              p.subscription_status, t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.username ILIKE $1
       ORDER BY p.total_score DESC
       LIMIT $2`,
      [`%${q}%`, limit]
    );
    
    res.json({
      query: q,
      results: searchResult.rows,
      totalResults: searchResult.rows.length
    });
  } catch (error) {
    logger.error('Error searching players:', error);
    res.status(500).json({
      error: 'Failed to search players',
      message: 'An error occurred while searching players'
    });
  }
});

/**
 * @swagger
 * /api/players/stats:
 *   get:
 *     summary: Get player statistics
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player statistics retrieved successfully
 */
router.get('/stats', [
  authenticateToken
], async (req, res) => {
  try {
    // Get player's global ranking
    const rankingResult = await dbQuery(
      `SELECT COUNT(*) + 1 as rank
       FROM players
       WHERE total_score > $1`,
      [req.player.total_score]
    );
    
    // Get player's team ranking (if in a team)
    let teamRanking = null;
    if (req.player.team_id) {
      const teamRankingResult = await dbQuery(
        `SELECT COUNT(*) + 1 as rank
         FROM (
           SELECT t.id, SUM(p.total_score) as team_score
           FROM teams t
           JOIN players p ON t.id = p.team_id
           GROUP BY t.id
         ) team_scores
         WHERE team_score > (
           SELECT SUM(p.total_score)
           FROM players p
           WHERE p.team_id = $1
         )`,
        [req.player.team_id]
      );
      teamRanking = parseInt(teamRankingResult.rows[0].rank);
    }
    
    // Get player's session statistics
    const sessionStatsResult = await dbQuery(
      `SELECT gs.name as session_name, gs.status as session_status,
              COUNT(pc.id) as clicks,
              SUM(pc.damage_dealt) as damage,
              COUNT(DISTINCT pc.cell_id) as cells_clicked,
              COUNT(CASE WHEN mc.team_id = $1 THEN 1 END) as cells_captured
       FROM player_clicks pc
       JOIN game_sessions gs ON pc.session_id = gs.id
       LEFT JOIN map_cells mc ON pc.cell_id = mc.id
       WHERE pc.player_id = $1
       GROUP BY gs.id, gs.name, gs.status
       ORDER BY gs.created_at DESC`,
      [req.player.id]
    );
    
    // Get player's achievements
    const achievements = [];
    
    if (req.player.total_score >= 1000) achievements.push('Score Master');
    if (req.player.total_score >= 5000) achievements.push('Score Legend');
    if (req.player.total_clicks >= 100) achievements.push('Clicker');
    if (req.player.total_clicks >= 1000) achievements.push('Click Master');
    if (req.player.total_cells_captured >= 10) achievements.push('Territory Conqueror');
    if (req.player.total_cells_captured >= 50) achievements.push('Territory Master');
    if (req.player.subscription_status === 'premium') achievements.push('Premium Member');
    
    res.json({
      player: {
        id: req.player.id,
        username: req.player.username,
        totalScore: req.player.total_score,
        totalClicks: req.player.total_clicks,
        totalCellsCaptured: req.player.total_cells_captured,
        subscriptionStatus: req.player.subscription_status,
        globalRank: parseInt(rankingResult.rows[0].rank),
        teamRank: teamRanking
      },
      sessionStats: sessionStatsResult.rows,
      achievements
    });
  } catch (error) {
    logger.error('Error fetching player stats:', error);
    res.status(500).json({
      error: 'Failed to fetch player statistics',
      message: 'An error occurred while retrieving player statistics'
    });
  }
});

/**
 * @swagger
 * /api/players/update-profile:
 *   put:
 *     summary: Update player profile
 *     tags: [Players]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Username or email already taken
 */
router.put('/update-profile', [
  authenticateToken,
  body('username')
    .optional()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 characters, alphanumeric and underscore only'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address')
], async (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Check if username is already taken
    if (username && username !== req.player.username) {
      const existingUsernameResult = await dbQuery(
        'SELECT id FROM players WHERE username = $1 AND id != $2',
        [username, req.player.id]
      );
      
      if (existingUsernameResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Username taken',
          message: 'This username is already taken'
        });
      }
    }
    
    // Check if email is already taken
    if (email && email !== req.player.email) {
      const existingEmailResult = await dbQuery(
        'SELECT id FROM players WHERE email = $1 AND id != $2',
        [email, req.player.id]
      );
      
      if (existingEmailResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already registered',
          message: 'This email is already registered'
        });
      }
    }
    
    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (username) {
      updates.push(`username = $${paramIndex}`);
      params.push(username);
      paramIndex++;
    }
    
    if (email) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Please provide at least one field to update'
      });
    }
    
    params.push(req.player.id);
    
    const updateQuery = `
      UPDATE players 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const updateResult = await dbQuery(updateQuery, params);
    
    logger.info(`Player ${req.player.username} updated their profile`);
    
    res.json({
      message: 'Profile updated successfully',
      player: updateResult.rows[0]
    });
  } catch (error) {
    logger.error('Error updating player profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'An error occurred while updating the profile'
    });
  }
});

module.exports = router; 