const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

async function deleteBadRecord() {
    try {
        console.log('Deleting record 521...');
        await db.query('DELETE FROM accidents WHERE id = 521');
        console.log('✅ Deleted record 521');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

deleteBadRecord();
