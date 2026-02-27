const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL;

let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  // Test connection on startup
  pool.query('SELECT NOW()')
    .then(res => console.log('✅ Database connected:', res.rows[0].now))
    .catch(err => console.error('❌ Database connection failed:', err.message));
} else {
  console.error('⚠️ No DATABASE_URL set in .env');
}

module.exports = {
  query: (text, params) => {
    if (!pool) throw new Error('Database not configured');
    return pool.query(text, params);
  },
  pool: pool || {
    connect: () => { throw new Error('Database not configured - check DATABASE_URL in .env'); }
  },
  isConnected: () => !!pool,
};
