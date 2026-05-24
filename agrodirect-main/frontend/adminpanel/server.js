
const express = require("express");
const sqlite3 = require('sqlite3').verbose();
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "agrodirect_secret_key";
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require('path');
const { spawn } = require('child_process');
require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const multer = require("multer");
const emailService = require("./email-service");

const app = express();
const fs = require('fs');
const textToSpeech = require('@google-cloud/text-to-speech');

// Try to initialize Google Cloud TTS client; fail gracefully if credentials not available
let ttsClient = null;
let hasGoogleCredentials = false;
try {
    ttsClient = new textToSpeech.TextToSpeechClient();
    hasGoogleCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!hasGoogleCredentials) {
        console.warn('[TTS] GOOGLE_APPLICATION_CREDENTIALS not set. Using development fallback for TTS.');
    }
} catch (e) {
    console.warn('[TTS] Could not initialize Google Cloud TTS client:', e.message);
}

const GOOGLE_TTS_VOICE_MAP = {
    'hi-IN': 'hi-IN-Wavenet-A',
    'ta-IN': 'ta-IN-Wavenet-A',
    'kn-IN': 'kn-IN-Wavenet-A',
    'te-IN': 'te-IN-Wavenet-A',
    'gu-IN': 'gu-IN-Wavenet-A',
    'ml-IN': 'ml-IN-Wavenet-A',
    'en-US': 'en-US-Wavenet-F'
};

function getGoogleTtsVoice(lang) {
    if (!lang) return GOOGLE_TTS_VOICE_MAP['en-US'];
    const normalized = lang.toLowerCase().replace('_', '-');
    if (GOOGLE_TTS_VOICE_MAP[normalized]) return GOOGLE_TTS_VOICE_MAP[normalized];
    const base = normalized.split('-')[0];
    const fallback = Object.keys(GOOGLE_TTS_VOICE_MAP).find(code => code.startsWith(base));
    return GOOGLE_TTS_VOICE_MAP[fallback] || GOOGLE_TTS_VOICE_MAP['en-US'];
}

// Development fallback: generate silent MP3-like audio for testing (when Google credentials not available)
async function generateDevelopmentAudio() {
    // Return a minimal valid MP3 frame (~100 bytes) for development/testing
    // Real MP3 data would be much larger; this is just for endpoint validation
    const buffer = Buffer.from([
        0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    return buffer.toString('base64');
}

// Ensure upload directories exist
const uploadDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/product_images'),
    path.join(__dirname, '../uploads/certificates'),
    path.join(__dirname, '../uploads/backgrounds')
];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup for certificate uploads
const certStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/certificates'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cert-' + uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const uploadCert = multer({ storage: certStorage });

const signupOtpSessions = new Map();
const SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupSignupOtpSessions() {
    const now = Date.now();
    for (const [sessionId, session] of signupOtpSessions.entries()) {
        if (!session || session.expiresAt <= now) {
            signupOtpSessions.delete(sessionId);
        }
    }
}

const signupOtpCleanupTimer = setInterval(cleanupSignupOtpSessions, 5 * 60 * 1000);
if (signupOtpCleanupTimer.unref) signupOtpCleanupTimer.unref();




// ✅ **Admin: Get Unverified Farmers**
app.get("/admin/unverified-farmers", async (req, res) => {
    try {
        const rows = await query(`SELECT id, name, email, role FROM users WHERE role = 'farmer' AND (isVerified IS NULL OR isVerified = 0)`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configure multer for background uploads
const bgStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/backgrounds'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.body.key || 'bg'}_${Date.now()}${ext}`);
    }
});
const uploadBg = multer({ storage: bgStorage });

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// 1. CSP Middleware (Must be FIRST)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "connect-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval'; " +
        "style-src * 'unsafe-inline'; " +
        "img-src * data: blob:; " +
        "font-src *; " +
        "frame-src *; " +
        "media-src * data: blob:;"
    );
    next();
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Google Cloud TTS endpoint is registered after all other app routes to preserve correct middleware ordering.
// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "../")));

const DB_PATH = path.join(__dirname, '../../agrodirect.db');
console.log(`Attempting to connect to database at: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("❌ Error opening database:", err.message);
        process.exit(1);
    } else {
        console.log("✅ Connected to the SQLite database.");
        initializeDatabase();
        startServer();
    }
});

// Helper to run queries as promises
const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

function openInDefaultBrowser(url) {
    const platform = process.platform;

    if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', '""', url], {
            detached: true,
            stdio: 'ignore',
            shell: false
        }).unref();
        return;
    }

    if (platform === 'darwin') {
        spawn('open', [url], {
            detached: true,
            stdio: 'ignore'
        }).unref();
        return;
    }

    spawn('xdg-open', [url], {
        detached: true,
        stdio: 'ignore'
    }).unref();
}

/**
 * Helper: Cascading delete of all products across all categories for a given seller email.
 */
async function deleteFarmerProducts(sellerEmail) {
    if (!sellerEmail) return;
    try {
        const categories = await query(`SELECT name FROM categories`);
        for (const cat of categories) {
            const tableName = cat.name.toLowerCase().replace(/\s+/g, '');
            await run(`DELETE FROM ${tableName} WHERE sellerEmail = ?`, [sellerEmail]);
            console.log(`[CLEANUP] Deleted products for ${sellerEmail} from table: ${tableName}`);
        }
    } catch (err) {
        console.error(`[CLEANUP ERROR] Failed to delete products for ${sellerEmail}:`, err.message);
    }
}

// ✅ **Token Verification Middleware**
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

function initializeDatabase() {
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence', 'users', 'orders', 'feedback', 'categories')`, [], (err, tables) => {
        if (!err) {
            tables.forEach(row => {
                const table = row.name;
                db.run(`ALTER TABLE ${table} ADD COLUMN sellerEmail TEXT`, () => {});
                db.run(`ALTER TABLE ${table} ADD COLUMN size TEXT`, () => {});
            });
        }
    });

    const defaultTables = ['vegetables'];
    defaultTables.forEach(table => {
        db.run(`CREATE TABLE IF NOT EXISTS ${table} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            price REAL,
            desc TEXT,
            isAvailable BOOLEAN,
            img TEXT,
            size TEXT,
            sellerEmail TEXT
        )`, (err) => {
            if (err) console.error(`❌ Error creating table ${table}:`, err.message);
        });
    });

    // New Tables for Delivery Platform
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        password TEXT,
        role TEXT,
        isVerified INTEGER DEFAULT 0,
        certificate TEXT,
        cart TEXT,
        address TEXT
    )`, (err) => {
        if (!err) {
            db.run(`ALTER TABLE users ADD COLUMN isVerified INTEGER DEFAULT 0`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN certificate TEXT`, (err) => {});
                db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN cart TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN address TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN registrationDate TEXT`, (err) => {
                if (!err) {
                    // Initialize existing users with a default date if needed
                    db.run(`UPDATE users SET registrationDate = ? WHERE registrationDate IS NULL`, [new Date().toISOString()]);
                }
            });
            
            // Insert default admin if not exists
            const adminEmail = 'agrodirectt@gmail.com';
            db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (name, email, password, role, isVerified) VALUES ('System Admin', ?, 'agrodirect@123', 'admin', 1)`, [adminEmail]);
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userEmail TEXT,
        items TEXT,
        totalPrice REAL,
        paymentMethod TEXT,
        orderDate TEXT,
        status TEXT DEFAULT 'pending',
        razorpayOrderId TEXT,
        razorpayPaymentId TEXT,
        razorpaySignature TEXT,
        isPaid BOOLEAN DEFAULT 0
    )`, (err) => {
        if (!err) {
            // Ensure columns exist for older databases
            db.run(`ALTER TABLE orders ADD COLUMN isPaid BOOLEAN DEFAULT 0`, () => {});
            db.run(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`, () => {});
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userEmail TEXT,
        userName TEXT,
        rating INTEGER,
        title TEXT,
        comment TEXT,
        date TEXT
    )`);

    // TODO: Fix contact_messages table - currently has duplicate column issue
    // db.run(`CREATE TABLE IF NOT EXISTS contact_messages (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     userEmail TEXT,
    //     userName TEXT,
    //     phone TEXT,
    //     subject TEXT,
    //     message TEXT,
    //     date TEXT,
    //     adminReply TEXT,
    //     replyDate TEXT,
    //     isReplied INTEGER DEFAULT 0
    // )`, (err) => {
    //     if (err && err.message.includes('duplicate')) {
    //         console.log('Contact messages table already exists with expected schema');
    //     } else if (err) {
    //         console.error('Error creating contact_messages table:', err.message);
    //     }
    // });

    // Dynamic Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        displayName TEXT,
        image TEXT
    )`, (err) => {
        if (!err) {
            // Add image column if missing (migration for existing db)
            db.run(`ALTER TABLE categories ADD COLUMN image TEXT`, (alterErr) => {
                // Ignore error if column already exists
            });

            const initialCategories = [
                { name: 'vegetables', display: 'Vegetables' },
                { name: 'fruits', display: 'Fruits' },
                { name: 'grains', display: 'Grains' },
                { name: 'oilextracts', display: 'Oil Extracts' },
                { name: 'saplings', display: 'Saplings' },
                { name: 'seeds', display: 'Seeds' }
            ];
            initialCategories.forEach(cat => {
                db.run(`INSERT OR IGNORE INTO categories (name, displayName) VALUES (?, ?)`, [cat.name, cat.display]);
                
                // Also create the table for each category
                db.run(`CREATE TABLE IF NOT EXISTS ${cat.name} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    price REAL,
                    desc TEXT,
                    isAvailable BOOLEAN,
                    img TEXT,
                    size TEXT,
                    sellerEmail TEXT
                )`);
            });
        }
    });

    // Settings Table for Customization
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        value TEXT
    )`, (err) => {
        if (!err) {
            const initialSettings = [
                { key: 'primaryColor', value: '#2E5A1C' },
                { key: 'primaryLight', value: '#4CAF50' },
                { key: 'backgroundColor', value: '#f8f9fa' },
                { key: 'loginBg', value: '/login-bg.png' },
                { key: 'websiteBg', value: '' }
            ];
            initialSettings.forEach(s => {
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
            });
        }
    });
}

function startServer() {
    // ✅ **Dummy route for Chrome DevTools requests**
    app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
        res.json({ message: "Discovery success (dummy)" });
    });

    // ✅ **Favicon Handler (Silences 404 logs)**
    app.get("/favicon.ico", (req, res) => res.status(204).end());

    // Redirects for broken home page relative paths
    app.get(["/home page/adminpanel/admin.html", "/home%20page/adminpanel/admin.html"], (req, res) => {
        res.redirect("/adminpanel/admin.html");
    });

    app.get(["/home page/adminpanel/admin.html", "/home%20page/adminpanel/admin.html"], (req, res) => {
        res.redirect("/adminpanel/admin.html");
    });

    app.get(["/home page/index.html", "/home%20page/index.html"], (req, res) => {
        res.redirect("/index.html");
    });

    // SPA Fallback: Serve index.html for SPA routes (not for files with extensions)
    app.use((req, res) => {
        // Don't serve index.html for API routes or file requests
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.includes('.')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(__dirname, "../index.html"));
    });

    const PORT = 5003;
    const server = app.listen(PORT, () => {
        const localUrl = `http://localhost:${PORT}`;
        console.log(`🚀 Admin Server is running: ${localUrl}`);
        openInDefaultBrowser(localUrl);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use.`);
        } else {
            console.error("❌ Server error:", err.message);
        }
        process.exit(1);
    });

    // Keep the process alive
    setInterval(() => {
        if (db) {
            db.get("SELECT 1", [], (err) => {
                if (err) console.error("📡 Database keep-alive failed:", err.message);
            });
        }
    }, 30000);
}

// ✅ **Admin: Get All Categories**
app.get("/admin/categories", async (req, res) => {
    try {
        const rows = await query(`SELECT * FROM categories`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Items by Category (with optional seller filter)**
app.get("/admin/items/:category", async (req, res) => {
    const { category } = req.params;
    const { sellerEmail } = req.query;
    try {
        let sql = `SELECT * FROM ${category}`;
        let params = [];
        if (sellerEmail) {
            sql += ` WHERE sellerEmail = ?`;
            params = [sellerEmail];
        }
        const rows = await query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Unverified Farmers**
app.get("/admin/unverified-farmers", async (req, res) => {
    try {
        const rows = await query(`SELECT id, name, email, role FROM users WHERE role = 'farmer' AND isVerified = 0`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Verify Farmer**
app.post("/admin/verify-farmer", async (req, res) => {
    const { id } = req.body;
    try {
        // Fetch farmer details before updating
        const users = await query(`SELECT name, email FROM users WHERE id = ? AND role = 'farmer'`, [id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Farmer not found" });
        }
        const { name, email } = users[0];

        const result = await run(`UPDATE users SET isVerified = 1 WHERE id = ? AND role = 'farmer'`, [id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Farmer already verified or not found" });
        }

        // Send approval email
        await emailService.sendFarmerApprovalEmail(email, name);

        res.json({ success: true, message: "Farmer verified successfully and notification email sent." });
    } catch (error) {
        console.error("Error in verify-farmer:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Reject Farmer (Delete pending request)**
app.delete("/admin/reject-farmer/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch farmer details first to get the email for cleanup
        const users = await query(`SELECT email FROM users WHERE id = ? AND role = 'farmer'`, [id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Farmer request not found" });
        }
        const { email } = users[0];

        // 1. Cascading cleanup of products
        await deleteFarmerProducts(email);

        // 2. Remove the user
        const result = await run(`DELETE FROM users WHERE id = ? AND role = 'farmer' AND isVerified = 0`, [id]);
        if (result.changes === 0) {
             return res.status(500).json({ success: false, message: "Failed to remove farmer record" });
        }
        
        res.json({ success: true, message: "Farmer request rejected and all their products removed." });
    } catch (error) {
        console.error("Error in reject-farmer:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Remove Verified Farmer**
app.delete("/admin/remove-farmer/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch farmer details first to get the email for cleanup
        const users = await query(`SELECT email FROM users WHERE id = ? AND role = 'farmer'`, [id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Verified farmer not found" });
        }
        const { email } = users[0];

        // 1. Cascading cleanup of products
        await deleteFarmerProducts(email);

        // 2. Remove the user
        const result = await run(`DELETE FROM users WHERE id = ? AND role = 'farmer' AND isVerified = 1`, [id]);
        if (result.changes === 0) {
             return res.status(500).json({ success: false, message: "Failed to remove verified farmer record" });
        }

        res.json({ success: true, message: "Verified farmer and all their products removed successfully." });
    } catch (error) {
        console.error("Error in remove-farmer:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Verified Farmers**
app.get("/admin/verified-farmers", async (req, res) => {
    try {
        const rows = await query(`SELECT id, name, email, role FROM users WHERE role = 'farmer' AND isVerified = 1`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Farmer Status by Email**
app.get("/admin/farmer-status", async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const rows = await query(`SELECT isVerified FROM users WHERE email = ? AND role = 'farmer'`, [email]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Farmer not found" });
        }
        res.json({ isVerified: rows[0].isVerified });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Specific Farmer Details**
app.get("/admin/farmer-details/:id", async (req, res) => {
    try {
        const rows = await query(`SELECT id, name, email, role, isVerified, certificate, address, registrationDate FROM users WHERE id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Analytics - Monthly Sales**
app.get("/admin/analytics/monthly-sales", async (req, res) => {
    try {
        // Aggregate sales by month
        const salesRows = await query(`
            SELECT 
                strftime('%Y-%m', orderDate) as month, 
                COUNT(*) as totalOrders, 
                SUM(totalPrice) as totalSales 
            FROM orders 
            WHERE status != 'cancelled'
            GROUP BY month 
            ORDER BY month ASC
        `);

        // Get Top Products (parsing the JSON items column)
        const orders = await query(`SELECT items, strftime('%Y-%m', orderDate) as month FROM orders WHERE status != 'cancelled'`);
        const productStats = {};
        const monthlyProductStats = {};

        orders.forEach(order => {
            const items = JSON.parse(order.items);
            const month = order.month;
            
            if (!monthlyProductStats[month]) {
                monthlyProductStats[month] = {};
            }
            
            items.forEach(item => {
                const name = item.name || item.productName;
                productStats[name] = (productStats[name] || 0) + (item.quantity || 1) * item.price;
                monthlyProductStats[month][name] = (monthlyProductStats[month][name] || 0) + (item.quantity || 1) * item.price;
            });
        });

        // Add top product for each month
        const salesWithTopProduct = salesRows.map(month => {
            let topProduct = 'N/A';
            if (monthlyProductStats[month.month]) {
                const monthProducts = Object.entries(monthlyProductStats[month.month])
                    .sort((a, b) => b[1] - a[1]);
                if (monthProducts.length > 0) {
                    topProduct = monthProducts[0][0];
                }
            }
            return {
                ...month,
                topProduct: topProduct
            };
        });

        const topProducts = Object.entries(productStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, sales]) => ({ name, sales }));

        res.json({ salesByMonth: salesWithTopProduct, topProducts });
    } catch (error) {
        console.error("Sales Analytics Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Analytics - User Visits (Registrations)**
app.get("/admin/analytics/user-visits", async (req, res) => {
    try {
        const rows = await query(`
            SELECT 
                strftime('%Y-%m', registrationDate) as month, 
                COUNT(*) as userCount 
            FROM users 
            GROUP BY month 
            ORDER BY month ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Add Category**
app.post("/admin/add-category", async (req, res) => {
    const { name, displayName } = req.body;
    if (!name || !displayName) return res.status(400).json({ error: "Missing name or displayName" });

    const tableName = name.toLowerCase().replace(/\s+/g, '');
    try {
        await run(`INSERT INTO categories (name, displayName) VALUES (?, ?)`, [tableName, displayName]);
        await run(`CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            price REAL,
            desc TEXT,
            isAvailable BOOLEAN,
            img TEXT,
            size TEXT,
            sellerEmail TEXT
        )`);
        res.json({ success: true, message: `Category '${displayName}' added successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Edit Category**
app.post("/admin/edit-category", async (req, res) => {
    const { id, newDisplayName } = req.body;
    try {
        await run(`UPDATE categories SET displayName = ? WHERE id = ?`, [newDisplayName, id]);
        res.json({ success: true, message: "Category display name updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Update Category Image**
app.post("/admin/update-category-image", async (req, res) => {
    const { id, imageBase64 } = req.body;
    try {
        if (!id || !imageBase64) return res.status(400).json({ error: "Missing id or image data" });
        await run(`UPDATE categories SET image = ? WHERE id = ?`, [imageBase64, id]);
        res.json({ success: true, message: "Category image updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Delete Category**
app.post("/admin/delete-category", async (req, res) => {
    const { id } = req.body;
    try {
        const rows = await query(`SELECT name FROM categories WHERE id = ?`, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Category not found" });
        const tableName = rows[0].name;
        await run(`DELETE FROM categories WHERE id = ?`, [id]);
        await run(`DROP TABLE IF EXISTS ${tableName}`);
        res.json({ success: true, message: `Category and its items deleted successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin/Farmer: Delete Product Item**
app.delete("/admin/delete-item/:category/:id", async (req, res) => {
    const { category, id } = req.params;
    const { sellerEmail } = req.query;
    try {
        if (sellerEmail && sellerEmail !== 'admin@agrodirect.com') {
            const product = await query(`SELECT sellerEmail FROM ${category} WHERE id = ?`, [id]);
            if (product.length === 0 || product[0].sellerEmail !== sellerEmail) {
                return res.status(403).json({ success: false, message: "You can only delete your own products." });
            }
        }
        const result = await run(`DELETE FROM ${category} WHERE id = ?`, [id]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        res.json({ success: true, message: "Item deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Alias for legacy calls to /admin/:category**
app.get("/admin/:category", (req, res) => {
    res.redirect(`/admin/items/${req.params.category}`);
});

// ✅ **Admin: Update Availability**
app.post("/admin/select-:category", async (req, res) => {
    const { category } = req.params;
    const { name, isAvailable, size } = req.body;

    try {
        // Try to find if the category exists (as provided or with 's' suffix)
        const categories = await query(`SELECT name FROM categories WHERE name = ? OR name = ?`, [category, category + 's']);
        if (categories.length === 0) return res.status(400).json({ error: "Invalid category" });
        
        const tableName = categories[0].name;

        let sql = `UPDATE ${tableName} SET isAvailable = ? WHERE name = ?`;
        let params = [isAvailable ? 1 : 0, name];

        if (size !== undefined) {
            sql = `UPDATE ${tableName} SET isAvailable = ?, size = ? WHERE name = ?`;
            params = [isAvailable ? 1 : 0, size, name];
        }

        const result = await run(sql, params);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: `${category} not found` });
        }

        res.json({ success: true, message: `${category} availability updated` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Client: Get Available Items with Ratings & Reviews**
app.get("/client/:category", async (req, res) => {
    const { category } = req.params;

    try {
        const categories = await query(`SELECT name FROM categories WHERE name = ?`, [category]);
        if (categories.length === 0) return res.status(400).json({ error: "Invalid category" });
        
        const tableName = categories[0].name;

        // Fetch products with their average rating and count
        const productRows = await query(`
            SELECT t.*, u.name as sellerName, 
                   COALESCE(avg_table.avgRating, 0) as avgRating, 
                   COALESCE(avg_table.ratingCount, 0) as ratingCount
            FROM ${tableName} t 
            LEFT JOIN users u ON t.sellerEmail = u.email 
            LEFT JOIN (
                SELECT productName, category, AVG(rating) as avgRating, COUNT(*) as ratingCount
                FROM reviews 
                WHERE category = ?
                GROUP BY productName
            ) avg_table ON t.name = avg_table.productName
            WHERE t.isAvailable = 1
        `, [category]);

        // Attach recent reviews to each product
        for (let product of productRows) {
            const reviews = await query(
                `SELECT userName, rating, comment, date FROM reviews 
                 WHERE productName = ? AND category = ? 
                 ORDER BY date DESC LIMIT 3`, 
                [product.name, category]
            );
            product.reviews = reviews;
        }

        res.json(productRows);
    } catch (error) {
        console.error("Client Fetch Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Admin: Update Price API
app.post("/admin/update-price", async (req, res) => {
    try {
        const { name, type, price } = req.body;
        if (!name || !type || price === undefined) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const priceNumber = parseFloat(price);
        if (isNaN(priceNumber) || priceNumber <= 0) {
            return res.status(400).json({ success: false, message: "Invalid price" });
        }

        const result = await run(`UPDATE ${type} SET price = ? WHERE name LIKE ?`, [priceNumber, name]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, message: "Price updated successfully", newPrice: priceNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Admin: Add Product API
app.post('/admin/add-product', async (req, res) => {
    try {
        const { category, name, price, desc, isAvailable, img, size, sellerEmail } = req.body;

        if (!category || !name || price === undefined || !desc) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Verification check for farmers (STRONGER ENFORCEMENT)
        if (sellerEmail) {
            const rows = await query(`SELECT isVerified, role FROM users WHERE email = ?`, [sellerEmail]);
            if (rows.length === 0) {
                return res.status(403).json({ success: false, message: "Seller account not found." });
            }
            if (rows[0].role === 'farmer' && rows[0].isVerified !== 1) {
                console.warn(`[SECURITY] Unverified farmer ${sellerEmail} attempted to add product: ${name}`);
                return res.status(403).json({ success: false, message: "Your account is not verified. You cannot list products until approved by admin." });
            }
        } else if (!sellerEmail && (!req.user || req.user.role !== 'admin')) {
             return res.status(403).json({ success: false, message: "Seller email required for product listing." });
        }

        const tableName = category.toLowerCase().replace(/\s+/g, '');

        // Ensure the table exists
        await run(`CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            price REAL,
            desc TEXT,
            isAvailable BOOLEAN,
            img TEXT,
            size TEXT,
            sellerEmail TEXT
        )`);

        const sql = `INSERT INTO ${tableName} (name, price, desc, isAvailable, img, size, sellerEmail) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [name, parseFloat(price), desc, (isAvailable === 'true' || isAvailable === true) ? 1 : 0, img || '', size || null, sellerEmail || 'admin@agrodirect.com'];

        await run(sql, params);

        res.json({ success: true, message: "Product added successfully" });
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ success: false, message: "Product name already exists" });
        }
        console.error("Error adding product:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Admin: Edit Product API
app.post('/admin/edit-product', async (req, res) => {
    try {
        const { category, id, name, price, desc, isAvailable, img, size, sellerEmail } = req.body;

        if (!category || !id || !name || price === undefined || !desc) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // If it's a farmer editing, ensure it's their product
        if (sellerEmail && sellerEmail !== 'admin@agrodirect.com') {
            const product = await query(`SELECT sellerEmail FROM ${category} WHERE id = ?`, [id]);
            if (product.length === 0 || product[0].sellerEmail !== sellerEmail) {
                return res.status(403).json({ success: false, message: "You can only edit your own products." });
            }
        }

        const sql = `UPDATE ${category} SET name = ?, price = ?, desc = ?, isAvailable = ?, img = ?, size = ? WHERE id = ?`;
        const params = [name, parseFloat(price), desc, (isAvailable === 'true' || isAvailable === true) ? 1 : 0, img || '', size || null, id];

        const result = await run(sql, params);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, message: "Product updated successfully" });
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ success: false, message: "Product name already exists" });
        }
        res.status(500).json({ error: error.message });
    }
});
// ✅ **Auth: Signup**
app.post('/api/signup/request-otp', async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const role = String(req.body.role || '').trim();
    const name = String(req.body.name || '').trim();

    if (!email || !role) {
        return res.status(400).json({ success: false, message: 'Email and role are required.' });
    }

    if (role === 'admin') {
        return res.status(400).json({ success: false, message: 'Admin signup is not allowed from this form.' });
    }

    try {
        const existingUser = await query(`SELECT id FROM users WHERE email = ?`, [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Email is already registered.' });
        }

        const sessionId = crypto.randomBytes(24).toString('hex');
        const emailOtp = generateOtp();
        signupOtpSessions.set(sessionId, {
            email,
            role,
            name,
            emailOtp,
            expiresAt: Date.now() + SIGNUP_OTP_TTL_MS
        });

        const emailResult = await emailService.sendSignupOtpEmail(email, name || 'there', emailOtp);

        const response = {
            success: true,
            message: 'Verification code sent to your email address.',
            sessionId,
            expiresInSeconds: Math.floor(SIGNUP_OTP_TTL_MS / 1000)
        };

        if (process.env.NODE_ENV !== 'production') {
            if (!emailResult || emailResult.success === false) {
                response.debugEmailOtp = emailOtp;
            }
        }

        return res.json(response);
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to generate verification codes.', error: error.message });
    }
});

app.post(["/auth/signup", "/api/signup"], uploadCert.single('certificate'), async (req, res) => {
    console.log(`[AUTH] Signup attempt for: ${req.body.email}`);
        const { name, email, phone, password, role, sessionId, emailOtp } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !password || !role || !sessionId) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const certificateFile = req.file ? `/uploads/certificates/${req.file.filename}` : null;

    try {
        const session = signupOtpSessions.get(sessionId);
        if (!session) {
            return res.status(400).json({ success: false, message: 'Verification session expired. Please request new OTP codes.' });
        }

        if (Date.now() > session.expiresAt) {
            signupOtpSessions.delete(sessionId);
            return res.status(400).json({ success: false, message: 'Verification codes expired. Please request new OTP codes.' });
        }

        if (session.email !== normalizedEmail || session.role !== role) {
            return res.status(400).json({ success: false, message: 'Verification details do not match the requested signup session.' });
        }

        if (String(emailOtp || '').trim() !== session.emailOtp) {
            return res.status(400).json({ success: false, message: 'Invalid email verification code.' });
        }

        if (role === 'farmer' && !certificateFile) {
            return res.status(400).json({ success: false, message: 'Farmer registration requires an organic certificate upload.' });
        }

        const existingUser = await query(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
        if (existingUser.length > 0) {
            signupOtpSessions.delete(sessionId);
            return res.status(400).json({ success: false, message: 'Email is already registered.' });
        }

        const isVerified = (role === 'farmer') ? 0 : 1; // Consumers are direct, farmers need verification
        await run(`INSERT INTO users (name, email, phone, password, role, isVerified, certificate, registrationDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, normalizedEmail, phone || null, password, role, isVerified, certificateFile, new Date().toISOString()]);
        
        // Generate a token for auto-login after signup
        const rows = await query(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
        const newUserId = rows[0]?.id;
        const token = jwt.sign({ id: newUserId, email: normalizedEmail, role }, JWT_SECRET, { expiresIn: '30d' });

        signupOtpSessions.delete(sessionId);

        res.json({ success: true, message: "Signup successful", token });
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Auth: Login**
app.post(["/auth/login", "/api/login"], async (req, res) => {
    const { email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    console.log(`[AUTH] Login attempt for: ${normalizedEmail}, requested role: ${role}`);

    try {
        const rows = await query(`SELECT * FROM users WHERE email = ? AND password = ?`, [normalizedEmail, password]);
        if (rows.length > 0) {
            const user = rows[0];
            // Enforce role match (Strictly)
            if (role && user.role !== role) {
                console.warn(`[AUTH] Role Mismatch for ${normalizedEmail}: Account is ${user.role}, attempted login as ${role}`);
                return res.status(403).json({ 
                    success: false, 
                    message: "Role mismatch",
                    accountRole: user.role,
                    requestedRole: role
                });
            }

            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
            console.log(`[AUTH] Login successful for: ${normalizedEmail} as ${user.role}`);
            res.json({ success: true, token, user: { name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Auth: Password Recovery**
app.post(["/auth/recover", "/api/recover"], async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    try {
        const rows = await query(`SELECT * FROM users WHERE email = ?`, [email]);
        if (rows.length === 0) {
            // Security: Don't reveal if email exists, but let user know they can check email
            return res.json({ success: true, message: "If this email exists, a reset link has been sent." });
        }

        const user = rows[0];
        // Reset token expires in 15 minutes
        const resetToken = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '15m' });
        
        const resetLink = `${process.env.BASE_URL || `${req.protocol}://${req.get('host')}`}/reset-password.html?token=${resetToken}`;
        
        // Send recovery email
        const emailResult = await emailService.sendPasswordResetEmail(user.email, resetLink);
        
        if (emailResult.success) {
            console.log(`[AUTH] Password reset email sent to: ${user.email}`);
            res.json({ success: true, message: "If this email exists, a reset link has been sent." });
        } else {
            // Fallback: log to console if email fails but token is generated (helpful for dev)
            console.warn(`[AUTH] Email failed but reset link generated: ${resetLink}`);
            res.status(500).json({ success: false, message: "Failed to send recovery email. Please try again later." });
        }
    } catch (err) {
        console.error("Error in recover route:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ **Auth: Password Reset**
app.post(["/auth/reset/:token", "/api/reset/:token"], async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, message: "New password required" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const email = decoded.email;

        // Perform the update
        await run(`UPDATE users SET password = ? WHERE email = ?`, [newPassword, email]);
        
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
});

// ✅ **Orders: Place Order**
app.post("/api/place-order", async (req, res) => {
    const { userEmail, items, totalPrice, paymentMethod, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    try {
        const normalizedEmail = normalizeEmail(userEmail);
        const date = new Date().toISOString();
        const isPaid = paymentMethod === 'Online' ? 1 : 0;

        await run(`INSERT INTO orders (userEmail, items, totalPrice, paymentMethod, orderDate, status, razorpayOrderId, razorpayPaymentId, razorpaySignature, isPaid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [normalizedEmail, JSON.stringify(items), totalPrice, paymentMethod, date, 'pending', razorpayOrderId || null, razorpayPaymentId || null, razorpaySignature || null, isPaid]);

        const result = await query("SELECT last_insert_rowid() as id");
        const orderId = result[0].id;

        // ✅ Clear user's cart after order is placed
        await run(`UPDATE users SET cart = '[]' WHERE email = ?`, [normalizedEmail]);

        // ✅ Send order confirmation email
        try {
            const orderDetails = {
                id: orderId,
                orderDate: date,
                paymentMethod: paymentMethod,
                items: items,
                totalPrice: totalPrice,
                deliveryAddress: 'Your registered address' // Default if not provided
            };
            emailService.sendOrderConfirmationEmail(userEmail, orderDetails);
        } catch (mailError) {
            console.error("Failed to send order confirmation email:", mailError);
        }

        // ✅ Notify individual farmers
        try {
            const sellers = {};
            
            // Enrich missing seller emails by querying databases
            const categories = await query(`SELECT name FROM categories`);
            for (const item of items) {
                if (!item.sellerEmail) {
                    for (const cat of categories) {
                        try {
                            const pRows = await query(`SELECT sellerEmail FROM ${cat.name} WHERE name = ? AND sellerEmail IS NOT NULL`, [item.name]);
                            if (pRows.length > 0 && pRows[0].sellerEmail) {
                                item.sellerEmail = pRows[0].sellerEmail;
                                break;
                            }
                        } catch (e) {} // table might not exist
                    }
                }
                
                const seller = item.sellerEmail || 'admin@agrodirect.com';
                if (!sellers[seller]) sellers[seller] = [];
                sellers[seller].push(item);
            }
            
            for (const [sellerEmail, farmerItems] of Object.entries(sellers)) {
                await emailService.sendNewOrderNotificationToFarmer(sellerEmail, orderId, farmerItems);
            }
        } catch (err) {
            console.error("Error notifying farmers:", err);
        }

        res.json({ success: true, message: "Order placed successfully", order: { _id: orderId } });
    } catch (error) {
        console.error("Order Placement Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Orders: Alias for frontend compatibility**
app.post("/api/orders", authenticate, async (req, res) => {
    try {
        // Forward to the main place-order logic with authenticated user info
        const { totalAmount, paymentMethod, items } = req.body;
        
        if (!req.user) throw new Error("User not authenticated correctly");
        const userEmail = req.user.email;
        
        req.body.userEmail = userEmail;
        req.body.totalPrice = totalAmount;
        req.body.items = items || [];
        
        const date = new Date().toISOString();
        const isPaid = (paymentMethod && paymentMethod.includes('Online')) ? 1 : 0;

        const result = await run(`INSERT INTO orders (userEmail, items, totalPrice, paymentMethod, orderDate, status, isPaid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userEmail, JSON.stringify(req.body.items), totalAmount, paymentMethod, date, 'pending', isPaid]);

        const orderId = result.lastID;

        // Clear cart
        await run(`UPDATE users SET cart = '[]' WHERE id = ?`, [req.user.id]);

        // ✅ Send order confirmation email
        try {
            const orderDetails = {
                id: orderId,
                orderDate: date,
                paymentMethod: paymentMethod,
                items: items,
                totalPrice: totalAmount,
                deliveryAddress: 'Your registered address' // Default if not provided
            };
            emailService.sendOrderConfirmationEmail(userEmail, orderDetails);
        } catch (mailError) {
            console.error("Failed to send order confirmation email:", mailError);
        }

        // ✅ Notify individual farmers
        try {
            const sellers = {};
            
            // Enrich missing seller emails by querying databases
            const categories = await query(`SELECT name FROM categories`);
            for (const item of items) {
                if (!item.sellerEmail) {
                    for (const cat of categories) {
                        try {
                            const pRows = await query(`SELECT sellerEmail FROM ${cat.name} WHERE name = ? AND sellerEmail IS NOT NULL`, [item.name]);
                            if (pRows.length > 0 && pRows[0].sellerEmail) {
                                item.sellerEmail = pRows[0].sellerEmail;
                                break;
                            }
                        } catch (e) {} // table might not exist
                    }
                }
                
                const seller = item.sellerEmail || 'admin@agrodirect.com';
                if (!sellers[seller]) sellers[seller] = [];
                sellers[seller].push(item);
            }

            for (const [sellerEmail, farmerItems] of Object.entries(sellers)) {
                await emailService.sendNewOrderNotificationToFarmer(sellerEmail, orderId, farmerItems);
            }
        } catch (err) {
            console.error("Error notifying farmers:", err);
        }

        res.json({ success: true, message: "Order placed successfully", order: { _id: orderId } });
    } catch (error) {
        console.error("CRITICAL Order Placement Error:", error);
        
        // Write to a temporary log file we can read
        try {
            const fs = require('fs');
            const errorLog = `[${new Date().toISOString()}] ORDER ERROR: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\n\n`;
            fs.appendFileSync(path.join(__dirname, 'order_errors.log'), errorLog);
        } catch (e) {
            console.error("Failed to write to error log:", e);
        }

        res.status(500).json({ 
            success: false, 
            message: "Failed to place order on server", 
            error: error.message
        });
    }
});

// ✅ **Razorpay: Create Order**
app.post("/api/create-razorpay-order", async (req, res) => {
    const { amount, currency } = req.body;
    try {
        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ **Razorpay: Verify Payment**
app.post("/api/verify-payment", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
        .update(body.toString())
        .digest("hex");

    if (expectedSignature === razorpay_signature) {
        res.json({ success: true, message: "Payment verified successfully" });
    } else {
        console.error("Razorpay Signature Mismatch");
        res.status(400).json({ success: false, message: "Invalid signature" });
    }
});

// ✅ **Orders: Get Orders (for Farmer/Admin)**
app.get("/api/orders", async (req, res) => {
    const { sellerEmail } = req.query;
    try {
        const rows = await query(`
            SELECT o.*, u.name as userName, u.address as userAddress
            FROM orders o 
            LEFT JOIN users u ON o.userEmail = u.email 
            ORDER BY o.orderDate DESC
        `);

        let orders = rows.map(order => {
            let parsedItems = [];
            try {
                parsedItems = JSON.parse(order.items);
            } catch (e) {
                console.error("Error parsing items for order:", order.id);
            }

            let userAddr = { addressLine1: 'No address provided', city: '', phone: 'N/A' };
            try {
                if (order.userAddress) {
                    const parsedAddr = JSON.parse(order.userAddress);
                    userAddr = { ...userAddr, ...parsedAddr };
                }
            } catch (e) {
                console.error("Error parsing user address for order:", order.id);
            }

            return {
                ...order,
                _id: order.id.toString(),
                items: parsedItems,
                totalAmount: order.totalPrice,
                orderStatus: order.status || 'pending',
                userId: {
                    name: order.userName || 'Guest User',
                    address: userAddr
                }
            };
        });

        // Filter by seller if requested
        if (sellerEmail) {
            // Get all category tables to look up product ownership for legacy orders without sellerEmail
            const categories = await query(`SELECT name FROM categories`);

            // Enrich items: for items missing sellerEmail, look up from product tables
            const enrichedOrders = [];
            for (const order of orders) {
                const enrichedItems = [];
                for (const item of order.items) {
                    if (item.sellerEmail) {
                        enrichedItems.push(item);
                    } else {
                        // Try to find sellerEmail from product tables
                        let foundSellerEmail = null;
                        for (const cat of categories) {
                            try {
                                const productRows = await query(
                                    `SELECT sellerEmail FROM ${cat.name} WHERE name = ? AND sellerEmail IS NOT NULL`,
                                    [item.name]
                                );
                                if (productRows.length > 0 && productRows[0].sellerEmail) {
                                    foundSellerEmail = productRows[0].sellerEmail;
                                    break;
                                }
                            } catch (e) { /* table may not exist, skip */ }
                        }
                        enrichedItems.push({ ...item, sellerEmail: foundSellerEmail || 'admin@agrodirect.com' });
                    }
                }
                enrichedOrders.push({ ...order, items: enrichedItems });
            }

            orders = enrichedOrders.filter(order => {
                const sellerItems = order.items.filter(item => item.sellerEmail === sellerEmail);
                if (sellerItems.length > 0) {
                    order.items = sellerItems;
                    order.totalAmount = sellerItems.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);
                    return true;
                }
                return false;
            });
        }

        res.json({ orders });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Orders: Cancel Order**
app.post("/api/orders/:id/cancel", authenticate, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userEmail = normalizeEmail(req.user.email); // From JWT, normalized

        const orders = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            return res.status(404).json({ error: `Order #${orderId} does not exist.` });
        }

        const order = orders[0];
        // Allow user who placed the order or admin to cancel
        const orderEmail = normalizeEmail(order.userEmail);
        if (orderEmail !== userEmail && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'You are not authorized to cancel this order.' });
        }

        const currentStatus = (order.status || 'pending').toLowerCase();
        if (currentStatus === 'shipped' || currentStatus === 'delivered' || currentStatus === 'cancelled') {
            return res.status(400).json({ error: 'This order can no longer be cancelled.' });
        }

        const result = await run('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
        if (result.changes === 0) {
            return res.status(500).json({ error: 'Failed to cancel order' });
        }

        res.json({ success: true, message: 'Order cancelled successfully', orderId, status: 'cancelled' });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// ✅ **Orders: Get User Orders**
app.get("/api/orders/user", authenticate, async (req, res) => {
    const email = req.user.email;

    try {
        const rows = await query(`
            SELECT * FROM orders 
            WHERE userEmail = ? 
            ORDER BY orderDate DESC
        `, [email]);

        const orders = rows.map(order => {
            let parsedItems = [];
            try {
                parsedItems = JSON.parse(order.items);
            } catch (e) {
                console.error("Error parsing items for order:", order.id);
            }

            return {
                ...order,
                _id: order.id.toString(),
                items: parsedItems,
                totalPrice: order.totalPrice,
                status: order.status || 'pending',
                createdAt: order.orderDate
            };
        });

        res.json(orders);
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Orders: Update Status**
app.patch("/api/orders/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id]);
        
        // Notify Consumer
        try {
            const orderRows = await query(`SELECT userEmail FROM orders WHERE id = ?`, [id]);
            if (orderRows.length > 0 && orderRows[0].userEmail) {
                await emailService.sendOrderStatusUpdateEmail(orderRows[0].userEmail, id, status);
            }
        } catch (err) {
            console.error("Failed to send order status updated email:", err);
        }

        res.json({ success: true, message: "Order status updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ✅ **New Realistic Review System**

// GET reviews with filtering support (by product, category, or seller)
app.get("/api/reviews", async (req, res) => {
    const { productName, category, sellerEmail } = req.query;
    let sql = `SELECT * FROM reviews WHERE 1=1`;
    const params = [];

    if (productName) {
        sql += ` AND productName = ?`;
        params.push(productName);
    }
    if (category) {
        sql += ` AND category = ?`;
        params.push(category);
    }
    if (sellerEmail) {
        sql += ` AND sellerEmail = ?`;
        params.push(sellerEmail);
    }

    sql += ` ORDER BY date DESC`;

    try {
        const rows = await query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST a new review for a product
app.post("/api/reviews", async (req, res) => {
    const { productName, category, sellerEmail, userName, userEmail, rating, comment } = req.body;
    
    if (!productName || !category || !rating) {
        return res.status(400).json({ error: "Missing required fields (productName, category, rating)" });
    }

    try {
        const date = new Date().toISOString();
        await run(
            `INSERT INTO reviews (productName, category, sellerEmail, userName, userEmail, rating, comment, date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [productName, category, sellerEmail || 'admin@agrodirect.com', userName || 'Anonymous', userEmail || 'N/A', rating, comment || '', date]
        );
        res.json({ success: true, message: "Review submitted successfully!" });
    } catch (error) {
        console.error("Review Submission Error:", error);
        res.status(500).json({ error: "Failed to submit review." });
    }
});

// ✅ **Reviews: DELETE a review (Admin moderation)**
app.delete("/api/reviews/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await run(`DELETE FROM reviews WHERE id = ?`, [id]);
        res.json({ success: true, message: "Review deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Legacy Feedback: GET All**
app.get("/api/feedback", async (req, res) => {
    try {
        const rows = await query(`SELECT * FROM feedback ORDER BY date DESC`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Legacy Feedback: Submit**
app.post("/api/feedback", async (req, res) => {
    const { userEmail, userName, rating, title, comment } = req.body;
    try {
        const date = new Date().toISOString();
        await run(`INSERT INTO feedback (userEmail, userName, rating, title, comment, date) VALUES (?, ?, ?, ?, ?, ?)`,
            [userEmail, userName || 'Anonymous', rating, title || '', comment, date]);
        res.json({ success: true, message: "Feedback submitted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Contact Messages: Get All**
app.get("/api/contact-messages", async (req, res) => {
    try {
        const rows = await query(`SELECT * FROM contact_messages ORDER BY date DESC`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Contact Messages: Submit**
app.post("/api/contact-messages", async (req, res) => {
    const { userEmail, userName, phone, subject, message } = req.body;
    try {
        const date = new Date().toISOString();
        await run(`INSERT INTO contact_messages (userEmail, userName, phone, subject, message, date) VALUES (?, ?, ?, ?, ?, ?)`,
            [userEmail, userName || 'Guest', phone || '', subject || '', message || '', date]);
        res.json({ success: true, message: "Message submitted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Contact Messages: Delete**
app.delete("/api/contact-messages/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await run(`DELETE FROM contact_messages WHERE id = ?`, [id]);
        res.json({ success: true, message: "Message deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Contact Messages: Reply**
app.post("/api/contact-messages/:id/reply", async (req, res) => {
    const { id } = req.params;
    const { adminReply } = req.body;
    try {
        const replyDate = new Date().toISOString();
        await run(`UPDATE contact_messages SET adminReply = ?, replyDate = ?, isReplied = 1 WHERE id = ?`,
            [adminReply, replyDate, id]);
        res.json({ success: true, message: "Reply sent successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ✅ **Admin: Get All Users**
app.get("/api/users", async (req, res) => {
    try {
        const users = await query("SELECT id, name, email, role FROM users");
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Products: Get Products by Category**
app.get("/api/products", async (req, res) => {
    const { category } = req.query;
    if (!category) return res.status(400).json({ error: "Category is required" });

    const tableName = category.toLowerCase().replace(/\s+/g, '');
    
    try {
        // Check if table exists
        const rows = await query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
        if (rows.length === 0) return res.json([]);

        const products = await query(`SELECT * FROM ${tableName}`);
        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Cart: Get Cart**
app.get('/api/cart', authenticate, async (req, res) => {
    try {
        const rows = await query(`SELECT cart FROM users WHERE id = ?`, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        let cart = [];
        try { cart = rows[0].cart ? JSON.parse(rows[0].cart) : []; } catch (e) { cart = []; }
        res.json({ cart });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Cart: Add to Cart**
app.post('/api/cart/add', authenticate, async (req, res) => {
    try {
        const rows = await query(`SELECT cart FROM users WHERE id = ?`, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        let cart = [];
        try { cart = rows[0].cart ? JSON.parse(rows[0].cart) : []; } catch (e) { cart = []; }
        
        const { name, price, quantity, unit, type, img, sellerEmail } = req.body;
        const parsedPrice = parseFloat(price);
        const parsedQuantity = unit === 'sapling' ? parseInt(quantity) : parseFloat(quantity);

        const existingItemIndex = cart.findIndex(item => item.name === name && item.unit === unit && item.type === type);
        if (existingItemIndex >= 0) {
            cart[existingItemIndex].quantity += parsedQuantity;
            // Optionally update image or seller if missing
            if (!cart[existingItemIndex].img) cart[existingItemIndex].img = img;
            if (!cart[existingItemIndex].sellerEmail) cart[existingItemIndex].sellerEmail = sellerEmail;
        } else {
            cart.push({ 
                name, 
                price: parsedPrice, 
                quantity: parsedQuantity, 
                unit, 
                type, 
                img: img || '',
                sellerEmail: sellerEmail || 'admin@agrodirect.com',
                _id: Date.now().toString() 
            }); // Add _id for frontend removal
        }

        await run(`UPDATE users SET cart = ? WHERE id = ?`, [JSON.stringify(cart), req.user.id]);
        res.json({ success: true, cart, message: 'Item added to cart successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Cart: Update Quantity**
app.put('/api/cart/update', authenticate, async (req, res) => {
    try {
        const rows = await query(`SELECT cart FROM users WHERE id = ?`, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        let cart = [];
        try { cart = rows[0].cart ? JSON.parse(rows[0].cart) : []; } catch (e) { cart = []; }
        
        const { itemId, newQuantity } = req.body;
        const item = cart.find(i => i._id == itemId);
        if (!item) return res.status(404).json({ error: 'Item not found in cart' });
        
        item.quantity = newQuantity;
        await run(`UPDATE users SET cart = ? WHERE id = ?`, [JSON.stringify(cart), req.user.id]);
        res.json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Cart: Remove Item**
app.delete('/api/cart/remove', authenticate, async (req, res) => {
    try {
        const rows = await query(`SELECT cart FROM users WHERE id = ?`, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        let cart = [];
        try { cart = rows[0].cart ? JSON.parse(rows[0].cart) : []; } catch (e) { cart = []; }
        
        const { itemId } = req.body;
        cart = cart.filter(i => i._id && i._id.toString() !== itemId.toString());
        
        await run(`UPDATE users SET cart = ? WHERE id = ?`, [JSON.stringify(cart), req.user.id]);
        res.json({ success: true, message: 'Item removed', cart });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **User: Get Profile**
app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const rows = await query(`SELECT id, email, name, role, cart, address FROM users WHERE id = ?`, [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **User: Update Profile (Name & Email)**
app.put('/api/user/profile', authenticate, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        if (email && email !== req.user.email) {
            // Check if new email is already taken
            const rows = await query(`SELECT email FROM users WHERE email = ?`, [email]);
            if (rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

            const oldEmail = req.user.email;
            await run(`UPDATE users SET name = ?, email = ? WHERE id = ?`, [name, email, req.user.id]);

            // Cascade update email across all tables where it's used
            const categories = await query(`SELECT name FROM categories`);
            for (const cat of categories) {
                const tableName = cat.name.toLowerCase().replace(/\s+/g, '');
                try {
                    await run(`UPDATE ${tableName} SET sellerEmail = ? WHERE sellerEmail = ?`, [email, oldEmail]);
                } catch (e) {}
            }
            await run(`UPDATE reviews SET sellerEmail = ? WHERE sellerEmail = ?`, [email, oldEmail]);
            await run(`UPDATE reviews SET userEmail = ? WHERE userEmail = ?`, [email, oldEmail]);
            await run(`UPDATE orders SET userEmail = ? WHERE userEmail = ?`, [email, oldEmail]);
            await run(`UPDATE feedback SET userEmail = ? WHERE userEmail = ?`, [email, oldEmail]);

            // Generate a new token with updated email
            const newToken = jwt.sign({ id: req.user.id, email: email, role: req.user.role }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({ success: true, message: 'Profile updated successfully', token: newToken });
        } else {
            await run(`UPDATE users SET name = ? WHERE id = ?`, [name, req.user.id]);
            return res.json({ success: true, message: 'Profile updated successfully' });
        }
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ✅ **User: Save Address**
app.post('/api/user/address', authenticate, async (req, res) => {
    try {
        await run(`UPDATE users SET address = ? WHERE id = ?`, [JSON.stringify(req.body), req.user.id]);
        res.json({ success: true, message: 'Address saved successfully', address: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Get Customization Settings**
app.get("/api/settings", async (req, res) => {
    try {
        const rows = await query(`SELECT key, value FROM settings`);
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Save Customization Settings**
app.post("/admin/save-settings", async (req, res) => {
    const settings = req.body;
    try {
        for (const [key, value] of Object.entries(settings)) {
            await run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
        }
        res.json({ success: true, message: "Settings saved successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ **Admin: Upload Background Image**
app.post("/admin/upload-bg", uploadBg.single('background'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const { key } = req.body; // e.g., 'loginBg' or 'websiteBg'
    const imageUrl = `/uploads/backgrounds/${req.file.filename}`;

    try {
        await run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, imageUrl]);
        res.json({ success: true, imageUrl, message: "Background uploaded successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Google Cloud TTS endpoint
app.post('/api/tts', async (req, res) => {
    try {
        const { text, lang } = req.body || {};
        console.log('[TTS] request', { text, lang });
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Request must include text.' });
        }

        const languageCode = lang ? lang.toLowerCase().replace('_', '-') : 'en-US';
        const voiceName = getGoogleTtsVoice(languageCode);
        console.log('[TTS] using voice', voiceName, 'languageCode', languageCode);

        // If Google credentials not available, use development fallback
        if (!hasGoogleCredentials || !ttsClient) {
            console.log('[TTS] Using development fallback audio (Google credentials not configured)');
            const audioContent = await generateDevelopmentAudio();
            return res.json({ audioContent });
        }

        const request = {
            input: { text },
            voice: {
                languageCode,
                name: voiceName,
                ssmlGender: 'FEMALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 0.95,
                pitch: 1.05
            }
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        if (!response || !response.audioContent) {
            return res.status(500).json({ error: 'Google TTS failed to return audio content.' });
        }

        console.log('[TTS] Successfully synthesized speech using Google Cloud TTS');
        return res.json({ audioContent: response.audioContent });
    } catch (err) {
        console.error('[TTS] Error synthesizing speech:', err.message);
        // Provide development fallback even on error
        if (!hasGoogleCredentials) {
            try {
                const audioContent = await generateDevelopmentAudio();
                return res.json({ audioContent });
            } catch (fallbackErr) {
                return res.status(500).json({ error: 'Failed to generate audio fallback.' });
            }
        }
        return res.status(500).json({ error: 'Failed to synthesize speech.' });
    }
});

// 404 Handler with CSP
app.use((req, res) => {
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, "../index.html"));
    } else {
        res.status(404)
            .set("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src * data: blob:;")
            .json({
                success: false,
                error: "Not Found",
                message: `Resource '${req.url}' not found.`
            });
    }
});

// ✅ Global Error Handler (500)
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[CRITICAL ERROR] ${timestamp}:`, err.stack);

    // Prefer JSON for API/Admin requests or if explicitly requested
    const isApiRequest = req.url.startsWith('/api/') || req.url.startsWith('/admin/');
    const acceptsHtml = req.accepts('html') && !isApiRequest;

    if (acceptsHtml && !req.headers['accept']?.includes('application/json')) {
        // Serve the premium 500 error page for browser navigation
        const errorPagePath = path.join(__dirname, "../500.html");
        try {
            res.status(500).sendFile(errorPagePath);
        } catch (fileErr) {
            res.status(500).json({ success: false, error: "Internal Server Error", details: err.message });
        }
    } else {
        // Return JSON error for API requests and fetch calls
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: err.message,
            path: req.url,
            timestamp: timestamp
        });
    }
});

