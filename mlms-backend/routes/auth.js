const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

// ✅ Only allow specific TLDs
const allowedTLDs = ['.com', '.edu', '.org', '.net'];

// ✅ Email validator and TLD checker
const isValidEmail = (email) => {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  if (!pattern.test(email)) return false;

  const tld = '.' + email.split('.').pop();
  return allowedTLDs.includes(tld.toLowerCase());
};

// =============================
// 🔐 Register Route
// =============================
router.post('/register', async (req, res) => {
  let { name, email, password, role } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // 🔽 Normalize inputs
    name = name.trim();
    email = email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email must be a valid .com, .edu, .org, or .net address' });
    }

    const [existing] = await pool.query('SELECT * FROM User WHERE Email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO User (Name, Email, Password, Role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'user']
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// =============================
// 🔐 Login Route
// =============================
router.post('/login', async (req, res) => {
  let { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // 🔽 Normalize email
    email = email.trim().toLowerCase();

    const [rows] = await pool.query('SELECT * FROM User WHERE Email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.UserID, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.UserID,
        name: user.Name,
        email: user.Email,
        role: user.Role
      }
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
