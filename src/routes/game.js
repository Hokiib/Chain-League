const express = require('express');
const { body, query } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const { authenticateToken, requireTeam, clickRateLimit } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { sendTransactionToPlayer } = require('../services/web3Service');

const router = express.Router();

/**
 * @swagger
 * /api/game/session:
 *   get:
 *     summary: Get current game session
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Current session details retrieved successfully
 *       404:
 *         description: No active session found
 */
router.get('/session', async (req, res) => {
  try {
    const sessionResult = await dbQuery(
      `SELECT gs.*, 
              COUNT(DISTINCT p.id) as total_participants,
              COUNT(DISTINCT mc.team_id) as teams_participating
       FROM game_sessions gs
       LEFT JOIN players p ON p.team_id IS NOT NULL
       LEFT JOIN map_cells mc ON mc.session_id = gs.id AND mc.team_id IS NOT NULL
       WHERE gs.status = 'active'
       GROUP BY gs.id
       ORDER BY gs.created_at DESC
       LIMIT 1`
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No active session',
        message: 'There is no active game session at the moment'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get team statistics for this session
    const teamStatsResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(mc.id) as cells_controlled,
              SUM(mc.current_hp) as total_hp,
              COUNT(DISTINCT p.id) as member_count
       FROM teams t
       LEFT JOIN map_cells mc ON t.id = mc.team_id AND mc.session_id = $1
       LEFT JOIN players p ON t.id = p.team_id
       GROUP BY t.id, t.name, t.color
       ORDER BY cells_controlled DESC, total_hp DESC`,
      [session.id]
    );
    
    res.json({
      session: {
        ...session,
        teamStats: teamStatsResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching game session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      message: 'An error occurred while retrieving session details'
    });
  }
});

/**
 * @swagger
 * /api/game/click:
 *   post:
 *     summary: Click on a map cell
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - x
 *               - y
 *             properties:
 *               x:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 99
 *               y:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 99
 *     responses:
 *       200:
 *         description: Click processed successfully
 *       400:
 *         description: Invalid coordinates or cell not adjacent
 *       429:
 *         description: Click cooldown active
 */
router.post('/click', [
  authenticateToken,
  requireTeam,
  clickRateLimit,
  body('x')
    .isInt({ min: 0, max: 99 })
    .withMessage('X coordinate must be between 0 and 99'),
  body('y')
    .isInt({ min: 0, max: 99 })
    .withMessage('Y coordinate must be between 0 and 99')
], async (req, res) => {
  try {
    const { x, y } = req.body;
    
    // Get current active session
    const sessionResult = await dbQuery(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(400).json({
        error: 'No active session',
        message: 'There is no active game session'
      });
    }
    
    const session = sessionResult.rows[0];
    
    // Get the target cell
    const cellResult = await dbQuery(
      'SELECT * FROM map_cells WHERE session_id = $1 AND x_coordinate = $2 AND y_coordinate = $3',
      [session.id, x, y]
    );
    
    if (cellResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Cell not found',
        message: 'The specified cell does not exist'
      });
    }
    
    const cell = cellResult.rows[0];
    
    // Check if cell is adjacent to player's team controlled cells
    const isAdjacent = await checkAdjacency(session.id, x, y, req.player.team_id);
    if (!isAdjacent) {
      return res.status(400).json({
        error: 'Cell not adjacent',
        message: 'You can only click on cells adjacent to your team\'s controlled cells'
      });
    }
    
    // Calculate damage (considering daily events and boosts)
    const damage = await calculateDamage(req.player.id, session.id);
    
    // Process the click
    const result = await processClick(cell, req.player, session, damage);
    
    logger.info(`Player ${req.player.username} clicked cell (${x}, ${y}) with ${damage} damage`);
    
    res.json({
      message: 'Click processed successfully',
      result
    });
  } catch (error) {
    logger.error('Error processing click:', error);
    res.status(500).json({
      error: 'Click failed',
      message: 'An error occurred while processing the click'
    });
  }
});

// Check if cell is adjacent to team's controlled cells
const checkAdjacency = async (sessionId, x, y, teamId) => {
  try {
    // Get all cells controlled by the team
    const controlledCellsResult = await dbQuery(
      'SELECT x_coordinate, y_coordinate FROM map_cells WHERE session_id = $1 AND team_id = $2',
      [sessionId, teamId]
    );
    
    if (controlledCellsResult.rows.length === 0) {
      // If team has no controlled cells, allow clicking anywhere
      return true;
    }
    
    // Check if target cell is adjacent to any controlled cell
    for (const controlledCell of controlledCellsResult.rows) {
      const dx = Math.abs(x - controlledCell.x_coordinate);
      const dy = Math.abs(y - controlledCell.y_coordinate);
      
      // Adjacent means touching (including diagonally)
      if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking adjacency:', error);
    return false;
  }
};

// Calculate damage considering events and boosts
const calculateDamage = async (playerId, sessionId) => {
  try {
    let baseDamage = parseInt(process.env.CELL_DAMAGE_PER_CLICK) || 25;
    let multiplier = 1.0;
    
    // Check for active daily events
    const eventsResult = await dbQuery(
      `SELECT event_type, event_data
       FROM daily_events
       WHERE session_id = $1 AND is_active = true 
       AND start_time <= NOW() AND end_time >= NOW()`,
      [sessionId]
    );
    
    for (const event of eventsResult.rows) {
      const eventData = JSON.parse(event.event_data);
      if (event.event_type === 'double_click_damage') {
        multiplier *= eventData.multiplier || 2.0;
      }
    }
    
    // Check for player boosts
    const boostsResult = await dbQuery(
      `SELECT boost_type, multiplier
       FROM player_boosts
       WHERE player_id = $1 AND is_active = true AND expires_at > NOW()`,
      [playerId]
    );
    
    for (const boost of boostsResult.rows) {
      if (boost.boost_type === 'click_damage') {
        multiplier *= boost.multiplier;
      }
    }
    
    return Math.floor(baseDamage * multiplier);
  } catch (error) {
    logger.error('Error calculating damage:', error);
    return parseInt(process.env.CELL_DAMAGE_PER_CLICK) || 25;
  }
};

// Process the click and update cell
const processClick = async (cell, player, session, damage) => {
  const client = await dbQuery.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Update cell HP
    const newHp = Math.max(0, cell.current_hp - damage);
    const isCaptured = newHp === 0 && cell.team_id !== player.team_id;
    
    // Update cell
    await client.query(
      `UPDATE map_cells 
       SET current_hp = $1, last_clicked_at = NOW(), last_clicked_by = $2
       ${isCaptured ? ', team_id = $3' : ''}
       WHERE id = $4`,
      isCaptured ? [newHp, player.id, player.team_id, cell.id] : [newHp, player.id, cell.id]
    );
    
    // Record the click
    await client.query(
      `INSERT INTO player_clicks (player_id, session_id, cell_id, x_coordinate, y_coordinate, damage_dealt, team_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [player.id, session.id, cell.id, cell.x_coordinate, cell.y_coordinate, damage, player.team_id]
    );
    
    // Update player stats
    await client.query(
      `UPDATE players 
       SET total_clicks = total_clicks + 1,
           total_score = total_score + ${damage}
       ${isCaptured ? ', total_cells_captured = total_cells_captured + 1' : ''}
       WHERE id = $1`,
      [player.id]
    );
    
    // Update team stats
    await client.query(
      `UPDATE teams 
       SET total_score = total_score + $1
       WHERE id = $2`,
      [damage, player.team_id]
    );
    
    if (isCaptured) {
      await client.query(
        `UPDATE teams 
         SET total_cells_controlled = total_cells_controlled + 1
         WHERE id = $1`,
        [player.team_id]
      );
      
      // If cell was previously controlled by another team, decrease their count
      if (cell.team_id) {
        await client.query(
          `UPDATE teams 
           SET total_cells_controlled = GREATEST(0, total_cells_controlled - 1)
           WHERE id = $1`,
          [cell.team_id]
        );
      }
    }
    
    await client.query('COMMIT');
    
    return {
      cellId: cell.id,
      x: cell.x_coordinate,
      y: cell.y_coordinate,
      damage,
      newHp,
      isCaptured,
      capturedBy: isCaptured ? player.team_id : null,
      previousTeam: cell.team_id
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * @swagger
 * /api/game/events:
 *   get:
 *     summary: Get active daily events
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Active events retrieved successfully
 */
router.get('/events', async (req, res) => {
  try {
    const eventsResult = await dbQuery(
      `SELECT de.*, gs.name as session_name
       FROM daily_events de
       JOIN game_sessions gs ON de.session_id = gs.id
       WHERE de.is_active = true 
       AND de.start_time <= NOW() 
       AND de.end_time >= NOW()
       ORDER BY de.start_time DESC`
    );
    
    res.json({
      events: eventsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: 'An error occurred while retrieving events'
    });
  }
});

/**
 * @swagger
 * /api/game/boosts:
 *   get:
 *     summary: Get player's active boosts
 *     tags: [Game]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player boosts retrieved successfully
 */
router.get('/boosts', [
  authenticateToken
], async (req, res) => {
  try {
    const boostsResult = await dbQuery(
      `SELECT boost_type, multiplier, expires_at, created_at
       FROM player_boosts
       WHERE player_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY expires_at ASC`,
      [req.player.id]
    );
    
    res.json({
      boosts: boostsResult.rows
    });
  } catch (error) {
    logger.error('Error fetching boosts:', error);
    res.status(500).json({
      error: 'Failed to fetch boosts',
      message: 'An error occurred while retrieving boosts'
    });
  }
});

/**
 * @swagger
 * /api/game/stats:
 *   get:
 *     summary: Get current session statistics
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Session statistics retrieved successfully
 */
router.get('/stats', async (req, res) => {
  try {
    // Get current session
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
    
    // Get session statistics
    const statsResult = await dbQuery(
      `SELECT 
        COUNT(DISTINCT pc.player_id) as active_players,
        COUNT(pc.id) as total_clicks,
        SUM(pc.damage_dealt) as total_damage,
        COUNT(DISTINCT mc.team_id) as teams_participating,
        COUNT(mc.id) as controlled_cells,
        AVG(mc.current_hp) as avg_cell_hp
       FROM game_sessions gs
       LEFT JOIN player_clicks pc ON gs.id = pc.session_id
       LEFT JOIN map_cells mc ON gs.id = mc.session_id AND mc.team_id IS NOT NULL
       WHERE gs.id = $1`,
      [session.id]
    );
    
    // Get team rankings
    const teamRankingsResult = await dbQuery(
      `SELECT t.id, t.name, t.color,
              COUNT(mc.id) as cells_controlled,
              SUM(mc.current_hp) as total_hp,
              COUNT(DISTINCT p.id) as member_count
       FROM teams t
       LEFT JOIN map_cells mc ON t.id = mc.team_id AND mc.session_id = $1
       LEFT JOIN players p ON t.id = p.team_id
       GROUP BY t.id, t.name, t.color
       HAVING COUNT(mc.id) > 0
       ORDER BY cells_controlled DESC, total_hp DESC`,
      [session.id]
    );
    
    res.json({
      session: {
        ...session,
        stats: statsResult.rows[0],
        teamRankings: teamRankingsResult.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching game stats:', error);
    res.status(500).json({
      error: 'Failed to fetch game statistics',
      message: 'An error occurred while retrieving game statistics'
    });
  }
});

/**
 * @swagger
 * /api/game/attack:
 *   post:
 *     summary: Attack a cell and receive blockchain reward
 *     tags: [Game]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerAddress
 *               - cellX
 *               - cellY
 *             properties:
 *               playerAddress:
 *                 type: string
 *                 description: Player's wallet address
 *               cellX:
 *                 type: integer
 *                 description: X coordinate of attacked cell
 *               cellY:
 *                 type: integer
 *                 description: Y coordinate of attacked cell
 *     responses:
 *       200:
 *         description: Attack successful and transaction sent
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Transaction failed
 */
router.post('/attack', [
  body('playerAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('cellX')
    .isInt({ min: 0, max: 99 })
    .withMessage('Cell X coordinate must be between 0 and 99'),
  body('cellY')
    .isInt({ min: 0, max: 99 })
    .withMessage('Cell Y coordinate must be between 0 and 99')
], async (req, res) => {
  try {
    const { playerAddress, cellX, cellY } = req.body;
    
    logger.info(`🎯 Player ${playerAddress} attacking cell (${cellX}, ${cellY})`);
    
    // Send blockchain transaction to player
    const transactionResult = await sendTransactionToPlayer(playerAddress);
    
    logger.info(`✅ Attack successful for ${playerAddress} on cell (${cellX}, ${cellY})`);
    
    res.json({
      success: true,
      message: 'Attack successful! You received 0.001 CHZ as reward.',
      transaction: {
        hash: transactionResult.hash,
        amount: transactionResult.amount,
        blockNumber: transactionResult.blockNumber
      },
      cell: {
        x: cellX,
        y: cellY
      }
    });
    
  } catch (error) {
    logger.error('❌ Attack failed:', error);
    res.status(500).json({
      success: false,
      error: 'Attack failed',
      message: error.message || 'An error occurred while processing the attack'
    });
  }
});

module.exports = router; 