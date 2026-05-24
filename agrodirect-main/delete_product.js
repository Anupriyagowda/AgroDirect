const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbs = [
    path.resolve(__dirname, 'agrodirect.db'),
    path.resolve(__dirname, 'backend/agrodirect.db'),
    path.resolve(__dirname, 'frontend/adminpanel/agrodirect.db'),
    path.resolve(__dirname, 'frontend/adminpanel/database.db')
];

const targetName = 'aabc';

dbs.forEach(dbPath => {
    if (!fs.existsSync(dbPath)) return;
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return;
    });

    db.serialize(() => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err || !tables) return;
            
            tables.forEach(t => {
                if (t.name === 'users' || t.name === 'sqlite_sequence' || t.name === 'orders') return;
                
                db.all(`SELECT * FROM ${t.name}`, (err, rows) => {
                    if (err) return;
                    if (rows && rows.length > 0) {
                        rows.forEach(r => {
                            const name = r.name || r.title || r.product_name;
                            if (name) {
                                console.log(`[DB: ${path.basename(dbPath)}] [Table: ${t.name}] ID: ${r.id} Name: ${name}`);
                                if (name.toLowerCase().includes(targetName)) {
                                    db.run(`DELETE FROM ${t.name} WHERE id = ?`, [r.id], (e) => {
                                        if(!e) console.log(`+++ DELETED product '${name}' from table '${t.name}' in DB '${path.basename(dbPath)}'`);
                                    });
                                }
                            }
                        });
                    }
                });
            });
        });
    });
    setTimeout(() => db.close(), 3000);
});
