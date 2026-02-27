const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function setupAuth() {
    console.log('🔗 Connecting to:', process.env.DATABASE_URL ? 'URL found' : 'URL MISSING');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('🛡️  Creating users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ users table ready');

        // Check if VIJ-POLICE exists
        const checkRes = await pool.query('SELECT username FROM users WHERE username = $1', ['VIJ-POLICE']);
        
        if (checkRes.rows.length === 0) {
            console.log('👤 Seeding VIJ-POLICE account...');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin@321', salt);
            
            await pool.query(
                'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
                ['VIJ-POLICE', hash, 'admin']
            );
            console.log('✅ Account seeded successfully!');
        } else {
            console.log('ℹ️  Account VIJ-POLICE already exists. Updating password to ensure it matches requirement...');
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin@321', salt);
            
            await pool.query(
                'UPDATE users SET password_hash = $2 WHERE username = $1',
                ['VIJ-POLICE', hash]
            );
            console.log('✅ Account password updated to requested credentials!');
        }

    } catch (err) {
        console.error('❌ Error setting up auth:', err.message);
    } finally {
        await pool.end();
        console.log('🔌 Database connection closed.');
    }
}

setupAuth();
