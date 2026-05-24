const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'agrodirect.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }

    db.all("PRAGMA table_info(users)", [], (err, columns) => {
        if (err) {
            console.error('Error querying table_info:', err.message);
        } else {
            console.log('Users columns:');
            columns.forEach(c => console.log(`- ${c.name} (${c.type})`));
        }
        db.close();
    });
});
