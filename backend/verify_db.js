require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ No DATABASE_URL found in .env");
  process.exit(1);
}

// Mask password for logging
const maskedString = connectionString.replace(/:([^:@]+)@/, ':****@');
console.log(`🔌 Testing connection to: ${maskedString}`);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000,
});

pool.connect()
  .then(client => {
    console.log('✅ Connected successfully to Supabase!');
    return client.query('SELECT NOW()')
      .then(res => {
        console.log('🕒 Database Time:', res.rows[0].now);
        client.release();
        process.exit(0);
      });
  })
  .catch(err => {
    console.error('❌ Connection Failed:', err.message);
    if (err.code === 'ENOTFOUND') {
      console.error('👉 Tip: The hostname was not found. Please double-check your Project Reference ID.');
    } else if (err.code === '28P01') {
      console.error('👉 Tip: Authentication failed. Check your database password.');
    }
    process.exit(1);
  });
