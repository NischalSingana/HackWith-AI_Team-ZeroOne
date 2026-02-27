const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

async function debugAccidents() {
    try {
        const res = await db.query(`
            SELECT id, fir_number, cause, severity, status, pdf_url, created_at, length(raw_text) as text_len 
            FROM accidents 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debugAccidents();
