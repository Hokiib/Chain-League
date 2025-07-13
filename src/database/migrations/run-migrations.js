require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../connection');
const { logger } = require('../../utils/logger');

async function runMigrations() {
  try {

    logger.info('🔄 Starting database migrations...');
    
    // Read migration files
    const migrationsDir = path.join(__dirname);
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get executed migrations
    const executedMigrations = await query('SELECT filename FROM migrations');
    const executedFiles = executedMigrations.rows.map(row => row.filename);
    
    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedFiles.includes(file)) {
        logger.info(`📄 Running migration: ${file}`);
        
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration
        await query(migrationSQL);
        
        // Record migration as executed
        await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        
        logger.info(`✅ Migration completed: ${file}`);
      } else {
        logger.info(`⏭️ Migration already executed: ${file}`);
      }
    }
    
    logger.info('🎉 All migrations completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations }; 