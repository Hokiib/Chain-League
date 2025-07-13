const redis = require('redis');
const { logger } = require('../utils/logger');

let client = null;

// Create Redis client
const createRedisClient = () => {
  return redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.error('Redis server refused connection');
        return new Error('Redis server refused connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        logger.error('Redis retry time exhausted');
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        logger.error('Redis max retry attempts reached');
        return undefined;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });
};

// Connect to Redis
const connectRedis = async () => {
  try {
    client = createRedisClient();
    
    client.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });
    
    client.on('error', (err) => {
      logger.error('❌ Redis connection error:', err);
    });
    
    client.on('ready', () => {
      logger.info('✅ Redis client ready');
    });
    
    await client.connect();
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

// Set a key with expiration
const setWithExpiry = async (key, value, expirySeconds) => {
  try {
    await client.setEx(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set error:', error);
    throw error;
  }
};

// Get a key
const get = async (key) => {
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    throw error;
  }
};

// Delete a key
const del = async (key) => {
  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete error:', error);
    throw error;
  }
};

// Check if key exists
const exists = async (key) => {
  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Redis exists error:', error);
    throw error;
  }
};

// Set a key without expiration
const set = async (key, value) => {
  try {
    await client.set(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set error:', error);
    throw error;
  }
};

// Increment a key
const incr = async (key) => {
  try {
    return await client.incr(key);
  } catch (error) {
    logger.error('Redis incr error:', error);
    throw error;
  }
};

// Get TTL of a key
const ttl = async (key) => {
  try {
    return await client.ttl(key);
  } catch (error) {
    logger.error('Redis TTL error:', error);
    throw error;
  }
};

// Add to a set
const sadd = async (key, ...members) => {
  try {
    return await client.sAdd(key, members);
  } catch (error) {
    logger.error('Redis SADD error:', error);
    throw error;
  }
};

// Get members of a set
const smembers = async (key) => {
  try {
    return await client.sMembers(key);
  } catch (error) {
    logger.error('Redis SMEMBERS error:', error);
    throw error;
  }
};

// Remove from a set
const srem = async (key, ...members) => {
  try {
    return await client.sRem(key, members);
  } catch (error) {
    logger.error('Redis SREM error:', error);
    throw error;
  }
};

// Check if member exists in set
const sismember = async (key, member) => {
  try {
    return await client.sIsMember(key, member);
  } catch (error) {
    logger.error('Redis SISMEMBER error:', error);
    throw error;
  }
};

// Get Redis client instance
const getClient = () => {
  return client;
};

module.exports = {
  connectRedis,
  setWithExpiry,
  get,
  del,
  exists,
  set,
  incr,
  ttl,
  sadd,
  smembers,
  srem,
  sismember,
  getClient
}; 