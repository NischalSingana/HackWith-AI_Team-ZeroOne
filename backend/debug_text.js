const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

async function debugRawText() {
    try {
        const res = await db.query(`
            SELECT id, raw_text 
            FROM accidents 
            WHERE id = 521
        `);
        if (res.rows.length > 0) {
            console.log('--- Raw Text Start ---');
            console.log(res.rows[0].raw_text.substring(0, 2000)); // First 2000 chars
            console.log('--- Raw Text End ---');
        } else {
            console.log('Record 521 not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debugRawText();
