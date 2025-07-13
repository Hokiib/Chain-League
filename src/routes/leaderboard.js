const express = require('express');
const { query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/leaderboard/players:
 *   get:
 *     summary: Get player leaderboard
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all, current, weekly]
 *         description: Time period for leaderboard
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
 *     responses:
 *       200:
 *         description: Player leaderboard retrieved successfully
 */
router.get('/players', [
  query('period').optional().isIn(['all', 'current', 'weekly']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { period = 'all', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT p.id, p.username, p.total_score, p.total_clicks, p.total_cells_captured,
             t.name as team_name, t.color as team_color,
             p.subscription_status, p.created_at
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (period === 'current') {
      // Get current session stats
      query = `
        SELECT p.id, p.username, p.total_score, p.total_clicks, p.total_cells_captured,
               t.name as team_name, t.color as team_color,
               p.subscription_status, p.created_at,
               COALESCE(session_stats.session_score, 0) as session_score,
               COALESCE(session_stats.session_clicks, 0) as session_clicks,
               COALESCE(session_stats.session_damage, 0) as session_damage
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN (
          SELECT pc.player_id,
                 SUM(pc.damage_dealt) as session_score,
                 COUNT(pc.id) as session_clicks,
                 SUM(pc.damage_dealt) as session_damage
          FROM player_clicks pc
          JOIN game_sessions gs ON pc.session_id = gs.id
          WHERE gs.status = 'active'
          GROUP BY pc.player_id
        ) session_stats ON p.id = session_stats.player_id
      `;
    }
    
    query += ` ORDER BY total_score DESC, total_cells_captured DESC, total_clicks DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const playersResult = await dbQuery(query, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM players
    `;
    const countResult = await dbQuery(countQuery);
    const totalPlayers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalPlayers / limit);
    
    res.json({
      leaderboard: playersResult.rows,
      period,
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
    logger.error('Error fetching player leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: 'An error occurred while retrieving the leaderboard'
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/teams:
 *   get:
 *     summary: Get team leaderboard
 *     tags: [Leaderboard]
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
router.get('/teams', [
  query('period').optional().isIn(['all', 'current', 'weekly'])
], async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let query = `
      SELECT t.id, t.name, t.color, t.logo_url,
             COUNT(p.id) as member_count,
             SUM(p.total_score) as total_score,
             SUM(p.total_clicks) as total_clicks,
             SUM(p.total_cells_captured) as total_cells_captured,
             AVG(p.total_score) as avg_score
    `;
    
    if (period === 'current') {
      query += `,
             COALESCE(session_stats.session_score, 0) as session_score,
             COALESCE(session_stats.session_clicks, 0) as session_clicks,
             COALESCE(session_stats.controlled_cells, 0) as controlled_cells
      `;
    }
    
    query += `
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id
    `;
    
    if (period === 'current') {
      query += `
        LEFT JOIN (
          SELECT pc.team_id,
                 SUM(pc.damage_dealt) as session_score,
                 COUNT(pc.id) as session_clicks,
                 COUNT(DISTINCT mc.id) as controlled_cells
          FROM player_clicks pc
          JOIN game_sessions gs ON pc.session_id = gs.id
          LEFT JOIN map_cells mc ON mc.team_id = pc.team_id AND mc.session_id = gs.id
          WHERE gs.status = 'active'
          GROUP BY pc.team_id
        ) session_stats ON t.id = session_stats.team_id
      `;
    }
    
    query += `
      GROUP BY t.id, t.name, t.color, t.logo_url
      HAVING COUNT(p.id) > 0
      ORDER BY total_score DESC, total_cells_captured DESC
      LIMIT 50
    `;
    
    const teamsResult = await dbQuery(query);
    
    res.json({
      leaderboard: teamsResult.rows,
      period,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching team leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch team leaderboard',
      message: 'An error occurred while retrieving the team leaderboard'
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/session/{sessionId}:
 *   get:
 *     summary: Get session-specific leaderboard
 *     tags: [Leaderboard]
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
 *         description: Session leaderboard retrieved successfully
 *       404:
 *         description: Session not found
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
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
    
    // Get player rankings for this session
    const playerRankingsResult = await dbQuery(
      `SELECT p.id, p.username, p.total_score, p.total_clicks, p.total_cells_captured,
              t.name as team_name, t.color as team_color,
              COALESCE(session_stats.session_score, 0) as session_score,
              COALESCE(session_stats.session_clicks, 0) as session_clicks,
              COALESCE(session_stats.session_damage, 0) as session_damage
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       LEFT JOIN (
         SELECT pc.player_id,
                SUM(pc.damage_dealt) as session_score,
                COUNT(pc.id) as session_clicks,
                SUM(pc.damage_dealt) as session_damage
         FROM player_clicks pc
         WHERE pc.session_id = $1
         GROUP BY pc.player_id
       ) session_stats ON p.id = session_stats.player_id
       WHERE session_stats.session_score > 0
       ORDER BY session_score DESC, session_clicks DESC
       LIMIT 100`,
      [sessionId]
    );
    
    // Get team rankings for this session
    const teamRankingsResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(DISTINCT p.id) as member_count,
              COALESCE(session_stats.session_score, 0) as session_score,
              COALESCE(session_stats.session_clicks, 0) as session_clicks,
              COALESCE(session_stats.controlled_cells, 0) as controlled_cells
       FROM teams t
       LEFT JOIN players p ON t.id = p.team_id
       LEFT JOIN (
         SELECT pc.team_id,
                SUM(pc.damage_dealt) as session_score,
                COUNT(pc.id) as session_clicks,
                COUNT(DISTINCT mc.id) as controlled_cells
         FROM player_clicks pc
         LEFT JOIN map_cells mc ON mc.team_id = pc.team_id AND mc.session_id = pc.session_id
         WHERE pc.session_id = $1
         GROUP BY pc.team_id
       ) session_stats ON t.id = session_stats.team_id
       WHERE session_stats.session_score > 0
       GROUP BY t.id, t.name, t.color, session_stats.session_score, session_stats.session_clicks, session_stats.controlled_cells
       ORDER BY session_score DESC, controlled_cells DESC
       LIMIT 50`,
      [sessionId]
    );
    
    res.json({
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        startDate: session.start_date,
        endDate: session.end_date
      },
      playerRankings: playerRankingsResult.rows,
      teamRankings: teamRankingsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching session leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch session leaderboard',
      message: 'An error occurred while retrieving the session leaderboard'
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/global:
 *   get:
 *     summary: Get global statistics and rankings
 *     tags: [Leaderboard]
 *     responses:
 *       200:
 *         description: Global statistics retrieved successfully
 */
router.get('/global', async (req, res) => {
  try {
    // Get global player statistics
    const playerStatsResult = await dbQuery(
      `SELECT 
        COUNT(*) as total_players,
        COUNT(CASE WHEN subscription_status = 'premium' THEN 1 END) as premium_players,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        SUM(total_clicks) as total_clicks,
        SUM(total_cells_captured) as total_cells_captured
       FROM players`
    );
    
    // Get global team statistics
    const teamStatsResult = await dbQuery(
      `SELECT 
        COUNT(*) as total_teams,
        COUNT(CASE WHEN t.id IN (SELECT DISTINCT team_id FROM players WHERE team_id IS NOT NULL) THEN 1 END) as active_teams,
        AVG(member_count) as avg_members,
        MAX(member_count) as max_members
       FROM teams t
       LEFT JOIN (
         SELECT team_id, COUNT(*) as member_count
         FROM players
         WHERE team_id IS NOT NULL
         GROUP BY team_id
       ) member_counts ON t.id = member_counts.team_id`
    );
    
    // Get top players
    const topPlayersResult = await dbQuery(
      `SELECT p.username, p.total_score, p.total_clicks, p.total_cells_captured,
              t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       ORDER BY p.total_score DESC
       LIMIT 10`
    );
    
    // Get top teams
    const topTeamsResult = await dbQuery(
      `SELECT t.name, t.color,
              COUNT(p.id) as member_count,
              SUM(p.total_score) as total_score,
              SUM(p.total_cells_captured) as total_cells_captured
       FROM teams t
       LEFT JOIN players p ON t.id = p.team_id
       GROUP BY t.id, t.name, t.color
       HAVING COUNT(p.id) > 0
       ORDER BY total_score DESC
       LIMIT 10`
    );
    
    // Get recent activity
    const recentActivityResult = await dbQuery(
      `SELECT p.username, pc.damage_dealt, pc.created_at,
              t.name as team_name, t.color as team_color
       FROM player_clicks pc
       JOIN players p ON pc.player_id = p.id
       LEFT JOIN teams t ON pc.team_id = t.id
       ORDER BY pc.created_at DESC
       LIMIT 20`
    );
    
    res.json({
      playerStats: playerStatsResult.rows[0],
      teamStats: teamStatsResult.rows[0],
      topPlayers: topPlayersResult.rows,
      topTeams: topTeamsResult.rows,
      recentActivity: recentActivityResult.rows,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching global statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch global statistics',
      message: 'An error occurred while retrieving global statistics'
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/player/{playerId}:
 *   get:
 *     summary: Get player's ranking and statistics
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Player ID
 *     responses:
 *       200:
 *         description: Player statistics retrieved successfully
 *       404:
 *         description: Player not found
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    // Get player information
    const playerResult = await dbQuery(
      `SELECT p.*, t.name as team_name, t.color as team_color
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.id = $1`,
      [playerId]
    );
    
    if (playerResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: 'The specified player does not exist'
      });
    }
    
    const player = playerResult.rows[0];
    
    // Get player's global ranking
    const rankingResult = await dbQuery(
      `SELECT COUNT(*) + 1 as rank
       FROM players
       WHERE total_score > $1`,
      [player.total_score]
    );
    
    // Get player's recent activity
    const recentActivityResult = await dbQuery(
      `SELECT pc.damage_dealt, pc.created_at, gs.name as session_name
       FROM player_clicks pc
       JOIN game_sessions gs ON pc.session_id = gs.id
       WHERE pc.player_id = $1
       ORDER BY pc.created_at DESC
       LIMIT 20`,
      [playerId]
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
      [playerId]
    );
    
    res.json({
      player: {
        ...player,
        globalRank: parseInt(rankingResult.rows[0].rank)
      },
      recentActivity: recentActivityResult.rows,
      sessionStats: sessionStatsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching player statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch player statistics',
      message: 'An error occurred while retrieving player statistics'
    });
  }
});

module.exports = router; 