/**
 * User Router - MLMS (Music Library Management System)
 * ----------------------------------------------------------------
 * Handles user-level routes including dashboard, profile management,
 * subscriptions, track interactions, playlists, browsing, and playback.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticateUser, authorizeAdmin } = require('../middleware/auth');
const { logUserActivity, getTrackTitle } = require('../utils/helpers');

// ===========================
// Dashboard / Summary
// ===========================

// User summary with basic stats
router.get('/summary', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  try {
    const [[likedTracks]] = await pool.query(
      'SELECT COUNT(*) AS count FROM liked_tracks WHERE user_id = ?',
      [userId]
    );

    const [[playlistCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM playlists WHERE user_id = ?',
      [userId]
    );

    const [[historyCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM playback_history WHERE user_id = ?',
      [userId]
    );

    const [[trackCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM tracks'
    );

    res.json({
      likedTracks: likedTracks.count,
      playlists: playlistCount.count,
      recentlyPlayed: historyCount.count,
      totalTracks: trackCount.count
    });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ message: 'Error loading summary' });
  }
});

// Recent user activity log (last 10 actions)
router.get('/recent-activity', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT activity, timestamp FROM user_activity WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Recent activity error:', err.message);
    res.status(500).json({ message: 'Error loading recent activity' });
  }
});

// Manual user activity log entry
router.post('/recent-activity', authenticateUser, async (req, res) => {
  try {
    await logUserActivity(req.user.id, req.body.activity);
    res.json({ message: 'Activity logged' });
  } catch (err) {
    console.error('Error logging activity:', err.message);
    res.status(500).json({ message: 'Failed to log activity' });
  }
});

// ===========================
// User Profile Management
// ===========================

// Get user's name, email, and role
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT name, email, role FROM users WHERE user_id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update name or email
router.put('/profile', authenticateUser, async (req, res) => {
  const { name, email } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name = ?, email = ? WHERE user_id = ?',
      [name, email, req.user.id]
    );
    await logUserActivity(req.user.id, 'Updated profile');
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Change password
router.post('/change-password', authenticateUser, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const [[user]] = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [hashed, req.user.id]
    );
    await logUserActivity(req.user.id, 'Changed password');
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// ===========================
// Subscriptions Management
// ===========================

// Get current user's subscription info
router.get('/subscription', authenticateUser, async (req, res) => {
  try {
    const [[subscription]] = await pool.query(
      'SELECT subscription_type, start_date, end_date, is_active FROM subscriptions WHERE user_id = ?',
      [req.user.id]
    );
    res.json(subscription || { subscription_type: 'Free', is_active: 0 });
  } catch (err) {
    console.error('Get subscription error:', err.message);
    res.status(500).json({ message: 'Error fetching subscription' });
  }
});

// Update or create a subscription
router.put('/subscription', authenticateUser, async (req, res) => {
  const { subscription_type, start_date, end_date, is_active } = req.body;
  try {
    const [existing] = await pool.query(
      'SELECT subscription_id FROM subscriptions WHERE user_id = ?',
      [req.user.id]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE subscriptions 
         SET subscription_type = ?, start_date = ?, end_date = ?, is_active = ?
         WHERE user_id = ?`,
        [subscription_type, start_date, end_date, is_active ? 1 : 0, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, subscription_type, start_date, end_date, is_active ? 1 : 0]
      );
    }

    res.json({ message: 'Subscription updated' });
  } catch (err) {
    console.error('Update subscription error:', err.message);
    res.status(500).json({ message: 'Error updating subscription' });
  }
});

// ===========================
// Track Interactions (Likes)
// ===========================

// Like a track
router.post('/like', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { trackId } = req.body;

  try {
    await pool.query(
      'INSERT IGNORE INTO liked_tracks (user_id, track_id, liked_at) VALUES (?, ?, NOW())',
      [userId, trackId]
    );

    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Liked "${title}"`);
    res.json({ message: 'Track liked' });
  } catch (err) {
    console.error('Like track error:', err.message);
    res.status(500).json({ message: 'Error liking track' });
  }
});

// Unlike a track
router.delete('/like/:trackId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const trackId = req.params.trackId;

  try {
    await pool.query(
      'DELETE FROM liked_tracks WHERE user_id = ? AND track_id = ?',
      [userId, trackId]
    );

    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Unliked "${title}"`);
    res.json({ message: 'Track unliked' });
  } catch (err) {
    console.error('Unlike track error:', err.message);
    res.status(500).json({ message: 'Error unliking track' });
  }
});

// Get list of liked track IDs
router.get('/liked-tracks', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT track_id FROM liked_tracks WHERE user_id = ?',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get liked tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching liked tracks' });
  }
});

// Get detailed info for all liked tracks
router.get('/liked-tracks-detailed', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration_seconds AS Duration,
        t.album_id AS AlbumID,
        a.title AS AlbumTitle,
        a.release_year AS ReleaseYear,
        ar.artist_id AS ArtistID,
        ar.name AS ArtistName,
        g.genre_id AS GenreID,
        g.name AS GenreName
      FROM liked_tracks lt
      JOIN tracks t ON lt.track_id = t.track_id
      JOIN albums a ON t.album_id = a.album_id
      JOIN artists ar ON t.artist_id = ar.artist_id
      JOIN genres g ON t.genre_id = g.genre_id
      WHERE lt.user_id = ?
    `, [req.user.id]);

    res.json(rows);
  } catch (err) {
    console.error('Liked tracks detailed error:', err.message);
    res.status(500).json({ message: 'Error fetching liked tracks' });
  }
});

// ===========================
// Playlist Management
// ===========================

// Get all playlists owned by the user
router.get('/playlists', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT playlist_id, name, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch playlists error:', err.message);
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

// Get tracks in a specific playlist
router.get('/playlists/:playlistId/tracks', authenticateUser, async (req, res) => {
  const { playlistId } = req.params;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM playlists WHERE playlist_id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    const [tracks] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration_seconds AS Duration,
        a.title AS AlbumTitle,
        ar.name AS ArtistName,
        g.name AS GenreName,
        pt.track_order AS TrackOrder
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.track_id
      JOIN albums a ON t.album_id = a.album_id
      JOIN artists ar ON t.artist_id = ar.artist_id
      JOIN genres g ON t.genre_id = g.genre_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.track_order ASC, pt.added_at ASC
    `, [playlistId]);

    res.json(tracks);
  } catch (err) {
    console.error('Fetch playlist tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching playlist tracks' });
  }
});

// Create a new playlist
router.post('/playlists', authenticateUser, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Playlist name is required' });
  }

  try {
    await pool.query(
      'INSERT INTO playlists (user_id, name, created_at) VALUES (?, ?, NOW())',
      [req.user.id, name.trim()]
    );
    await logUserActivity(req.user.id, `Created new playlist: ${name}`);
    res.json({ message: 'Playlist created' });
  } catch (err) {
    console.error('Create playlist error:', err.message);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

// Rename a playlist
router.put('/playlists/:playlistId', authenticateUser, async (req, res) => {
  const { playlistId } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'New name required' });
  }

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM playlists WHERE playlist_id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    await pool.query(
      'UPDATE playlists SET name = ? WHERE playlist_id = ?',
      [name.trim(), playlistId]
    );
    res.json({ message: 'Playlist renamed' });
  } catch (err) {
    console.error('Rename playlist error:', err.message);
    res.status(500).json({ message: 'Error renaming playlist' });
  }
});

// Delete a playlist
router.delete('/playlists/:playlistId', authenticateUser, async (req, res) => {
  const { playlistId } = req.params;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM playlists WHERE playlist_id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    await pool.query('DELETE FROM playlists WHERE playlist_id = ?', [playlistId]);

    await logUserActivity(req.user.id, `Deleted playlist ID ${playlistId}`);
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    console.error('Delete playlist error:', err.message);
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

// Add a track to a playlist
router.post('/playlists/:playlistId/add-track', authenticateUser, async (req, res) => {
  const { playlistId } = req.params;
  const { trackId, track_order } = req.body;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM playlists WHERE playlist_id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    const [result] = await pool.query(
      'INSERT IGNORE INTO playlist_tracks (playlist_id, track_id, track_order, added_at) VALUES (?, ?, ?, NOW())',
      [playlistId, trackId, track_order || 0]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Track already in playlist' });
    }

    const title = await getTrackTitle(trackId);
    await logUserActivity(req.user.id, `Added "${title}" to playlist "${playlist.name}"`);
    res.json({ message: 'Track added to playlist' });
  } catch (err) {
    console.error('Add track to playlist error:', err.message);
    res.status(500).json({ message: 'Error adding track to playlist' });
  }
});

// Remove a track from a playlist
router.delete('/playlists/:playlistId/remove-track/:trackId', authenticateUser, async (req, res) => {
  const { playlistId, trackId } = req.params;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM playlists WHERE playlist_id = ? AND user_id = ?',
      [playlistId, req.user.id]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    await pool.query(
      'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );

    const title = await getTrackTitle(trackId);
    await logUserActivity(req.user.id, `Removed "${title}" from playlist "${playlist.name}"`);
    res.json({ message: 'Track removed from playlist' });
  } catch (err) {
    console.error('Remove track from playlist error:', err.message);
    res.status(500).json({ message: 'Error removing track from playlist' });
  }
});

// ===========================
// Public Playlists (Admin-Curated)
// ===========================

// Get all public playlists created by admin users
router.get('/public-playlists', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.playlist_id AS PlaylistID,
        p.name AS PlaylistName,
        u.name AS CreatedBy,
        pt.track_id AS TrackID,
        t.title AS TrackTitle,
        t.duration_seconds AS Duration,
        ar.name AS ArtistName,
        a.title AS AlbumTitle,
        g.name AS GenreName,
        pt.track_order AS TrackOrder
      FROM playlists p
      JOIN users u ON p.user_id = u.user_id
      JOIN playlist_tracks pt ON p.playlist_id = pt.playlist_id
      JOIN tracks t ON pt.track_id = t.track_id
      JOIN artists ar ON t.artist_id = ar.artist_id
      JOIN albums a ON t.album_id = a.album_id
      JOIN genres g ON t.genre_id = g.genre_id
      WHERE u.role = 'admin'
      ORDER BY p.playlist_id, pt.track_order, pt.added_at
    `);

    // Group by playlist
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.PlaylistID]) {
        grouped[row.PlaylistID] = {
          PlaylistID: row.PlaylistID,
          Name: row.PlaylistName,
          CreatedBy: row.CreatedBy,
          Tracks: []
        };
      }

      grouped[row.PlaylistID].Tracks.push({
        TrackID: row.TrackID,
        Title: row.TrackTitle,
        Duration: row.Duration,
        Artist: row.ArtistName,
        Album: row.AlbumTitle,
        Genre: row.GenreName,
        Order: row.TrackOrder
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error('Fetch admin playlists error:', err.message);
    res.status(500).json({ message: 'Failed to fetch admin playlists' });
  }
});

// Copy a public playlist into the authenticated user's library
router.post('/save-playlist/:playlistId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { playlistId } = req.params;

  try {
    // Validate ownership
    const [[original]] = await pool.query(`
      SELECT p.name AS playlist_name
      FROM playlists p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.playlist_id = ? AND u.role = 'admin'
    `, [playlistId]);

    if (!original) {
      return res.status(404).json({ message: 'Public playlist not found' });
    }

    // Duplicate playlist for user
    const [insertResult] = await pool.query(
      'INSERT INTO playlists (user_id, name, created_at) VALUES (?, ?, NOW())',
      [userId, original.playlist_name]
    );
    const newPlaylistId = insertResult.insertId;

    // Copy all tracks into new playlist
    await pool.query(`
      INSERT INTO playlist_tracks (playlist_id, track_id, track_order, added_at)
      SELECT ?, track_id, track_order, NOW()
      FROM playlist_tracks
      WHERE playlist_id = ?
    `, [newPlaylistId, playlistId]);

    res.json({ message: 'Playlist saved to your library', playlist_id: newPlaylistId });
  } catch (err) {
    console.error('Save public playlist error:', err.message);
    res.status(500).json({ message: 'Error saving playlist' });
  }
});

// ===========================
// Playback Tracking
// ===========================

// Get the most recently played track for the authenticated user
router.get('/now-playing', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const [[track]] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration_seconds AS Duration,
        a.album_id AS AlbumID,
        a.title AS AlbumTitle,
        a.release_year AS ReleaseYear,
        ar.artist_id AS ArtistID,
        ar.name AS ArtistName,
        g.genre_id AS GenreID,
        g.name AS GenreName,
        ph.played_at AS LastPlayed
      FROM playback_history ph
      JOIN tracks t ON ph.track_id = t.track_id
      JOIN albums a ON t.album_id = a.album_id
      JOIN artists ar ON t.artist_id = ar.artist_id
      JOIN genres g ON t.genre_id = g.genre_id
      WHERE ph.user_id = ?
      ORDER BY ph.played_at DESC
      LIMIT 1
    `, [userId]);

    res.json(track || null);
  } catch (err) {
    console.error('Now playing error:', err.message);
    res.status(500).json({ message: 'Error fetching now playing track' });
  }
});

// Log a new track play into the playback history
router.post('/playback', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { trackId } = req.body;

  try {
    await pool.query(
      'INSERT INTO playback_history (user_id, track_id, played_at) VALUES (?, ?, NOW())',
      [userId, trackId]
    );

    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Played "${title}"`);
    res.json({ message: 'Playback logged' });
  } catch (err) {
    console.error('Playback error:', err.message);
    res.status(500).json({ message: 'Error logging playback' });
  }
});

// ===========================
// Library Browsing
// ===========================

// Get all artists
router.get('/artists', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT artist_id, name, biography, created_at FROM artists ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Get artists error:', err.message);
    res.status(500).json({ message: 'Error fetching artists' });
  }
});

// Get all genres
router.get('/genres', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT genre_id, name, description, created_at FROM genres ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Get genres error:', err.message);
    res.status(500).json({ message: 'Error fetching genres' });
  }
});

// Get all albums
router.get('/albums', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.album_id,
        a.title AS AlbumTitle,
        a.release_year,
        ar.artist_id,
        ar.name AS ArtistName,
        g.genre_id,
        g.name AS GenreName,
        a.created_at
      FROM albums a
      JOIN artists ar ON a.artist_id = ar.artist_id
      JOIN genres g ON a.genre_id = g.genre_id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get albums error:', err.message);
    res.status(500).json({ message: 'Error fetching albums' });
  }
});

// Get all tracks with full metadata
router.get('/tracks', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration_seconds AS Duration,
        t.file_path AS FilePath,
        a.album_id AS AlbumID,
        a.title AS AlbumTitle,
        a.release_year AS ReleaseYear,
        ar.artist_id AS ArtistID,
        ar.name AS ArtistName,
        g.genre_id AS GenreID,
        g.name AS GenreName,
        t.created_at AS TrackCreated
      FROM tracks t
      JOIN albums a ON t.album_id = a.album_id
      JOIN artists ar ON t.artist_id = ar.artist_id
      JOIN genres g ON t.genre_id = g.genre_id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

module.exports = router;
