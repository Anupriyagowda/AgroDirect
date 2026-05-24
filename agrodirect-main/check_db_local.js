const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'agrodirect.db');
console.log('Using DB_PATH:', DB_PATH);
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }

    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, rows) => {
        if (err) {
            console.error('Error querying sqlite_master:', err.message);
        } else {
            console.log('Users table status:', rows.length > 0 ? 'Exists' : 'Missing');
            if (rows.length > 0) {
                db.all("PRAGMA table_info(users)", [], (err, columns) => {
                    if (err) console.error('Error querying table_info:', err.message);
                    else console.log('Users table columns:', JSON.stringify(columns, null, 2));
                    db.close();
                });
            } else {
                db.close();
            }
        }
    });
});
