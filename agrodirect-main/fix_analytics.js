const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'agrodirect.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Fix Users visit time trajectory (null registration dates)
    const defaultDate = new Date().toISOString();
    db.run(`UPDATE users SET registrationDate = ? WHERE registrationDate IS NULL`, [defaultDate], function(err) {
        if (!err) {
            console.log(`Updated registrationDate for ${this.changes} users that had NULL values.`);
        } else {
            console.error("Error updating users:", err);
        }
    });

    // 2. Fix 'aabc' top product by removing dummy orders containing it
    db.all(`SELECT id, items FROM orders`, (err, rows) => {
        if (!err && rows) {
            rows.forEach(row => {
                if (row.items && row.items.toLowerCase().includes('aabc')) {
                    db.run(`DELETE FROM orders WHERE id = ?`, [row.id], function(e) {
                        if (!e) console.log(`Deleted order ID ${row.id} containing dummy product 'aabc'.`);
                    });
                }
            });
        }
    });
});

setTimeout(() => {
    db.close();
    console.log("Database fixes applied successfully.");
}, 2000);
