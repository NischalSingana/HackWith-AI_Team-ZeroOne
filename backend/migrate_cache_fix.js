const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function fixCacheTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('🚀 Ensuring ai_analysis_cache table exists...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_analysis_cache (
                id              SERIAL PRIMARY KEY,
                analysis_type   VARCHAR(50) NOT NULL,
                identifier      VARCHAR(200) NOT NULL,
                last_accident_id INTEGER NOT NULL,
                data            JSONB NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(analysis_type, identifier)
            );
            CREATE INDEX IF NOT EXISTS idx_cache_lookup ON ai_analysis_cache(analysis_type, identifier);
        `);
        console.log('✅ ai_analysis_cache table is ready!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

fixCacheTable();
