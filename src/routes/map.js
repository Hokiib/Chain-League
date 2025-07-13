const express = require('express');
const { query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/map/cells:
 *   get:
 *     summary: Get map cells for current session
 *     tags: [Map]
 *     parameters:
 *       - in: query
 *         name: x_min
 *         schema:
 *           type: integer
 *         description: Minimum X coordinate
 *       - in: query
 *         name: x_max
 *         schema:
 *           type: integer
 *         description: Maximum X coordinate
 *       - in: query
 *         name: y_min
 *         schema:
 *           type: integer
 *         description: Minimum Y coordinate
 *       - in: query
 *         name: y_max
 *         schema:
 *           type: integer
 *         description: Maximum Y coordinate
 *       - in: query
 *         name: team_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by team ID
 *     responses:
 *       200:
 *         description: Map cells retrieved successfully
 *       404:
 *         description: No active session found
 */
router.get('/cells', [
  query('x_min').optional().isInt({ min: 0, max: 99 }),
  query('x_max').optional().isInt({ min: 0, max: 99 }),
  query('y_min').optional().isInt({ min: 0, max: 99 }),
  query('y_max').optional().isInt({ min: 0, max: 99 }),
  query('team_id').optional().isUUID()
], async (req, res) => {
  try {
    const { x_min, x_max, y_min, y_max, team_id } = req.query;
    
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Build query with filters
    let query = `
      SELECT mc.*, t.name as team_name, t.color as team_color,
             p.username as last_clicked_by_username
      FROM map_cells mc
      LEFT JOIN teams t ON mc.team_id = t.id
      LEFT JOIN players p ON mc.last_clicked_by = p.id
      WHERE mc.session_id = $1
    `;
    
    const params = [session.id];
    let paramIndex = 2;
    
    if (x_min !== undefined) {
      query += ` AND mc.x_coordinate >= $${paramIndex}`;
      params.push(parseInt(x_min));
      paramIndex++;
    }
    
    if (x_max !== undefined) {
      query += ` AND mc.x_coordinate <= $${paramIndex}`;
      params.push(parseInt(x_max));
      paramIndex++;
    }
    
    if (y_min !== undefined) {
      query += ` AND mc.y_coordinate >= $${paramIndex}`;
      params.push(parseInt(y_min));
      paramIndex++;
    }
    
    if (y_max !== undefined) {
      query += ` AND mc.y_coordinate <= $${paramIndex}`;
      params.push(parseInt(y_max));
      paramIndex++;
    }
    
    if (team_id) {
      query += ` AND mc.team_id = $${paramIndex}`;
      params.push(team_id);
      paramIndex++;
    }
    
    query += ` ORDER BY mc.x_coordinate, mc.y_coordinate`;
    
    const cellsResult = await dbQuery(query, params);
    
    res.json({
      session: {
        id: session.id,
        name: session.name,
        startDate: session.start_date,
        endDate: session.end_date
      },
      cells: cellsResult.rows,
      totalCells: cellsResult.rows.length
    });
  } catch (error) {
    logger.error('Error fetching map cells:', error);
    res.status(500).json({
      error: 'Failed to fetch map cells',
      message: 'An error occurred while retrieving map cells'
    });
  }
});

/**
 * @swagger
 * /api/map/cells/{x}/{y}:
 *   get:
 *     summary: Get specific cell details
 *     tags: [Map]
 *     parameters:
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 99
 *         description: X coordinate
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 99
 *         description: Y coordinate
 *     responses:
 *       200:
 *         description: Cell details retrieved successfully
 *       404:
 *         description: Cell not found
 */
router.get('/cells/:x/:y', [
  query('x').isInt({ min: 0, max: 99 }),
  query('y').isInt({ min: 0, max: 99 })
], async (req, res) => {
  try {
    const { x, y } = req.params;
    
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get cell details
    const cellResult = await dbQuery(
      `SELECT mc.*, t.name as team_name, t.color as team_color,
              p.username as last_clicked_by_username,
              p.id as last_clicked_by_id
       FROM map_cells mc
       LEFT JOIN teams t ON mc.team_id = t.id
       LEFT JOIN players p ON mc.last_clicked_by = p.id
       WHERE mc.session_id = $1 AND mc.x_coordinate = $2 AND mc.y_coordinate = $3`,
      [session.id, parseInt(x), parseInt(y)]
    );
    
    if (cellResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Cell not found',
        message: 'The specified cell does not exist'
      });
    }
    
    const cell = cellResult.rows[0];
    
    // Get click history for this cell
    const clicksResult = await dbQuery(
      `SELECT pc.*, p.username, t.name as team_name, t.color as team_color
       FROM player_clicks pc
       JOIN players p ON pc.player_id = p.id
       LEFT JOIN teams t ON pc.team_id = t.id
       WHERE pc.cell_id = $1
       ORDER BY pc.created_at DESC
       LIMIT 10`,
      [cell.id]
    );
    
    // Get adjacent cells
    const adjacentResult = await dbQuery(
      `SELECT mc.x_coordinate, mc.y_coordinate, mc.team_id,
              t.name as team_name, t.color as team_color
       FROM map_cells mc
       LEFT JOIN teams t ON mc.team_id = t.id
       WHERE mc.session_id = $1 
       AND mc.x_coordinate BETWEEN $2 AND $3
       AND mc.y_coordinate BETWEEN $4 AND $5
       AND NOT (mc.x_coordinate = $6 AND mc.y_coordinate = $7)`,
      [session.id, x - 1, x + 1, y - 1, y + 1, x, y]
    );
    
    res.json({
      cell: {
        ...cell,
        clickHistory: clicksResult.rows,
        adjacentCells: adjacentResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching cell details:', error);
    res.status(500).json({
      error: 'Failed to fetch cell details',
      message: 'An error occurred while retrieving cell details'
    });
  }
});

/**
 * @swagger
 * /api/map/overview:
 *   get:
 *     summary: Get map overview statistics
 *     tags: [Map]
 *     responses:
 *       200:
 *         description: Map overview retrieved successfully
 *       404:
 *         description: No active session found
 */
router.get('/overview', async (req, res) => {
  try {
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get map statistics
    const statsResult = await dbQuery(
      `SELECT 
        COUNT(*) as total_cells,
        COUNT(CASE WHEN team_id IS NOT NULL THEN 1 END) as controlled_cells,
        COUNT(CASE WHEN current_hp = 0 THEN 1 END) as destroyed_cells,
        AVG(current_hp) as avg_hp,
        MIN(current_hp) as min_hp,
        MAX(current_hp) as max_hp
       FROM map_cells
       WHERE session_id = $1`,
      [session.id]
    );
    
    // Get team control statistics
    const teamControlResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(mc.id) as cells_controlled,
              AVG(mc.current_hp) as avg_hp,
              SUM(mc.current_hp) as total_hp
       FROM teams t
       LEFT JOIN map_cells mc ON t.id = mc.team_id AND mc.session_id = $1
       GROUP BY t.id, t.name, t.color
       HAVING COUNT(mc.id) > 0
       ORDER BY cells_controlled DESC`,
      [session.id]
    );
    
    // Get recent activity
    const recentActivityResult = await dbQuery(
      `SELECT mc.x_coordinate, mc.y_coordinate, mc.current_hp,
              t.name as team_name, t.color as team_color,
              p.username as last_clicked_by,
              mc.last_clicked_at
       FROM map_cells mc
       LEFT JOIN teams t ON mc.team_id = t.id
       LEFT JOIN players p ON mc.last_clicked_by = p.id
       WHERE mc.session_id = $1 AND mc.last_clicked_at IS NOT NULL
       ORDER BY mc.last_clicked_at DESC
       LIMIT 20`,
      [session.id]
    );
    
    res.json({
      session: {
        id: session.id,
        name: session.name,
        startDate: session.start_date,
        endDate: session.end_date
      },
      stats: statsResult.rows[0],
      teamControl: teamControlResult.rows,
      recentActivity: recentActivityResult.rows
    });
  } catch (error) {
    logger.error('Error fetching map overview:', error);
    res.status(500).json({
      error: 'Failed to fetch map overview',
      message: 'An error occurred while retrieving map overview'
    });
  }
});

/**
 * @swagger
 * /api/map/heatmap:
 *   get:
 *     summary: Get map heatmap data
 *     tags: [Map]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [clicks, damage, control]
 *         description: Type of heatmap data
 *     responses:
 *       200:
 *         description: Heatmap data retrieved successfully
 *       404:
 *         description: No active session found
 */
router.get('/heatmap', [
  query('type').optional().isIn(['clicks', 'damage', 'control'])
], async (req, res) => {
  try {
    const { type = 'clicks' } = req.query;
    
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    let query;
    let params = [session.id];
    
    switch (type) {
      case 'clicks':
        query = `
          SELECT mc.x_coordinate, mc.y_coordinate,
                 COUNT(pc.id) as click_count
          FROM map_cells mc
          LEFT JOIN player_clicks pc ON mc.id = pc.cell_id
          WHERE mc.session_id = $1
          GROUP BY mc.x_coordinate, mc.y_coordinate
          ORDER BY click_count DESC
        `;
        break;
        
      case 'damage':
        query = `
          SELECT mc.x_coordinate, mc.y_coordinate,
                 SUM(pc.damage_dealt) as total_damage
          FROM map_cells mc
          LEFT JOIN player_clicks pc ON mc.id = pc.cell_id
          WHERE mc.session_id = $1
          GROUP BY mc.x_coordinate, mc.y_coordinate
          ORDER BY total_damage DESC
        `;
        break;
        
      case 'control':
        query = `
          SELECT x_coordinate, y_coordinate,
                 CASE 
                   WHEN team_id IS NOT NULL THEN 1
                   ELSE 0
                 END as is_controlled,
                 current_hp as hp_remaining
          FROM map_cells
          WHERE session_id = $1
          ORDER BY x_coordinate, y_coordinate
        `;
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid heatmap type',
          message: 'Type must be one of: clicks, damage, control'
        });
    }
    
    const heatmapResult = await dbQuery(query, params);
    
    res.json({
      session: {
        id: session.id,
        name: session.name
      },
      type,
      data: heatmapResult.rows
    });
  } catch (error) {
    logger.error('Error fetching heatmap data:', error);
    res.status(500).json({
      error: 'Failed to fetch heatmap data',
      message: 'An error occurred while retrieving heatmap data'
    });
  }
});

/**
 * @swagger
 * /api/map/player-area:
 *   get:
 *     summary: Get player's team controlled area
 *     tags: [Map]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player area retrieved successfully
 *       400:
 *         description: Player not in a team
 */
router.get('/player-area', [
  authenticateToken
], async (req, res) => {
  try {
    if (!req.player.team_id) {
      return res.status(400).json({
        error: 'Not in a team',
        message: 'You must be in a team to view your controlled area'
      });
    }
    
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get team's controlled cells
    const controlledCellsResult = await dbQuery(
      `SELECT x_coordinate, y_coordinate, current_hp, last_clicked_at
       FROM map_cells
       WHERE session_id = $1 AND team_id = $2
       ORDER BY x_coordinate, y_coordinate`,
      [session.id, req.player.team_id]
    );
    
    // Get adjacent cells that can be clicked
    const adjacentCellsResult = await dbQuery(
      `SELECT DISTINCT mc.x_coordinate, mc.y_coordinate, mc.current_hp, mc.team_id,
              t.name as team_name, t.color as team_color
       FROM map_cells mc
       LEFT JOIN teams t ON mc.team_id = t.id
       WHERE mc.session_id = $1
       AND EXISTS (
         SELECT 1 FROM map_cells controlled
         WHERE controlled.session_id = $1 
         AND controlled.team_id = $2
         AND ABS(controlled.x_coordinate - mc.x_coordinate) <= 1
         AND ABS(controlled.y_coordinate - mc.y_coordinate) <= 1
         AND NOT (controlled.x_coordinate = mc.x_coordinate AND controlled.y_coordinate = mc.y_coordinate)
       )`,
      [session.id, req.player.team_id]
    );
    
    res.json({
      session: {
        id: session.id,
        name: session.name
      },
      controlledCells: controlledCellsResult.rows,
      adjacentCells: adjacentCellsResult.rows,
      totalControlled: controlledCellsResult.rows.length,
      totalAdjacent: adjacentCellsResult.rows.length
    });
  } catch (error) {
    logger.error('Error fetching player area:', error);
    res.status(500).json({
      error: 'Failed to fetch player area',
      message: 'An error occurred while retrieving player area'
    });
  }
});

module.exports = router; 