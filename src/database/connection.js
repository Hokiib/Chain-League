const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Create connection pool
const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: process.env.PGPORT || process.env.DB_PORT || 5432,
  database: process.env.PGDATABASE || process.env.DB_NAME || 'chain_league',
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Connect to database
const connectDB = async () => {
  try {
    const client = await pool.connect();
    logger.info('✅ PostgreSQL database connected successfully');
    client.release();
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL:', error);
    throw error;
  }
};

// Execute a query
const query = async (text, params) => {
  const start = Date.now();
  try {
    logger.info('test', { text, params });
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', error);
    throw error;
  }
};

// Get a client for transactions
const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  connectDB,
  query,
  getClient,
  pool
}; 