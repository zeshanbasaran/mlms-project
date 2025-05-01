const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get all artists
router.get('/artists', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Artist');
    res.json(rows);
  } catch (err) {
    console.error('Get artists error:', err.message);
    res.status(500).json({ message: 'Error fetching artists' });
  }
});

// Get all genres
router.get('/genres', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Genre');
    res.json(rows);
  } catch (err) {
    console.error('Get genres error:', err.message);
    res.status(500).json({ message: 'Error fetching genres' });
  }
});

// Get all albums
router.get('/albums', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Album');
    res.json(rows);
  } catch (err) {
    console.error('Get albums error:', err.message);
    res.status(500).json({ message: 'Error fetching albums' });
  }
});

router.get('/tracks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Track');
    res.json(rows);
  } catch (err) {
    console.error('Get tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

module.exports = router;
