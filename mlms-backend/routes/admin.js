/**
 * Admin Router - MLMS (Music Library Management System)
 * -------------------------------------------------------
 * Provides admin-only routes for managing artists, albums,
 * tracks, genres, playlists, dashboard metrics, and admin
 * account operations. Requires JWT token authentication
 * with admin role.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const router = express.Router();
require('dotenv').config();

/**
 * Middleware: Verifies JWT and ensures admin role
 */
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token error:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// ===========================
// GET routes for data fetching
// ===========================

router.get('/tracks', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tracks');
    res.json(rows);
  } catch (err) {
    console.error('Fetch tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

router.get('/albums', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM albums');
    res.json(rows);
  } catch (err) {
    console.error('Fetch albums error:', err.message);
    res.status(500).json({ message: 'Error fetching albums' });
  }
});

router.get('/artists', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM artists');
    res.json(rows);
  } catch (err) {
    console.error('Fetch artists error:', err.message);
    res.status(500).json({ message: 'Error fetching artists' });
  }
});

router.get('/genres', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM genres');
    res.json(rows);
  } catch (err) {
    console.error('Fetch genres error:', err.message);
    res.status(500).json({ message: 'Error fetching genres' });
  }
});

// ===========================
// Artist Routes
// ===========================

router.post('/artist', authAdmin, async (req, res) => {
  const { name, biography } = req.body;
  if (!name || !biography) return res.status(400).json({ message: 'Name and biography required' });

  try {
    await pool.query('INSERT INTO artists (name, biography) VALUES (?, ?)', [name, biography]);
    res.json({ message: 'Artist added' });
  } catch (err) {
    console.error('Add artist error:', err.message);
    res.status(500).json({ message: 'Error adding artist' });
  }
});

router.put('/artist/:id', authAdmin, async (req, res) => {
  const artistId = req.params.id;
  const { name, biography } = req.body;
  try {
    await pool.query('UPDATE artists SET name = ?, biography = ? WHERE artist_id = ?', [name, biography, artistId]);
    res.json({ message: 'Artist updated' });
  } catch (err) {
    console.error('Update artist error:', err.message);
    res.status(500).json({ message: 'Error updating artist' });
  }
});

router.delete('/artist/:id', authAdmin, async (req, res) => {
  const artistId = req.params.id;
  try {
    await pool.query('DELETE FROM tracks WHERE artist_id = ?', [artistId]);
    await pool.query('DELETE FROM albums WHERE artist_id = ?', [artistId]);
    await pool.query('DELETE FROM artists WHERE artist_id = ?', [artistId]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete artist error:', err.message);
    res.status(500).json({ message: 'Error deleting artist' });
  }
});

// ===========================
// Album Routes
// ===========================

router.post('/album', authAdmin, async (req, res) => {
  const { title, release_year, genre_id, artist_id } = req.body;

  if (!title || !release_year || !genre_id || !artist_id) {
    return res.status(400).json({ message: 'All fields required' });
  }

  try {
    // Check for duplicate
    const [existing] = await pool.query(
      'SELECT * FROM albums WHERE LOWER(title) = LOWER(?) AND artist_id = ?',
      [title, artist_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Album already exists for this artist.' });
    }

    // Insert if not duplicate
    await pool.query(
      'INSERT INTO albums (title, release_year, genre_id, artist_id) VALUES (?, ?, ?, ?)',
      [title, release_year, genre_id, artist_id]
    );

    res.status(201).json({ message: 'Album added' });

  } catch (err) {
    console.error('Add album error:', err.message);
    res.status(500).json({ message: 'Error adding album' });
  }
});

router.put('/album/:id', authAdmin, async (req, res) => {
  const albumId = req.params.id;
  const { title, release_year, genre_id, artist_id } = req.body;
  try {
    await pool.query(
      'UPDATE albums SET title = ?, release_year = ?, genre_id = ?, artist_id = ? WHERE album_id = ?',
      [title, release_year, genre_id, artist_id, albumId]
    );
    res.json({ message: 'Album updated' });
  } catch (err) {
    console.error('Update album error:', err.message);
    res.status(500).json({ message: 'Error updating album' });
  }
});

router.delete('/album/:id', authAdmin, async (req, res) => {
  const albumId = req.params.id;
  try {
    const [tracks] = await pool.query('SELECT track_id FROM tracks WHERE album_id = ?', [albumId]);
    const trackIds = tracks.map(row => row.track_id);

    if (trackIds.length) {
      await pool.query('DELETE FROM playlist_tracks WHERE track_id IN (?)', [trackIds]);
      await pool.query('DELETE FROM liked_tracks WHERE track_id IN (?)', [trackIds]);
      await pool.query('DELETE FROM download_history WHERE track_id IN (?)', [trackIds]);
      await pool.query('DELETE FROM playback_history WHERE track_id IN (?)', [trackIds]);
      await pool.query('DELETE FROM tracks WHERE track_id IN (?)', [trackIds]);
    }

    await pool.query('DELETE FROM albums WHERE album_id = ?', [albumId]);
    res.json({ message: 'Album and associated tracks deleted successfully' });
  } catch (err) {
    console.error('Delete album error:', err.message);
    res.status(500).json({ message: 'Error deleting album' });
  }
});

// ===========================
// Track Routes
// ===========================

router.post('/track', authAdmin, async (req, res) => {
  const { title, duration_seconds, file_path = '', album_id, artist_id, genre_id } = req.body;
  if (!title || !duration_seconds || !album_id || !artist_id || !genre_id) {
    return res.status(400).json({ message: 'All required fields must be provided' });
  }

  try {
    await pool.query(
      'INSERT INTO tracks (title, duration_seconds, file_path, album_id, artist_id, genre_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [title, duration_seconds, file_path, album_id, artist_id, genre_id]
    );
    res.json({ message: `Track "${title}" added successfully` });
  } catch (err) {
    console.error('Add track error:', err.message);
    res.status(500).json({ message: 'Error adding track' });
  }
});

router.put('/track/:id', authAdmin, async (req, res) => {
  const trackId = req.params.id;
  const { title, duration_seconds, album_id, artist_id, genre_id } = req.body;
  try {
    await pool.query(
      'UPDATE tracks SET title = ?, duration_seconds = ?, album_id = ?, artist_id = ?, genre_id = ? WHERE track_id = ?',
      [title, duration_seconds, album_id, artist_id, genre_id, trackId]
    );
    res.json({ message: 'Track updated' });
  } catch (err) {
    console.error('Update track error:', err.message);
    res.status(500).json({ message: 'Error updating track' });
  }
});

router.delete('/track/:id', authAdmin, async (req, res) => {
  const trackId = req.params.id;

  try {
    const [[track]] = await pool.query('SELECT title FROM tracks WHERE track_id = ?', [trackId]);
    if (!track) return res.status(404).json({ message: 'Track not found' });

    await pool.query('DELETE FROM playlist_tracks WHERE track_id = ?', [trackId]);
    await pool.query('DELETE FROM liked_tracks WHERE track_id = ?', [trackId]);
    await pool.query('DELETE FROM download_history WHERE track_id = ?', [trackId]);
    await pool.query('DELETE FROM playback_history WHERE track_id = ?', [trackId]);
    await pool.query('DELETE FROM tracks WHERE track_id = ?', [trackId]);

    res.json({ message: `Track "${track.title}" deleted successfully` });
  } catch (err) {
    console.error('Delete track error:', err.message);
    res.status(500).json({ message: 'Error deleting track' });
  }
});

// ===========================
// Genre Routes
// ===========================

// Add a new genre
router.post('/genre', authAdmin, async (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ message: 'Genre name required' });

  try {
    const [result] = await pool.query('INSERT INTO genres (name, description) VALUES (?, ?)', [name, description]);
    res.json({ genre_id: result.insertId, message: 'Genre added' });
  } catch (err) {
    console.error('Add genre error:', err.message);
    res.status(500).json({ message: 'Error adding genre' });
  }
});

// Update genre
router.put('/genre/:id', authAdmin, async (req, res) => {
  const genreId = req.params.id;
  const { name, description } = req.body;

  try {
    await pool.query('UPDATE genres SET name = ?, description = ? WHERE genre_id = ?', [name, description, genreId]);
    res.json({ message: 'Genre updated' });
  } catch (err) {
    console.error('Update genre error:', err.message);
    res.status(500).json({ message: 'Error updating genre' });
  }
});

// Delete genre (must check for foreign key usage)
router.delete('/genre/:id', authAdmin, async (req, res) => {
  const genreId = req.params.id;
  try {
    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM tracks WHERE genre_id = ?', [genreId]);
    if (count > 0) {
      return res.status(400).json({ message: 'Cannot delete genre in use by tracks' });
    }

    await pool.query('DELETE FROM genres WHERE genre_id = ?', [genreId]);
    res.json({ message: 'Genre deleted' });
  } catch (err) {
    console.error('Delete genre error:', err.message);
    res.status(500).json({ message: 'Error deleting genre' });
  }
});

// ===========================
// Dashboard Routes
// ===========================

// Return summary statistics for dashboard
router.get('/summary', authAdmin, async (req, res) => {
  try {
    const [[{ count: users }]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[{ count: artists }]] = await pool.query('SELECT COUNT(*) AS count FROM artists');
    const [[{ count: albums }]] = await pool.query('SELECT COUNT(*) AS count FROM albums');
    const [[{ count: tracks }]] = await pool.query('SELECT COUNT(*) AS count FROM tracks');
    const [[{ count: playlists }]] = await pool.query('SELECT COUNT(*) AS count FROM playlists');

    res.json({ users, artists, albums, tracks, playlists });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ message: 'Error fetching summary' });
  }
});

// Return recent admin activity (last 10 changes)
router.get('/recent-activity', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 'Track' AS entity, title AS name, created_at AS timestamp, 'Added' AS action FROM tracks
      UNION
      SELECT 'Album', title, created_at, 'Added' FROM albums
      UNION
      SELECT 'Artist', name, created_at, 'Added' FROM artists
      UNION
      SELECT 'Playlist', name, created_at, 'Created' FROM playlists
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

// ===========================
// Admin Account Management
// ===========================

router.post('/change-password', authAdmin, async (req, res) => {
  const adminId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  try {
    const [[admin]] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [adminId]);
    const valid = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashed, adminId]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// ===========================
// Playlist Management
// ===========================

// Utility: Validate that tracks exist
async function validateTrackIds(trackIds) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) return false;
  const [rows] = await pool.query(
    'SELECT track_id FROM tracks WHERE track_id IN (?)',
    [trackIds]
  );
  return rows.length === trackIds.length;
}

// Admin creates a playlist with track IDs
router.post('/playlist', authAdmin, async (req, res) => {
  const { name, track_ids } = req.body;
  if (!name || !Array.isArray(track_ids) || track_ids.length === 0) {
    return res.status(400).json({ message: 'Playlist name and non-empty track_ids array required' });
  }

  try {
    const valid = await validateTrackIds(track_ids);
    if (!valid) return res.status(400).json({ message: 'Invalid or missing track IDs' });

    const [result] = await pool.query(
      'INSERT INTO playlists (user_id, name, created_at) VALUES (?, ?, NOW())',
      [req.user.id, name]
    );
    const playlistId = result.insertId;

    const values = track_ids.map((track_id, index) => [playlistId, track_id, index + 1]);
    await pool.query('INSERT INTO playlist_tracks (playlist_id, track_id, track_order) VALUES ?', [values]);

    res.json({ message: 'Playlist created successfully', playlist_id: playlistId });
  } catch (err) {
    console.error('Create playlist error:', err.message);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

// Admin fetches their playlists and included tracks
router.get('/playlists', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.playlist_id,
        p.name AS playlist_name,
        pt.track_id,
        pt.track_order,
        t.title AS track_title,
        t.duration_seconds
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.playlist_id
      LEFT JOIN tracks t ON t.track_id = pt.track_id
      WHERE p.user_id = ?
      ORDER BY p.playlist_id, pt.track_order
    `, [req.user.id]);

    const playlists = {};
    for (const row of rows) {
      if (!playlists[row.playlist_id]) {
        playlists[row.playlist_id] = {
          playlist_id: row.playlist_id,
          name: row.playlist_name,
          tracks: []
        };
      }
      if (row.track_id) {
        playlists[row.playlist_id].tracks.push({
          track_id: row.track_id,
          title: row.track_title,
          duration_seconds: row.duration_seconds
        });
      }
    }

    res.json(Object.values(playlists));
  } catch (err) {
    console.error('Fetch playlists error:', err.message);
    res.status(500).json({ message: 'Server error fetching playlists' });
  }
});

// Admin updates a playlist's name
router.put('/playlist/:playlistId', authAdmin, async (req, res) => {
  const playlistId = req.params.playlistId;
  const { name } = req.body;

  if (!name) return res.status(400).json({ message: 'New playlist name required' });

  try {
    await pool.query('UPDATE playlists SET name = ? WHERE playlist_id = ?', [name, playlistId]);
    res.json({ message: 'Playlist name updated' });
  } catch (err) {
    console.error('Update playlist error:', err.message);
    res.status(500).json({ message: 'Error updating playlist' });
  }
});

// Admin reorders tracks in a playlist
router.put('/playlist/:playlistId/reorder', authAdmin, async (req, res) => {
  const playlistId = req.params.playlistId;
  const { ordered_track_ids } = req.body;

  if (!Array.isArray(ordered_track_ids) || ordered_track_ids.length === 0) {
    return res.status(400).json({ message: 'Ordered track ID list required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ?',
      [playlistId]
    );
    const existingTrackIds = existing.map(row => row.track_id);
    const set1 = new Set(existingTrackIds);
    const set2 = new Set(ordered_track_ids);

    if (set1.size !== set2.size || [...set1].some(id => !set2.has(id))) {
      return res.status(400).json({ message: 'Track list must match current playlist content' });
    }

    for (let i = 0; i < ordered_track_ids.length; i++) {
      await pool.query(
        'UPDATE playlist_tracks SET track_order = ? WHERE playlist_id = ? AND track_id = ?',
        [i + 1, playlistId, ordered_track_ids[i]]
      );
    }
    res.json({ message: 'Playlist track order updated' });
  } catch (err) {
    console.error('Reorder playlist error:', err.message);
    res.status(500).json({ message: 'Error reordering playlist' });
  }
});

// Admin adds tracks to an existing playlist
router.post('/playlist/:playlistId/add-tracks', authAdmin, async (req, res) => {
  const playlistId = req.params.playlistId;
  const { track_ids } = req.body;

  if (!Array.isArray(track_ids) || track_ids.length === 0) {
    return res.status(400).json({ message: 'Track IDs required' });
  }

  try {
    const valid = await validateTrackIds(track_ids);
    if (!valid) return res.status(400).json({ message: 'Invalid or missing track IDs' });

    const [[{ maxOrder }]] = await pool.query(
      'SELECT MAX(track_order) AS maxOrder FROM playlist_tracks WHERE playlist_id = ?',
      [playlistId]
    );
    let start = maxOrder || 0;
    const values = track_ids.map((track_id, idx) => [playlistId, track_id, start + idx + 1]);

    await pool.query('INSERT INTO playlist_tracks (playlist_id, track_id, track_order) VALUES ?', [values]);
    res.json({ message: 'Tracks added to playlist' });
  } catch (err) {
    console.error('Add tracks to playlist error:', err.message);
    res.status(500).json({ message: 'Error adding tracks' });
  }
});

// Admin removes a specific track from a playlist
router.delete('/playlist/:playlistId/track/:trackId', authAdmin, async (req, res) => {
  const { playlistId, trackId } = req.params;

  try {
    await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
    res.json({ message: 'Track removed from playlist' });
  } catch (err) {
    console.error('Remove track error:', err.message);
    res.status(500).json({ message: 'Error removing track from playlist' });
  }
});

// Admin deletes a playlist
router.delete('/playlist/:playlistId', authAdmin, async (req, res) => {
  const playlistId = req.params.playlistId;

  try {
    await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    await pool.query('DELETE FROM playlists WHERE playlist_id = ?', [playlistId]);
    res.json({ message: 'Playlist deleted successfully' });
  } catch (err) {
    console.error('Delete playlist error:', err.message);
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

module.exports = router;