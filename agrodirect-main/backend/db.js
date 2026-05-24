const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'agrodirect.sqlite');
let db;

const connectDB = () => {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('SQLite connection error:', err);
      process.exit(1);
    } else {
      console.log('SQLite DB connected successfully');
    }
  });
  return db;
};

module.exports = connectDB;