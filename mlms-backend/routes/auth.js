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
 * Validates an email address and restricts domain to allowed TLDs
 */
const allowedTLDs = ['.com', '.edu', '.org', '.net'];
const isValidEmail = (email) => {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
  if (!pattern.test(email)) return false;
  const tld = '.' + email.split('.').pop();
  return allowedTLDs.includes(tld.toLowerCase());
};

/* ===========================
   USER REGISTRATION
=========================== */

router.post('/register', async (req, res) => {
  let { name, email, password, role } = req.body;

  try {
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    // Validate email format and TLD
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Email must be a valid .com, .edu, .org, or .net address' });
    }

    // Check if email is already registered
    const [existing] = await pool.query('SELECT * FROM User WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password and insert user
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO User (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'user']
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

/* ===========================
   USER LOGIN
=========================== */

router.post('/login', async (req, res) => {
  let { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    email = email.trim().toLowerCase();

    // Find user by email
    const [rows] = await pool.query('SELECT * FROM User WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];

    // Compare provided password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return token and basic user info
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
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
