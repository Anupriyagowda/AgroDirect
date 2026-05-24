const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'agrodirect.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }

    db.run("ALTER TABLE users ADD COLUMN isVerified BOOLEAN DEFAULT 0", (err) => {
        if (err) {
            console.log('Error or already exists:', err.message);
        } else {
            console.log('Successfully added isVerified column to users table');
        }
        db.close();
    });
});
