
const SECRET_KEY = process.env.JWT_SECRET || 'SECRET_KEY';
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./db');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

// Initialize Express app
const app = express();
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = [
  path.join(__dirname, '../uploads'),
  path.join(__dirname, '../uploads/product_images'),
  path.join(__dirname, '../uploads/certificates')
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for local development to avoid blocking devtools
}));
app.use(morgan('dev'));
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'AgroDirect API is running successfully on port ' + PORT });
});

// Connect to SQLite
const db = connectDB();

// Serve static files from uploads directory
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Multer setup for product image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(uploadsPath, 'product_images');
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage: storage });

// Multer setup for certificate uploads
const certStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(uploadsPath, 'certificates');
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cert-' + uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const uploadCert = multer({ storage: certStorage });

// Remove farmer by ID (admin only)
app.delete('/admin/remove-farmer/:id', async (req, res) => {
  try {
    // Check for admin token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can remove farmers' });
    }
    const farmerId = req.params.id;
    // Check if user exists and is a farmer
    db.get('SELECT * FROM users WHERE id = ? AND role = ?', [farmerId, 'farmer'], (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error', details: err.message });
      if (!user) return res.status(404).json({ error: 'Farmer not found' });
      // Delete the farmer
      db.run('DELETE FROM users WHERE id = ?', [farmerId], function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: 'Failed to delete farmer', details: deleteErr.message });
        res.json({ success: true, message: 'Farmer removed successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve admin dashboard at /admindashboard
app.get('/admindashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/adminpanel/padmin.html'));
});

// Password recovery route
app.post('/api/recover', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  // Replace with real DB lookup
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return resolve(null);
      resolve(row);
    });
  });
  if (!user) {
    // For security, do not reveal if user exists
    return res.json({ message: 'If this email exists, a reset link has been sent.' });
  }
  // Generate reset token (expires in 15 min)
  const resetToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '15m' });
  // In production: send email with this link
  console.log(`Password reset link: http://localhost:5003/reset/${resetToken}`);
  res.json({ message: 'If this email exists, a reset link has been sent.' });
});

// Password reset route
app.post('/api/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ message: 'New password required' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const email = decoded.email;
    // Replace with real DB update
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
});

// Table creation (run once, or check if exists)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    isVerified INTEGER DEFAULT 0,
    certificate TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    cart TEXT,
    address TEXT,
    orders TEXT
  )`);
  // Ensure new columns exist for existing databases
  db.run(`ALTER TABLE users ADD COLUMN isVerified INTEGER DEFAULT 0`, (err) => { /* ignore if already exists */ });
  db.run(`ALTER TABLE users ADD COLUMN certificate TEXT`, (err) => { /* ignore if already exists */ });
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    items TEXT,
    totalAmount REAL,
    deliveryAddress TEXT,
    paymentMethod TEXT,
    orderStatus TEXT DEFAULT 'pending',
    orderDate TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  // Fruits table with farmerId referencing users
  db.run(`CREATE TABLE IF NOT EXISTS fruits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    img TEXT,
    desc TEXT,
    stock INTEGER DEFAULT 0,
    farmerId INTEGER NOT NULL,
    FOREIGN KEY(farmerId) REFERENCES users(id)
  )`);
});


// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Routes
// Add a review for a product (supports all product types)
app.post('/api/reviews', async (req, res) => {
  const { productId, productType, rating, feedback, language } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const userId = decoded.id;
  if (!productId || !productType || !rating) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const lang = language || 'en';
  db.run(
    `INSERT INTO reviews (productId, productType, userId, rating, feedback, language) VALUES (?, ?, ?, ?, ?, ?)` ,
    [productId, productType, userId, rating, feedback, lang],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ success: true, reviewId: this.lastID });
    }
  );
});

// Get all reviews for a product (by productId and productType)
app.get('/api/reviews/:productType/:productId', async (req, res) => {
  const { productType, productId } = req.params;
  const lang = req.query.language || null;
  let query = `SELECT r.*, u.name as reviewerName FROM reviews r JOIN users u ON r.userId = u.id WHERE r.productId = ? AND r.productType = ?`;
  let params = [productId, productType];
  if (lang) {
    query += ' AND r.language = ?';
    params.push(lang);
  }
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Signup endpoint - handles both JSON and Multipart/Form-Data for file uploads
app.post('/api/signup', uploadCert.single('certificate'), async (req, res) => {
  const { email, phone, name, password, role } = req.body;
  const certificateFile = req.file ? `/uploads/certificates/${req.file.filename}` : null;
  
  try {
    // Check if user exists
    const table = role === 'admin' ? 'admins' : 'users';
    db.get(`SELECT * FROM ${table} WHERE email = ?`, [email], async (err, exists) => {
      if (err) return res.status(500).json({ error: err.message });
      if (exists) return res.status(400).json({ error: 'Email already registered' });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Insert user/admin
      if (table === 'users') {
        db.run(
          `INSERT INTO users (email, phone, name, password, role, certificate, isVerified) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [email, phone, name, hashedPassword, role, certificateFile, 0], // Farmers default to unverified
          function (insertErr) {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            const id = this.lastID;
            const token = generateToken(id, role);
            res.status(201).json({
              _id: id,
              name,
              email,
              phone,
              role,
              token
            });
          }
        );
      } else {
        db.run(
          `INSERT INTO admins (email, name, password, role) VALUES (?, ?, ?, ?)`,
          [email, name, hashedPassword, role],
          function (insertErr) {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            const id = this.lastID;
            const token = generateToken(id, role);
            res.status(201).json({
              _id: id,
              name,
              email,
              role,
              token
            });
          }
        );
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    console.log(`[LOGIN ATTEMPT] Email: ${email}, Role: ${role}`);
    const table = role === 'admin' ? 'admins' : 'users';
    db.get(`SELECT * FROM ${table} WHERE email = ?`, [email], async (err, user) => {
      if (err) {
        console.error(`[LOGIN ERROR] DB error for email ${email}:`, err);
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        console.warn(`[LOGIN FAIL] No user found for email ${email} in table ${table}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.warn(`[LOGIN FAIL] Invalid password for email ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Enforce role match (except for admin)
      if (role !== 'admin' && user.role !== role) {
        console.warn(`[ROLE MISMATCH] Attempted login with role '${role}' but user has role '${user.role}' for email ${email}`);
        return res.status(403).json({ error: 'Role mismatch. Please use the correct login portal for your account type.' });
      }

      // Generate token
      let fixedRole = user.role;
      if (fixedRole !== 'admin' && fixedRole !== 'farmer') {
        fixedRole = 'consumer';
      }
      const token = generateToken(user.id, fixedRole);
      console.log(`[LOGIN SUCCESS] Email: ${email}, Role: ${fixedRole}`);
      res.json({
        user: {
          id: user.id,
          _id: user.id,
          name: user.name,
          email: user.email,
          role: fixedRole
        },
        token
      });
    });
  } catch (error) {
    console.error(`[LOGIN ERROR] Exception for email ${email}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Protected route example
app.get('/api/protected', async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user based on role
    let Model = decoded.role === 'admin' ? Admin : User;
    const user = await Model.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const table = decoded.role === 'admin' ? 'admins' : 'users';
    db.get(`SELECT id, email, name, role, createdAt, cart, address, orders FROM ${table} WHERE id = ?`, [decoded.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      // Remove password from response
      delete user.password;
      res.json(user);
    });
  } catch (error) {
    res.status(401).json({ error: 'Not authorized' });
  }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const table = decoded.role === 'admin' ? 'admins' : 'users';
    const fields = Object.keys(req.body).filter(key => key !== 'password');
    const values = fields.map(key => req.body[key]);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    db.run(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      [...values, decoded.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(`SELECT id, email, name, role, createdAt, cart, address, orders FROM ${table} WHERE id = ?`, [decoded.id], (err2, user) => {
          if (err2 || !user) return res.status(404).json({ error: 'User not found' });
          delete user.password;
          res.json(user);
        });
      }
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/user/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const table = decoded.role === 'admin' ? 'admins' : 'users';
    db.get(`SELECT * FROM ${table} WHERE id = ?`, [decoded.id], async (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });

      // Verify current password
      const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.newPassword, salt);

      db.run(`UPDATE ${table} SET password = ? WHERE id = ?`, [hashedPassword, decoded.id], function (updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Cancel Order
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const orderId = req.params.id;

    db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
      if (err) return res.status(500).json({ error: 'Failed to load order' });
      if (!order) return res.status(404).json({ error: `Order #${orderId} does not exist.` });
      
      if (String(order.userId) !== String(decoded.id)) {
        return res.status(403).json({ error: 'You are not authorized to cancel this order.' });
      }

      const currentStatus = (order.orderStatus || 'pending').toLowerCase();
      if (currentStatus === 'shipped' || currentStatus === 'delivered' || currentStatus === 'cancelled') {
        return res.status(400).json({ error: 'This order can no longer be cancelled.' });
      }

      db.run('UPDATE orders SET orderStatus = ? WHERE id = ?', ['cancelled', orderId], function (updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to cancel order' });
        res.json({ success: true, message: 'Order cancelled successfully', orderId, status: 'cancelled' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});
// Start server
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Add this to your server.js routes
app.post('/api/validate-session', async (req, res) => {
  try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ valid: false });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const Model = decoded.role === 'admin' ? Admin : User;
      const user = await Model.findById(decoded.id).select('-password');
      
      if (!user) return res.status(401).json({ valid: false });
      
      res.json({ valid: true, user });
  } catch (error) {
      res.status(401).json({ valid: false });
  }
});

app.post('/api/logout', async (req, res) => {
  // In a real app, you might want to blacklist the token
  res.json({ success: true });
});

app.get('/api/cart', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.get('SELECT cart FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      let cart = [];
      try { cart = user.cart ? JSON.parse(user.cart) : []; } catch (e) { cart = []; }
      res.json({ cart });
    });
  } catch (err) {
    res.status(401).json({ error: 'Token invalid' });
  }
});

app.post('/api/cart/add', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    // Fetch user from SQLite
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let cart = [];
      try {
        cart = user.cart ? JSON.parse(user.cart) : [];
      } catch (e) {
        cart = [];
      }

      const { name, price, quantity, unit, type } = req.body;

      // Validate input more thoroughly
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid product name' });
      }
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }
      if (!['kg', 'g', 'packet', 'sapling', '250ml', '500ml', '1ltr'].includes(unit)) {
        return res.status(400).json({ error: 'Invalid unit' });
      }

      // Convert to proper types
      const parsedPrice = parseFloat(price);
      const parsedQuantity = unit === 'sapling' ? parseInt(quantity) : parseFloat(quantity);

      // Check for existing item
      const existingItemIndex = cart.findIndex(item => 
        item.name === name && item.unit === unit && item.type === type
      );

      if (existingItemIndex >= 0) {
        // Update existing item
        cart[existingItemIndex].quantity += parsedQuantity;
      } else {
        // Add new item
        cart.push({
          name,
          price: parsedPrice,
          quantity: parsedQuantity,
          unit,
          type
        });
      }

      // Save cart back to SQLite
      db.run('UPDATE users SET cart = ? WHERE id = ?', [JSON.stringify(cart), userId], function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Database operation failed', details: updateErr.message });
        }
        return res.json({ success: true, cart, message: 'Item added to cart successfully' });
      });
    });
  } catch (err) {
    console.error('Cart add endpoint error:', err);
    return res.status(500).json({ 
      error: 'Failed to update cart',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.put('/api/cart/update', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.get('SELECT cart FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      let cart = [];
      try { cart = user.cart ? JSON.parse(user.cart) : []; } catch (e) { cart = []; }
      const { itemId, newQuantity } = req.body;
      const item = cart.find(item => item._id == itemId);
      if (!item) return res.status(404).json({ error: 'Item not found in cart' });
      item.quantity = newQuantity;
      db.run('UPDATE users SET cart = ? WHERE id = ?', [JSON.stringify(cart), decoded.id], function (updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Failed to update cart' });
        res.json({ success: true, cart });
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Generate reset token
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists (search both User and Admin models)
    let user = await User.findOne({ email });
    let model = 'User';
    
    if (!user) {
      user = await Admin.findOne({ email });
      model = 'Admin';
      if (!user) {
        return res.status(404).json({ error: 'Email not found' });
      }
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}&model=${model}`;

    // Send email
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_FROM,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset for your FarmConnect account.</p>
        <p>Click this link to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Reset link sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { token, model, newPassword } = req.body;

  try {
    // Find user by token
    let Model = model === 'Admin' ? Admin : User;
    const user = await Model.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/remove', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.get('SELECT cart FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      let cart = [];
      try { cart = user.cart ? JSON.parse(user.cart) : []; } catch (e) { cart = []; }
      const { itemId } = req.body;
      if (!itemId) return res.status(400).json({ error: 'No item ID provided' });
      const itemIdStr = itemId.toString();
      const initialCartLength = cart.length;
      cart = cart.filter(item => item._id && item._id.toString() !== itemIdStr);
      if (cart.length === initialCartLength) {
        return res.status(404).json({ error: 'Item not found in cart' });
      }
      db.run('UPDATE users SET cart = ? WHERE id = ?', [JSON.stringify(cart), decoded.id], function (updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Server error while removing item' });
        res.json({ success: true, message: 'Item removed from cart', cart });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error while removing item' });
  }
});

// Save Delivery Address
app.post('/api/user/address', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const addressLine1 = String(req.body.addressLine1 || '').trim();
    const city = String(req.body.city || '').trim();
    const state = String(req.body.state || '').trim();
    const addressLine1Pattern = /^[A-Za-z0-9][A-Za-z0-9\s,#./-]*$/;
    const cityStatePattern = /^[A-Za-z\s]+$/;

    if (!addressLine1Pattern.test(addressLine1)) {
      return res.status(400).json({ error: 'Address Line 1 must include letters or numbers and may contain spaces or common punctuation.' });
    }

    if (!cityStatePattern.test(city)) {
      return res.status(400).json({ error: 'City must contain letters and spaces only.' });
    }

    if (!cityStatePattern.test(state)) {
      return res.status(400).json({ error: 'State must contain letters and spaces only.' });
    }

    const addressPayload = {
      ...req.body,
      addressLine1,
      city,
      state
    };

    db.run('UPDATE users SET address = ? WHERE id = ?', [JSON.stringify(addressPayload), decoded.id], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to save address' });
      res.json({ success: true, message: 'Address saved successfully', address: addressPayload });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save address' });
  }
});
// 
// Import Order model
// ...existing code...
app.post('/api/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.get('SELECT * FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      let cart = [];
      try { cart = user.cart ? JSON.parse(user.cart) : []; } catch (e) { cart = []; }
      if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }
      const items = cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit || null,
        type: item.type || 'product'
      }));
      const totalAmount = req.body.totalAmount;
      const paymentMethod = req.body.paymentMethod;
      const deliveryAddress = user.address;
      db.run(
        'INSERT INTO orders (userId, items, totalAmount, deliveryAddress, paymentMethod) VALUES (?, ?, ?, ?, ?)',
        [user.id, JSON.stringify(items), totalAmount, deliveryAddress, paymentMethod],
        function (orderErr) {
          if (orderErr) return res.status(500).json({ error: 'Failed to place order', details: orderErr.message });
          // Add to user's order history (optional: update orders column)
          // Clear cart
          db.run('UPDATE users SET cart = ? WHERE id = ?', [JSON.stringify([]), user.id], function (clearErr) {
            if (clearErr) return res.status(500).json({ error: 'Failed to clear cart after order' });
            res.status(201).json({ success: true, order: { id: this.lastID, items, totalAmount, paymentMethod }, message: 'Order placed successfully' });
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to place order', details: error.message });
  }
});
// Fetch Order Details by Order ID
// Fetch all orders along with user info
app.get('/api/all-orders', async (req, res) => {
  try {
    db.all('SELECT o.*, u.name as userName, u.address as userAddress FROM orders o LEFT JOIN users u ON o.userId = u.id ORDER BY o.orderDate DESC', [], (err, orders) => {
      if (err) return res.status(500).json({ error: 'Server error fetching orders' });
      // Parse items and userAddress
      orders = orders.map(order => ({
        ...order,
        _id: String(order.id),
        status: order.orderStatus || 'pending',
        totalPrice: order.totalAmount,
        items: JSON.parse(order.items || '[]'),
        userAddress: order.userAddress ? JSON.parse(order.userAddress) : null
      }));
      res.json({ orders });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching orders' });
  }
});

// Get orders of the logged-in user
app.get('/api/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.all('SELECT * FROM orders WHERE userId = ? ORDER BY orderDate DESC', [decoded.id], (err, orders) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch orders' });
      orders = orders.map(order => ({
        ...order,
        _id: String(order.id),
        status: order.orderStatus || 'pending',
        totalPrice: order.totalAmount,
        items: JSON.parse(order.items || '[]')
      }));
      res.json({ orders });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});
