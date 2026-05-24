const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'agrodirect.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        fs.writeFileSync('db_check_result.txt', 'Error opening database: ' + err.message);
        process.exit(1);
    }

    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            fs.writeFileSync('db_check_result.txt', 'Error querying table_info: ' + err.message);
        } else {
            fs.writeFileSync('db_check_result.txt', JSON.stringify(columns, null, 2));
        }
        db.close();
    });
});
