const { Pool } = require('pg');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function resetDatabase() {
    console.log('🔗 Connecting to:', process.env.DATABASE_URL?.[0] ? 'URL found' : 'URL MISSING');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Connected to NeonDB:', res.rows[0].now);

        // List existing tables
        const existing = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('\n🗑️  Existing tables to drop:');
        existing.rows.forEach(t => console.log(`   - ${t.table_name}`));

        // ============================================================
        // STEP 1: Drop ALL existing tables
        // ============================================================
        console.log('\n🧹 Dropping all existing tables...');
        await pool.query('DROP SCHEMA public CASCADE');
        await pool.query('CREATE SCHEMA public');
        await pool.query('GRANT ALL ON SCHEMA public TO neondb_owner');
        await pool.query('GRANT ALL ON SCHEMA public TO public');
        console.log('✅ All old tables dropped\n');

        // ============================================================
        // STEP 2: Create FIR Analysis schema
        // ============================================================
        console.log('📐 Creating FIR Analysis schema...\n');

        await pool.query(`
            -- ============================================================
            -- ACCIDENTS: Core table for every FIR/accident record
            -- ============================================================
            CREATE TABLE accidents (
                id              SERIAL PRIMARY KEY,
                fir_number      VARCHAR(100) NOT NULL,
                incident_date   TIMESTAMP,
                reported_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cause           TEXT,
                severity        VARCHAR(20) CHECK (severity IN ('Fatal', 'Grievous', 'Non-Fatal', 'Unknown')),
                pdf_url         TEXT,
                status          VARCHAR(30) DEFAULT 'Processed',
                confidence_score FLOAT DEFAULT 0.0,
                raw_text        TEXT,                  -- Extracted text (for search)
                ai_analysis     JSONB,                 -- Detailed AI insights (factors, justification)
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- ============================================================
            -- LOCATIONS: One per accident
            -- ============================================================
            CREATE TABLE locations (
                id              SERIAL PRIMARY KEY,
                accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
                address         TEXT,
                area            VARCHAR(200),
                city            VARCHAR(100) DEFAULT 'Vijayawada',
                landmark        VARCHAR(200),
                latitude        DECIMAL(10, 8),
                longitude       DECIMAL(11, 8)
            );

            -- ============================================================
            -- VICTIMS: Multiple per accident
            -- ============================================================
            CREATE TABLE victims (
                id              SERIAL PRIMARY KEY,
                accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
                victim_name     VARCHAR(200),
                age             INTEGER,
                gender          VARCHAR(20),
                injury_severity VARCHAR(100),
                is_fatality     BOOLEAN DEFAULT FALSE
            );

            -- ============================================================
            -- VEHICLES: Multiple per accident
            -- ============================================================
            CREATE TABLE vehicles (
                id              SERIAL PRIMARY KEY,
                accident_id     INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
                vehicle_type    VARCHAR(50),
                vehicle_number  VARCHAR(30),
                driver_name     VARCHAR(200)
            );

            -- ============================================================
            -- AI_INSIGHTS: Cached LLM-generated insights
            -- ============================================================
            CREATE TABLE ai_insights (
                id              SERIAL PRIMARY KEY,
                input_stats     JSONB NOT NULL,
                summary         TEXT,
                key_insights    JSONB,
                policy_recs     JSONB,
                public_tips     JSONB,
                provider        VARCHAR(50),
                model           VARCHAR(100),
                latency_ms      INTEGER,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- ============================================================
            -- AI_ANALYSIS_CACHE: Persistent cache for high-latency AI reports
            -- ============================================================
            CREATE TABLE IF NOT EXISTS ai_analysis_cache (
                id              SERIAL PRIMARY KEY,
                analysis_type   VARCHAR(50) NOT NULL, -- 'global_insights', 'trends', 'jurisdiction'
                identifier      VARCHAR(200) NOT NULL, -- 'all', DCP name, Station name
                last_accident_id INTEGER NOT NULL,    -- To detect if new data arrived
                data            JSONB NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(analysis_type, identifier)
            );

            -- ============================================================
            -- INDEXES: For fast queries on common access patterns
            -- ============================================================
            CREATE INDEX idx_accidents_fir        ON accidents(fir_number);
            CREATE INDEX idx_accidents_date       ON accidents(incident_date);
            CREATE INDEX idx_accidents_severity   ON accidents(severity);
            CREATE INDEX idx_accidents_cause      ON accidents(cause);
            CREATE INDEX idx_accidents_created     ON accidents(created_at DESC);
            CREATE INDEX idx_locations_area       ON locations(area);
            CREATE INDEX idx_locations_city       ON locations(city);
            CREATE INDEX idx_locations_coords     ON locations(latitude, longitude);
            CREATE INDEX idx_victims_age          ON victims(age);
            CREATE INDEX idx_victims_gender       ON victims(gender);
            CREATE INDEX idx_vehicles_type        ON vehicles(vehicle_type);
            CREATE INDEX idx_vehicles_number      ON vehicles(vehicle_number);
            CREATE INDEX idx_insights_created     ON ai_insights(created_at DESC);
            CREATE INDEX idx_cache_lookup         ON ai_analysis_cache(analysis_type, identifier);
        `);

        console.log('✅ All tables created!\n');

        // Verify
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('📋 Tables in database:');
        tables.rows.forEach(t => console.log(`   ✅ ${t.table_name}`));

        // Show column details
        for (const table of tables.rows) {
            const cols = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table.table_name]);
            console.log(`\n   📌 ${table.table_name} (${cols.rows.length} columns):`);
            cols.rows.forEach(c => {
                console.log(`      ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'nullable'}`);
            });
        }

        console.log('\n🎉 Database reset complete!');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

resetDatabase();
