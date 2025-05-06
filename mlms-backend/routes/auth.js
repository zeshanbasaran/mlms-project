/**
 * Authentication Router - MLMS (Music Library Management System)
 * ----------------------------------------------------------------
 * Provides routes for user registration and login.
 * Supports email validation, password hashing, and JWT token generation.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

/**
 * Utility: Validates an email address and restricts domain to allowed TLDs
 */
const allowedTLDs = ['.com', '.edu', '.org', '.net'];
function isValidEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  if (!pattern.test(email)) return false;
  const tld = '.' + email.split('.').pop();
  return allowedTLDs.includes(tld.toLowerCase());
}

// ===========================
// User Registration
// ===========================

router.post('/register', async (req, res) => {
  let { name, email, password, role, subscriptionPlan } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email must be a valid .com, .edu, .org, or .net address' });
    }

    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role === 'admin' ? 'admin' : 'regular_user']
    );

    const userId = result.insertId;

    // Auto-create a subscription if the user is not an admin and selected a plan
    if (role !== 'admin' && subscriptionPlan) {
      await pool.query(
        `INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date, is_active)
         VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1)`,
        [userId, subscriptionPlan]
      );
    }

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ===========================
// User Login
// ===========================

router.post('/login', async (req, res) => {
  let { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    email = email.trim().toLowerCase();

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
