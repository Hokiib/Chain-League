const express = require('express');
const { body, query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken, requireTeam } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
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
 *         description: Number of teams per page
 *     responses:
 *       200:
 *         description: List of teams retrieved successfully
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const teamsResult = await dbQuery(
      `SELECT t.*, 
              COUNT(p.id) as member_count,
              AVG(p.total_score) as avg_score
       FROM teams t
       LEFT JOIN players p ON t.id = p.team_id
       GROUP BY t.id
       ORDER BY t.total_score DESC, t.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await dbQuery('SELECT COUNT(*) FROM teams');
    const totalTeams = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalTeams / limit);
    
    res.json({
      teams: teamsResult.rows,
      pagination: {
        page,
        limit,
        totalTeams,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error fetching teams:', error);
    res.status(500).json({
      error: 'Failed to fetch teams',
      message: 'An error occurred while retrieving teams'
    });
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team details retrieved successfully
 *       404:
 *         description: Team not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const teamResult = await dbQuery(
      `SELECT t.*, 
              COUNT(p.id) as member_count,
              AVG(p.total_score) as avg_score,
              MAX(p.total_score) as max_score
       FROM teams t
       LEFT JOIN players p ON t.id = p.team_id
       WHERE t.id = $1
       GROUP BY t.id`,
      [id]
    );
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Team not found',
        message: 'The specified team does not exist'
      });
    }
    
    const team = teamResult.rows[0];
    
    // Get team members
    const membersResult = await dbQuery(
      `SELECT p.id, p.username, p.total_score, p.total_clicks, p.total_cells_captured, p.created_at
       FROM players p
       WHERE p.team_id = $1
       ORDER BY p.total_score DESC`,
      [id]
    );
    
    res.json({
      team: {
        ...team,
        members: membersResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching team:', error);
    res.status(500).json({
      error: 'Failed to fetch team',
      message: 'An error occurred while retrieving team details'
    });
  }
});

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - color
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 30
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *               logo:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Team name already exists
 */
router.post('/', [
  authenticateToken,
  body('name')
    .isLength({ min: 2, max: 30 })
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Team name must be 2-30 characters, alphanumeric and spaces only'),
  body('color')
    .isHexColor()
    .withMessage('Invalid color format (hex)'),
  body('logo')
    .optional()
    .isURL()
    .withMessage('Invalid logo URL')
], async (req, res) => {
  try {
    const { name, color, logo } = req.body;
    
    // Check if team name already exists
    const existingTeam = await dbQuery(
      'SELECT id FROM teams WHERE name = $1',
      [name]
    );
    
    if (existingTeam.rows.length > 0) {
      return res.status(409).json({
        error: 'Team name already exists',
        message: 'A team with this name already exists'
      });
    }
    
    // Create team
    const teamResult = await dbQuery(
      `INSERT INTO teams (name, color, logo_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, color, logo]
    );
    
    const team = teamResult.rows[0];
    
    logger.info(`New team created: ${team.name} by ${req.player.username}`);
    
    res.status(201).json({
      message: 'Team created successfully',
      team
    });
  } catch (error) {
    logger.error('Error creating team:', error);
    res.status(500).json({
      error: 'Failed to create team',
      message: 'An error occurred while creating the team'
    });
  }
});

/**
 * @swagger
 * /api/teams/{id}/join:
 *   post:
 *     summary: Join a team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Successfully joined team
 *       400:
 *         description: Already in a team
 *       404:
 *         description: Team not found
 */
router.post('/:id/join', [
  authenticateToken
], async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if player is already in a team
    if (req.player.team_id) {
      return res.status(400).json({
        error: 'Already in a team',
        message: 'You are already a member of a team'
      });
    }
    
    // Check if team exists
    const teamResult = await dbQuery(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Team not found',
        message: 'The specified team does not exist'
      });
    }
    
    // Join team
    await dbQuery(
      'UPDATE players SET team_id = $1 WHERE id = $2',
      [id, req.player.id]
    );
    
    logger.info(`Player ${req.player.username} joined team ${teamResult.rows[0].name}`);
    
    res.json({
      message: 'Successfully joined team',
      team: teamResult.rows[0]
    });
  } catch (error) {
    logger.error('Error joining team:', error);
    res.status(500).json({
      error: 'Failed to join team',
      message: 'An error occurred while joining the team'
    });
  }
});

/**
 * @swagger
 * /api/teams/{id}/leave:
 *   post:
 *     summary: Leave current team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Successfully left team
 *       400:
 *         description: Not a member of this team
 */
router.post('/:id/leave', [
  authenticateToken,
  requireTeam
], async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if player is a member of this team
    if (req.player.team_id !== id) {
      return res.status(400).json({
        error: 'Not a member of this team',
        message: 'You are not a member of this team'
      });
    }
    
    // Leave team
    await dbQuery(
      'UPDATE players SET team_id = NULL WHERE id = $1',
      [req.player.id]
    );
    
    logger.info(`Player ${req.player.username} left team ${id}`);
    
    res.json({
      message: 'Successfully left team'
    });
  } catch (error) {
    logger.error('Error leaving team:', error);
    res.status(500).json({
      error: 'Failed to leave team',
      message: 'An error occurred while leaving the team'
    });
  }
});

/**
 * @swagger
 * /api/teams/leaderboard:
 *   get:
 *     summary: Get team leaderboard
 *     tags: [Teams]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all, current, weekly]
 *         description: Time period for leaderboard
 *     responses:
 *       200:
 *         description: Team leaderboard retrieved successfully
 */
router.get('/leaderboard/teams', [
  query('period').optional().isIn(['all', 'current', 'weekly'])
], async (req, res) => {
  try {
    const period = req.query.period || 'all';
    
    let query = `
      SELECT t.id, t.name, t.color, t.logo_url,
             COUNT(p.id) as member_count,
             SUM(p.total_score) as total_score,
             SUM(p.total_clicks) as total_clicks,
             SUM(p.total_cells_captured) as total_cells_captured,
             AVG(p.total_score) as avg_score
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id
    `;
    
    if (period === 'current') {
      // Get current session stats
      query += `
        LEFT JOIN (
          SELECT pc.team_id, 
                 COUNT(*) as session_clicks,
                 SUM(pc.damage_dealt) as session_damage
          FROM player_clicks pc
          JOIN game_sessions gs ON pc.session_id = gs.id
          WHERE gs.status = 'active'
          GROUP BY pc.team_id
        ) session_stats ON t.id = session_stats.team_id
      `;
    }
    
    query += `
      GROUP BY t.id, t.name, t.color, t.logo_url
      ORDER BY total_score DESC, total_cells_captured DESC
      LIMIT 50
    `;
    
    const result = await dbQuery(query);
    
    res.json({
      leaderboard: result.rows,
      period,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching team leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: 'An error occurred while retrieving the leaderboard'
    });
  }
});

/**
 * @swagger
 * /api/teams/{id}/stats:
 *   get:
 *     summary: Get team statistics
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team statistics retrieved successfully
 *       404:
 *         description: Team not found
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get team basic info
    const teamResult = await dbQuery(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Team not found',
        message: 'The specified team does not exist'
      });
    }
    
    const team = teamResult.rows[0];
    
    // Get team statistics
    const statsResult = await dbQuery(
      `SELECT 
        COUNT(p.id) as member_count,
        SUM(p.total_score) as total_score,
        SUM(p.total_clicks) as total_clicks,
        SUM(p.total_cells_captured) as total_cells_captured,
        AVG(p.total_score) as avg_score,
        MAX(p.total_score) as max_score,
        MIN(p.created_at) as first_join,
        MAX(p.created_at) as last_join
       FROM players p
       WHERE p.team_id = $1`,
      [id]
    );
    
    // Get current session stats
    const sessionStatsResult = await dbQuery(
      `SELECT 
        COUNT(pc.id) as session_clicks,
        SUM(pc.damage_dealt) as session_damage,
        COUNT(DISTINCT pc.player_id) as active_players
       FROM player_clicks pc
       JOIN players p ON pc.player_id = p.id
       JOIN game_sessions gs ON pc.session_id = gs.id
       WHERE p.team_id = $1 AND gs.status = 'active'`,
      [id]
    );
    
    // Get controlled cells in current session
    const cellsResult = await dbQuery(
      `SELECT COUNT(*) as controlled_cells,
              SUM(current_hp) as total_hp
       FROM map_cells mc
       JOIN game_sessions gs ON mc.session_id = gs.id
       WHERE mc.team_id = $1 AND gs.status = 'active'`,
      [id]
    );
    
    res.json({
      team,
      stats: {
        ...statsResult.rows[0],
        sessionStats: sessionStatsResult.rows[0],
        controlledCells: cellsResult.rows[0]
      }
    });
  } catch (error) {
    logger.error('Error fetching team stats:', error);
    res.status(500).json({
      error: 'Failed to fetch team statistics',
      message: 'An error occurred while retrieving team statistics'
    });
  }
});

module.exports = router; 