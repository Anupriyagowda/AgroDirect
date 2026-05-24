const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('agrodirect.db');

const run = (sql) => new Promise((resolve, reject) => {
    db.run(sql, [], function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

async function init() {
    try {
        const categories = ['fruits', 'vegetables', 'seeds', 'saplings', 'oilextracts', 'grains'];
        for (const cat of categories) {
            await run(`CREATE TABLE IF NOT EXISTS ${cat} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                price REAL,
                desc TEXT,
                isAvailable BOOLEAN,
                img TEXT,
                size TEXT,
                sellerEmail TEXT
            )`);
            console.log("Verified table: " + cat);
        }
        console.log("Done");
    } catch (e) {
        console.error(e.message);
    }
}
init();
