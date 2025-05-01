const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const router = express.Router();

// 🔐 Middleware: Admin authorization
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token error:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// ✅ Add Artist
router.post('/add-artist', authAdmin, async (req, res) => {
  const { name, biography } = req.body;
  if (!name || !biography) {
    return res.status(400).json({ message: 'Name and biography required' });
  }

  try {
    await pool.query('INSERT INTO Artist (Name, Biography) VALUES (?, ?)', [name, biography]);
    res.json({ message: 'Artist added successfully' });
  } catch (err) {
    console.error('Add Artist error:', err.message);
    res.status(500).json({ message: 'Server error while adding artist' });
  }
});

// ✅ Add Album
router.post('/add-album', authAdmin, async (req, res) => {
  const { title, releaseYear, genreId, artistId } = req.body;
  if (!title || !releaseYear || !genreId || !artistId) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    await pool.query(
      'INSERT INTO Album (Title, ReleaseYear, GenreID, ArtistID) VALUES (?, ?, ?, ?)',
      [title, releaseYear, genreId, artistId]
    );
    res.json({ message: 'Album added successfully' });
  } catch (err) {
    console.error('Add Album error:', err.message);
    res.status(500).json({ message: 'Server error while adding album' });
  }
});

// ✅ Add Track
router.post('/add-track', authAdmin, async (req, res) => {
  const { title, duration, filePath, albumId, artistId, genreId } = req.body;
  if (!title || !duration || !filePath || !albumId || !artistId || !genreId) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    await pool.query(
      'INSERT INTO Track (Title, Duration, FilePath, AlbumID, ArtistID, GenreID) VALUES (?, ?, ?, ?, ?, ?)',
      [title, duration, filePath, albumId, artistId, genreId]
    );
    res.json({ message: 'Track added successfully' });
  } catch (err) {
    console.error('Add Track error:', err.message);
    res.status(500).json({ message: 'Server error while adding track' });
  }
});

router.delete('/delete-artist/:id', authAdmin, async (req, res) => {
  await pool.query('DELETE FROM Artist WHERE ArtistID = ?', [req.params.id]);
  res.sendStatus(204);
});

router.delete('/delete-album/:id', authAdmin, async (req, res) => {
  await pool.query('DELETE FROM Album WHERE AlbumID = ?', [req.params.id]);
  res.sendStatus(204);
});

router.delete('/delete-track/:id', authAdmin, async (req, res) => {
  await pool.query('DELETE FROM Track WHERE TrackID = ?', [req.params.id]);
  res.sendStatus(204);
});

module.exports = router;
