const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { query } = require('../database/connection');
const { setWithExpiry, get, del } = require('../database/redis');

// Game session duration in days
const GAME_SESSION_DURATION = parseInt(process.env.GAME_SESSION_DURATION_DAYS) || 4;
const BETTING_SESSION_DURATION = parseInt(process.env.BETTING_SESSION_DURATION_DAYS) || 1;

// Initialize game scheduler
const initializeGameScheduler = async () => {
  try {
    logger.info('🎮 Initializing game scheduler...');
    
    // Check for active session or create new one
    await checkAndCreateSession();
    
    // Schedule daily events
    scheduleDailyEvents();
    
    // Schedule session management
    scheduleSessionManagement();
    
    // Schedule betting sessions
    scheduleBettingSessions();
    
    logger.info('✅ Game scheduler initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize game scheduler:', error);
    throw error;
  }
};

// Check for active session or create new one
const checkAndCreateSession = async () => {
  try {
    // Check if there's an active session
    const activeSession = await query(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (activeSession.rows.length === 0) {
      // Create new session
      await createNewGameSession();
    } else {
      logger.info('Active game session found:', activeSession.rows[0].id);
    }
  } catch (error) {
    logger.error('Error checking/creating session:', error);
    throw error;
  }
};

// Create new game session
const createNewGameSession = async () => {
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + (GAME_SESSION_DURATION * 24 * 60 * 60 * 1000));
    const bettingStartDate = new Date(endDate.getTime() + (24 * 60 * 60 * 1000)); // 1 day after game ends
    const bettingEndDate = new Date(bettingStartDate.getTime() + (BETTING_SESSION_DURATION * 24 * 60 * 60 * 1000));
    
    const sessionName = `Session ${Math.floor(Date.now() / 1000)}`;
    
    const result = await query(
      `INSERT INTO game_sessions (name, start_date, end_date, betting_start_date, betting_end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sessionName, now, endDate, bettingStartDate, bettingEndDate, 'active']
    );
    
    const session = result.rows[0];
    logger.info(`🎮 Created new game session: ${session.id}`);
    
    // Initialize map for this session
    await initializeMapForSession(session.id);
    
    // Set session in Redis
    await setWithExpiry(`session:${session.id}`, {
      id: session.id,
      status: session.status,
      startDate: session.start_date,
      endDate: session.end_date
    }, GAME_SESSION_DURATION * 24 * 60 * 60);
    
    return session;
  } catch (error) {
    logger.error('Error creating new game session:', error);
    throw error;
  }
};

// Initialize map for session (100x100 grid)
const initializeMapForSession = async (sessionId) => {
  try {
    const cells = [];
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        cells.push({
          session_id: sessionId,
          x_coordinate: x,
          y_coordinate: y,
          current_hp: 100,
          max_hp: 100
        });
      }
    }
    
    // Insert cells in batches
    const batchSize = 100; // Reduced batch size to avoid parameter limit
    for (let i = 0; i < cells.length; i += batchSize) {
      const batch = cells.slice(i, i + batchSize);
      const values = batch.map((cell, index) => {
        const offset = index * 4;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
      }).join(', ');
      
      const params = batch.flatMap(cell => [
        cell.session_id,
        cell.x_coordinate,
        cell.y_coordinate,
        cell.current_hp
      ]);
      
      await query(
        `INSERT INTO map_cells (session_id, x_coordinate, y_coordinate, current_hp)
         VALUES ${values}`,
        params
      );
    }
    
    logger.info(`🗺️ Initialized map for session ${sessionId} (${cells.length} cells)`);
  } catch (error) {
    logger.error('Error initializing map:', error);
    throw error;
  }
};

// Schedule daily events
const scheduleDailyEvents = () => {
  // Run every day at 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await createDailyEvent();
    } catch (error) {
      logger.error('Error creating daily event:', error);
    }
  });
  
  logger.info('📅 Daily events scheduler configured');
};

// Create daily event
const createDailyEvent = async () => {
  try {
    const activeSession = await query(
      'SELECT * FROM game_sessions WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
      ['active']
    );
    
    if (activeSession.rows.length === 0) {
      logger.warn('No active session found for daily event');
      return;
    }
    
    const session = activeSession.rows[0];
    const now = new Date();
    const endTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
    
    // Random event types
    const eventTypes = [
      'double_click_damage',
      'bonus_chz_rewards',
      'team_boost',
      'free_cell_capture',
      'click_cooldown_reduction'
    ];
    
    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const eventData = {
      multiplier: randomEvent === 'double_click_damage' ? 2 : 1.5,
      description: `Daily event: ${randomEvent.replace(/_/g, ' ')}`
    };
    
    await query(
      `INSERT INTO daily_events (session_id, event_type, event_data, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, randomEvent, JSON.stringify(eventData), now, endTime]
    );
    
    logger.info(`🎉 Created daily event: ${randomEvent} for session ${session.id}`);
  } catch (error) {
    logger.error('Error creating daily event:', error);
    throw error;
  }
};

// Schedule session management
const scheduleSessionManagement = () => {
  // Check every hour for session status
  cron.schedule('0 * * * *', async () => {
    try {
      await checkSessionStatus();
    } catch (error) {
      logger.error('Error checking session status:', error);
    }
  });
  
  logger.info('⏰ Session management scheduler configured');
};

// Check session status
const checkSessionStatus = async () => {
  try {
    const activeSessions = await query(
      'SELECT * FROM game_sessions WHERE status = $1 AND end_date <= $2',
      ['active', new Date()]
    );
    
    for (const session of activeSessions.rows) {
      await endGameSession(session);
    }
  } catch (error) {
    logger.error('Error checking session status:', error);
    throw error;
  }
};

// End game session
const endGameSession = async (session) => {
  try {
    // Determine winner team
    const teamStats = await query(
      `SELECT t.id, t.name, COUNT(mc.id) as cells_controlled, SUM(mc.current_hp) as total_hp
       FROM teams t
       LEFT JOIN map_cells mc ON t.id = mc.team_id AND mc.session_id = $1
       GROUP BY t.id, t.name
       ORDER BY cells_controlled DESC, total_hp DESC
       LIMIT 1`,
      [session.id]
    );
    
    const winnerTeamId = teamStats.rows.length > 0 ? teamStats.rows[0].id : null;
    
    // Update session status
    await query(
      'UPDATE game_sessions SET status = $1, winner_team_id = $2 WHERE id = $3',
      ['completed', winnerTeamId, session.id]
    );
    
    // Process bets and distribute rewards
    await processBetsAndRewards(session.id, winnerTeamId);
    
    // Clear session from Redis
    await del(`session:${session.id}`);
    
    logger.info(`🏁 Game session ${session.id} ended. Winner: ${winnerTeamId || 'None'}`);
  } catch (error) {
    logger.error('Error ending game session:', error);
    throw error;
  }
};

// Process bets and distribute rewards
const processBetsAndRewards = async (sessionId, winnerTeamId) => {
  try {
    const bets = await query(
      'SELECT * FROM bets WHERE session_id = $1 AND status = $2',
      [sessionId, 'active']
    );
    
    if (bets.rows.length === 0) return;
    
    const totalBetAmount = bets.rows.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
    const winningBets = bets.rows.filter(bet => bet.team_id === winnerTeamId);
    const totalWinningAmount = winningBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
    
    // Calculate payout multiplier
    const payoutMultiplier = totalWinningAmount > 0 ? totalBetAmount / totalWinningAmount : 1;
    
    // Update winning bets with payouts
    for (const bet of winningBets) {
      const payoutAmount = parseFloat(bet.amount) * payoutMultiplier;
      await query(
        'UPDATE bets SET status = $1, payout_amount = $2 WHERE id = $3',
        ['paid', payoutAmount, bet.id]
      );
      
      // Update player balance
      await query(
        'UPDATE players SET chz_balance = chz_balance + $1 WHERE id = $2',
        [payoutAmount, bet.player_id]
      );
    }
    
    // Mark losing bets as lost
    const losingBets = bets.rows.filter(bet => bet.team_id !== winnerTeamId);
    for (const bet of losingBets) {
      await query(
        'UPDATE bets SET status = $1 WHERE id = $2',
        ['lost', bet.id]
      );
    }
    
    logger.info(`💰 Processed ${bets.rows.length} bets for session ${sessionId}`);
  } catch (error) {
    logger.error('Error processing bets:', error);
    throw error;
  }
};

// Schedule betting sessions
const scheduleBettingSessions = () => {
  // Check every 30 minutes for betting session status
  cron.schedule('*/30 * * * *', async () => {
    try {
      await checkBettingSessions();
    } catch (error) {
      logger.error('Error checking betting sessions:', error);
    }
  });
  
  logger.info('🎲 Betting sessions scheduler configured');
};

// Check betting sessions
const checkBettingSessions = async () => {
  try {
    const bettingSessions = await query(
      'SELECT * FROM game_sessions WHERE status = $1 AND betting_end_date <= $2',
      ['betting', new Date()]
    );
    
    for (const session of bettingSessions.rows) {
      await startNewGameSession(session);
    }
  } catch (error) {
    logger.error('Error checking betting sessions:', error);
    throw error;
  }
};

// Start new game session after betting
const startNewGameSession = async (bettingSession) => {
  try {
    // Update betting session status
    await query(
      'UPDATE game_sessions SET status = $1 WHERE id = $2',
      ['completed', bettingSession.id]
    );
    
    // Create new game session
    await createNewGameSession();
    
    logger.info(`🔄 Started new game session after betting session ${bettingSession.id}`);
  } catch (error) {
    logger.error('Error starting new game session:', error);
    throw error;
  }
};

module.exports = {
  initializeGameScheduler,
  createNewGameSession,
  checkSessionStatus,
  endGameSession
}; 