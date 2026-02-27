require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    console.log('Migrating ai_analysis_cache table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_analysis_cache (
          id SERIAL PRIMARY KEY,
          analysis_type VARCHAR(50) NOT NULL,
          identifier VARCHAR(200) NOT NULL,
          last_accident_id INTEGER NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(analysis_type, identifier)
      );
    `);
    console.log('✅ ai_analysis_cache table created / verified.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
