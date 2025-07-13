require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../connection');
const { logger } = require('../../utils/logger');

async function runSeeds() {
  try {
    logger.info('🌱 Starting database seeding...');
    
    // Read seed files
    const seedsDir = path.join(__dirname);
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Run seeds
    for (const file of seedFiles) {
      logger.info(`📄 Running seed: ${file}`);
      
      const seedPath = path.join(seedsDir, file);
      const seedSQL = fs.readFileSync(seedPath, 'utf8');
      
      // Execute seed
      await query(seedSQL);
      
      logger.info(`✅ Seed completed: ${file}`);
    }
    
    logger.info('🎉 All seeds completed successfully!');
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds }; 