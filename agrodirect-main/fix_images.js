const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'agrodirect.db');
const db = new sqlite3.Database(dbPath);

const tables = ['vegetables', 'fruits', 'grains', 'seeds', 'saplings', 'oilextracts', 'products'];
const placeholder = 'https://via.placeholder.com/150?text=No+Image';

db.serialize(() => {
    tables.forEach(table => {
        db.run(`UPDATE ${table} SET img = ? WHERE img LIKE '%fakepath%' OR img IS NULL OR img = ''`, [placeholder], (err) => {
            if (err) {
                // Table might not exist in some versions of the schema, just log it
                console.log(`Note: ${table} update skipped or failed (might not exist).`);
            } else {
                console.log(`Successfully cleaned images in ${table}.`);
            }
        });
    });
});

db.close();
