require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { logger } = require('./utils/logger');
const { connectDB } = require('./database/connection');
const { connectRedis } = require('./database/redis');
const { initializeWeb3 } = require('./services/web3Service');
const { initializeGameScheduler } = require('./services/gameScheduler');

// Import routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const teamRoutes = require('./routes/teams');
const gameRoutes = require('./routes/game');
const mapRoutes = require('./routes/map');
const bettingRoutes = require('./routes/betting');
const leaderboardRoutes = require('./routes/leaderboard');
const subscriptionRoutes = require('./routes/subscriptions');
const shopRoutes = require('./routes/shop');

const app = express();


const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.FRONTEND_URL,
        process.env.ALLOWED_ORIGINS
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/shop', shopRoutes);

// Swagger documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chain League API',
      version: '1.0.0',
      description: 'API pour le jeu Web3 multijoueur Chain League',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services and start server
async function startServer() {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();
    
    // Initialize Web3 (optional for development)
    try {
      await initializeWeb3();
    } catch (error) {
      logger.warn('⚠️ Web3 initialization failed, continuing without blockchain features:', error.message);
    }
    
    // Initialize game scheduler
    await initializeGameScheduler();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer(); 