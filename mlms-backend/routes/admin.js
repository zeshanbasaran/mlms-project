const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const router = express.Router();
require('dotenv').config();

// 🔐 Middleware: Admin-only JWT auth
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admins only' });
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
  if (!name || !biography) return res.status(400).json({ message: 'Name and biography required' });

  try {
    await pool.query('INSERT INTO Artist (Name, Biography) VALUES (?, ?)', [name, biography]);
    res.json({ message: 'Artist added' });
  } catch (err) {
    console.error('Add artist error:', err.message);
    res.status(500).json({ message: 'Error adding artist' });
  }
});

// ✅ Add Album
router.post('/add-album', authAdmin, async (req, res) => {
  const { title, releaseYear, genreId, artistId } = req.body;
  if (!title || !releaseYear || !genreId || !artistId) return res.status(400).json({ message: 'All fields required' });

  try {
    await pool.query(
      'INSERT INTO Album (Title, ReleaseYear, GenreID, ArtistID) VALUES (?, ?, ?, ?)',
      [title, releaseYear, genreId, artistId]
    );
    res.json({ message: 'Album added' });
  } catch (err) {
    console.error('Add album error:', err.message);
    res.status(500).json({ message: 'Error adding album' });
  }
});

// ✅ Add Track
router.post('/add-track', authAdmin, async (req, res) => {
  const { title, duration, filePath = '', albumId, artistId, genreId } = req.body;
  if (!title || !duration || !albumId || !artistId || !genreId) {
    return res.status(400).json({ message: 'All fields except filePath are required' });
  }

  try {
    await pool.query(
      'INSERT INTO Track (Title, Duration, FilePath, AlbumID, ArtistID, GenreID) VALUES (?, ?, ?, ?, ?, ?)',
      [title, duration, filePath, albumId, artistId, genreId]
    );
    res.json({ message: 'Track added' });
  } catch (err) {
    console.error('Add track error:', err.message);
    res.status(500).json({ message: 'Error adding track' });
  }
});

// ✅ Delete Artist
router.delete('/delete-artist/:id', authAdmin, async (req, res) => {
  const artistId = req.params.id;
  try {
    await pool.query(`DELETE Track FROM Track JOIN Album ON Track.AlbumID = Album.AlbumID WHERE Album.ArtistID = ?`, [artistId]);
    await pool.query('DELETE FROM Album WHERE ArtistID = ?', [artistId]);
    await pool.query('DELETE FROM Artist WHERE ArtistID = ?', [artistId]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete artist error:', err.message);
    res.status(500).json({ message: 'Error deleting artist' });
  }
});

// ✅ Update Password
router.post('/change-password', authAdmin, async (req, res) => {
  const adminId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  try {
    const [[admin]] = await pool.query('SELECT Password FROM User WHERE user_id = ?', [adminId]);
    const valid = await bcrypt.compare(oldPassword, admin.Password);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE User SET Password = ? WHERE user_id = ?', [hashed, adminId]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Admin password change error:', err.message);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// ✅ Summary Metrics
router.get('/summary', authAdmin, async (req, res) => {
  try {
    const [[{ count: artists }]] = await pool.query('SELECT COUNT(*) as count FROM Artist');
    const [[{ count: albums }]] = await pool.query('SELECT COUNT(*) as count FROM Album');
    const [[{ count: tracks }]] = await pool.query('SELECT COUNT(*) as count FROM Track');
    const [[{ count: playlists }]] = await pool.query('SELECT COUNT(*) as count FROM Playlist');
    res.json({ artists, albums, tracks, playlists });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ message: 'Error fetching summary' });
  }
});

// ✅ Recent Activity
router.get('/recent-activity', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 'Track' AS entity, Title AS name, CreatedAt AS timestamp, 'Added' AS action FROM Track
      UNION
      SELECT 'Album', Title, CreatedAt, 'Added' FROM Album
      UNION
      SELECT 'Artist', Name, CreatedAt, 'Added' FROM Artist
      UNION
      SELECT 'Playlist', Name, created_at, 'Created' FROM Playlist
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    res.json(rows.map(r => ({
      activity: `${r.action} ${r.entity}: ${r.name}`,
      timestamp: new Date(r.timestamp).toLocaleString()
    })));
  } catch (err) {
    console.error('Recent activity error:', err.message);
    res.status(500).json({ message: 'Error loading activity' });
  }
});

// ✅ Manage Genres
router.post('/add-genre', authAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Genre name required' });

  try {
    const [result] = await pool.query('INSERT INTO Genre (Name) VALUES (?)', [name]);
    res.json({ GenreID: result.insertId });
  } catch (err) {
    console.error('Add genre error:', err.message);
    res.status(500).json({ message: 'Error creating genre' });
  }
});

// ✅ Admin Create Playlist
router.post('/create-playlist', authAdmin, async (req, res) => {
  const { name, trackIds } = req.body;

  if (!name || !Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ message: 'Playlist name and track IDs are required' });
  }

  try {
    const [playlistResult] = await pool.query(
      'INSERT INTO Playlist (user_id, name, created_at) VALUES (?, ?, NOW())',
      [req.user.id, name]
    );
    const playlistId = playlistResult.insertId;

    const values = trackIds.map(trackId => [playlistId, trackId]);
    await pool.query(
      'INSERT INTO PlaylistTrack (playlist_id, track_id) VALUES ?',
      [values]
    );

    res.json({ message: 'Playlist created successfully', playlistId });
  } catch (err) {
    console.error('Create playlist error:', err.message);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

// ✅ Admin: Get all playlists with track details
router.get('/playlists', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.playlist_id AS PlaylistID,
        p.name AS Name,
        pt.track_id AS TrackID,
        pt.position AS Position,
        t.title AS Title,
        t.duration AS Duration
      FROM Playlist p
      LEFT JOIN PlaylistTrack pt ON pt.playlist_id = p.playlist_id
      LEFT JOIN Track t ON t.track_id = pt.track_id
      WHERE p.user_id = ?
      ORDER BY p.playlist_id, pt.position
    `, [req.user.id]);    

    // Group tracks by playlist
    const playlists = {};
    for (const row of rows) {
      if (!playlists[row.PlaylistID]) {
        playlists[row.PlaylistID] = {
          PlaylistID: row.PlaylistID,
          Name: row.Name,
          tracks: [],
        };
      }
      if (row.TrackID) {
        playlists[row.PlaylistID].tracks.push({
          TrackID: row.TrackID,
          Title: row.Title,
          Duration: row.Duration,
        });
      }
    }

    res.json(Object.values(playlists));
  } catch (err) {
    console.error('Error fetching playlists:', err.message);
    res.status(500).json({ message: 'Server error fetching playlists' });
  }
});

// ✅ Admin: Delete a playlist
router.delete('/delete-playlist/:playlistId', authAdmin, async (req, res) => {
  const playlistId = req.params.playlistId;

  try {
    // Delete associated tracks first
    await pool.query('DELETE FROM PlaylistTrack WHERE playlist_id = ?', [playlistId]);

    // Then delete the playlist itself
    await pool.query('DELETE FROM Playlist WHERE playlist_id = ?', [playlistId]);

    res.json({ message: 'Playlist deleted successfully' });
  } catch (err) {
    console.error('Delete playlist error:', err.message);
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

module.exports = router;
