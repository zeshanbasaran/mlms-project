/**
 * User Router - MLMS (Music Library Management System)
 * ----------------------------------------------------------------
 * Handles user-level routes including dashboard, profile management,
 * subscriptions, track interactions, playlists, browsing, and playback.
 */

const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
require('dotenv').config();

/* ====================== AUTHENTICATION MIDDLEWARE ====================== */

/**
 * Middleware to authenticate JWT and attach user info to req.user
 */
function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT error:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

/* ========================= HELPER FUNCTIONS ========================= */

/**
 * Logs a user action into the UserActivity table
 */
async function logUserActivity(userId, activity) {
  if (!userId || !activity) return;
  try {
    await pool.query(
      'INSERT INTO UserActivity (user_id, activity, timestamp) VALUES (?, ?, NOW())',
      [userId, activity]
    );
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

/**
 * Fetches a track title by ID
 */
async function getTrackTitle(trackId) {
  const [[track]] = await pool.query('SELECT title FROM Track WHERE track_id = ?', [trackId]);
  return track?.title || `ID ${trackId}`;
}

/* ============================ DASHBOARD ============================ */

// Returns user-level stats
router.get('/summary', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  try {
    const [[likedSongs]] = await pool.query('SELECT COUNT(*) AS count FROM LikedSongs WHERE user_id = ?', [userId]);
    const [[playlists]] = await pool.query('SELECT COUNT(*) AS count FROM Playlist WHERE user_id = ?', [userId]);
    const [[recentlyPlayed]] = await pool.query('SELECT COUNT(*) AS count FROM PlaybackHistory WHERE user_id = ?', [userId]);
    const [[totalTracks]] = await pool.query('SELECT COUNT(*) AS count FROM Track');

    res.json({
      likedSongs: likedSongs.count,
      playlists: playlists.count,
      recentlyPlayed: recentlyPlayed.count,
      totalTracks: totalTracks.count
    });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ message: 'Error loading summary' });
  }
});

// Fetch user recent activity
router.get('/recent-activity', authenticateUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT activity, timestamp FROM UserActivity WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Recent activity error:', err.message);
    res.status(500).json({ message: 'Error loading recent activity' });
  }
});

// Manually log activity
router.post('/recent-activity', authenticateUser, async (req, res) => {
  try {
    await logUserActivity(req.user.id, req.body.activity);
    res.json({ message: 'Activity logged' });
  } catch (err) {
    console.error('Error logging activity:', err.message);
    res.status(500).json({ message: 'Failed to log activity' });
  }
});

/* ============================ PROFILE ============================ */

// Fetch user's name and email
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT name, email FROM User WHERE user_id = ?', [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update user's name/email
router.put('/profile', authenticateUser, async (req, res) => {
  const { name, email } = req.body;
  try {
    await pool.query('UPDATE User SET name = ?, email = ? WHERE user_id = ?', [name, email, req.user.id]);
    await logUserActivity(req.user.id, `Updated profile`);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Change user password
router.post('/change-password', authenticateUser, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const [[user]] = await pool.query('SELECT password FROM User WHERE user_id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE User SET password = ? WHERE user_id = ?', [hashed, req.user.id]);
    await logUserActivity(req.user.id, 'Changed password');
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Error changing password' });
  }
});

/* ======================= SUBSCRIPTION ======================= */

// Get current user's subscription
router.get('/subscription', authenticateUser, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT plan FROM Subscription WHERE user_id = ?', [req.user.id]);
    res.json({ plan: row?.plan || 'Free' });
  } catch (err) {
    console.error('Get subscription error:', err.message);
    res.status(500).json({ message: 'Error fetching subscription' });
  }
});

// Update or create subscription plan
router.put('/subscription', authenticateUser, async (req, res) => {
  const { plan } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM Subscription WHERE user_id = ?', [req.user.id]);

    if (existing.length > 0) {
      await pool.query('UPDATE Subscription SET plan = ? WHERE user_id = ?', [plan, req.user.id]);
    } else {
      await pool.query('INSERT INTO Subscription (user_id, plan, start_date) VALUES (?, ?, CURDATE())', [req.user.id, plan]);
    }

    res.json({ message: 'Subscription updated' });
  } catch (err) {
    console.error('Update subscription error:', err.message);
    res.status(500).json({ message: 'Error updating subscription' });
  }
});

/* ======================== TRACK INTERACTIONS ======================== */

/**
 * Like a track: adds it to the user's LikedSongs
 */
router.post('/like', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { trackId } = req.body;

  try {
    await pool.query(
      'INSERT IGNORE INTO LikedSongs (user_id, track_id, liked_at) VALUES (?, ?, NOW())',
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

/**
 * Unlike a track: removes it from the user's LikedSongs
 */
router.delete('/like/:trackId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const trackId = req.params.trackId;

  try {
    await pool.query('DELETE FROM LikedSongs WHERE user_id = ? AND track_id = ?', [userId, trackId]);
    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Unliked "${title}"`);
    res.json({ message: 'Track unliked' });
  } catch (err) {
    console.error('Unlike track error:', err.message);
    res.status(500).json({ message: 'Error unliking track' });
  }
});

/**
 * Returns list of liked track IDs (lightweight version)
 */
router.get('/liked-tracks', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      'SELECT track_id FROM LikedSongs WHERE user_id = ?',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get liked tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching liked tracks' });
  }
});

/**
 * Returns detailed metadata for all liked tracks
 */
router.get('/liked-tracks-detailed', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration AS Duration,
        t.AlbumID,
        a.Title AS AlbumTitle,
        a.ReleaseYear,
        a.ArtistID,
        ar.Name AS ArtistName,
        t.GenreID,
        g.Name AS GenreName
      FROM LikedSongs ls
      JOIN Track t ON ls.track_id = t.track_id
      JOIN Album a ON t.AlbumID = a.AlbumID
      JOIN Artist ar ON t.ArtistID = ar.ArtistID
      JOIN Genre g ON t.GenreID = g.GenreID
      WHERE ls.user_id = ?
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching liked tracks (detailed):', err.message);
    res.status(500).json({ message: 'Error fetching liked songs' });
  }
});

/* ======================== PLAYLIST MANAGEMENT ======================== */

/**
 * Get all playlists owned by the user
 */
router.get('/playlists', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      'SELECT playlist_id, name, created_at FROM Playlist WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching user playlists:', err.message);
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

/**
 * Get all tracks in a specific playlist owned by the user
 */
router.get('/playlists/:playlistId/tracks', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const playlistId = req.params.playlistId;

  try {
    // Confirm ownership
    const [[playlist]] = await pool.query(
      'SELECT * FROM Playlist WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    // Fetch tracks
    const [rows] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration AS Duration,
        t.AlbumID,
        a.Title AS AlbumTitle,
        a.ReleaseYear,
        t.ArtistID,
        ar.Name AS ArtistName,
        t.GenreID,
        g.Name AS GenreName
      FROM PlaylistTrack pt
      JOIN Track t ON pt.track_id = t.track_id
      JOIN Album a ON t.AlbumID = a.AlbumID
      JOIN Artist ar ON t.ArtistID = ar.ArtistID
      JOIN Genre g ON t.GenreID = g.GenreID
      WHERE pt.playlist_id = ?
    `, [playlistId]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching playlist tracks:', err.message);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

/**
 * Create a new playlist
 */
router.post('/playlists', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Playlist name is required' });
  }

  try {
    await pool.query(
      'INSERT INTO Playlist (user_id, name, created_at) VALUES (?, ?, NOW())',
      [userId, name.trim()]
    );
    await logUserActivity(userId, `Created new playlist: ${name}`);
    res.json({ message: 'Playlist created' });
  } catch (err) {
    console.error('Error creating playlist:', err.message);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

/**
 * Rename a playlist
 */
router.put('/playlists/:playlistId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { playlistId } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'New name required' });
  }

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM Playlist WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized' });

    await pool.query(
      'UPDATE Playlist SET name = ? WHERE playlist_id = ?',
      [name.trim(), playlistId]
    );
    res.json({ message: 'Playlist renamed successfully' });
  } catch (err) {
    console.error('Rename playlist error:', err.message);
    res.status(500).json({ message: 'Error renaming playlist' });
  }
});

/**
 * Delete a playlist and its track references
 */
router.delete('/playlists/:playlistId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const playlistId = Number(req.params.playlistId);

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM Playlist WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );

    if (!playlist) {
      console.warn(`Playlist ${playlistId} not found or not owned by user ${userId}`);
      return res.status(403).json({ message: 'Unauthorized or playlist not found' });
    }

    await pool.query('DELETE FROM PlaylistTrack WHERE playlist_id = ?', [playlistId]);
    await pool.query('DELETE FROM Playlist WHERE playlist_id = ?', [playlistId]);

    await logUserActivity(userId, `Deleted playlist ID ${playlistId}`);
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    console.error('Error deleting playlist:', err.message);
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

/**
 * Add a track to a playlist (only if not already present)
 */
router.post('/playlists/:playlistId/add-track', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const playlistId = req.params.playlistId;
  const { trackId } = req.body;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM Playlist WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    const [result] = await pool.query(
      'INSERT IGNORE INTO PlaylistTrack (playlist_id, track_id) VALUES (?, ?)',
      [playlistId, trackId]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Track already in playlist' });
    }

    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Added "${title}" to playlist "${playlist.name}"`);
    res.json({ message: 'Track added to playlist' });
  } catch (err) {
    console.error('Error adding track to playlist:', err.message);
    res.status(500).json({ message: 'Error adding track to playlist' });
  }
});

/**
 * Remove a track from a playlist
 */
router.delete('/playlists/:playlistId/remove-track/:trackId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { playlistId, trackId } = req.params;

  try {
    const [[playlist]] = await pool.query(
      'SELECT * FROM Playlist WHERE playlist_id = ? AND user_id = ?',
      [playlistId, userId]
    );
    if (!playlist) return res.status(403).json({ message: 'Unauthorized or playlist not found' });

    await pool.query(
      'DELETE FROM PlaylistTrack WHERE playlist_id = ? AND track_id = ?',
      [playlistId, trackId]
    );

    const title = await getTrackTitle(trackId);
    await logUserActivity(userId, `Removed "${title}" from playlist "${playlist.name}"`);
    res.json({ message: 'Track removed from playlist' });
  } catch (err) {
    console.error('Error removing track from playlist:', err.message);
    res.status(500).json({ message: 'Error removing track from playlist' });
  }
});

/**
 * Add a track to the user's "Favorites" playlist (create it if needed)
 */
router.post('/playlists/add-track-to-favorites', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { trackId } = req.body;

  try {
    let [playlist] = await pool.query(
      "SELECT playlist_id FROM Playlist WHERE user_id = ? AND name = 'Favorites'",
      [userId]
    );

    let playlistId;
    if (playlist.length === 0) {
      const [result] = await pool.query(
        "INSERT INTO Playlist (user_id, name, created_at) VALUES (?, 'Favorites', NOW())",
        [userId]
      );
      playlistId = result.insertId;
    } else {
      playlistId = playlist[0].playlist_id;
    }

    await pool.query(
      'INSERT IGNORE INTO PlaylistTrack (playlist_id, track_id) VALUES (?, ?)',
      [playlistId, trackId]
    );

    await logUserActivity(userId, `Liked track ID ${trackId}`);
    res.json({ message: 'Track added to Favorites' });
  } catch (err) {
    console.error('Error adding to Favorites:', err.message);
    res.status(500).json({ message: 'Error adding track to Favorites' });
  }
});

/* =================== ADMIN PLAYLIST (PUBLIC) FUNCTIONS =================== */

/**
 * Get all playlists created by admin users (for public browsing)
 * Group tracks under each playlist
 */
router.get('/public-playlists', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.playlist_id AS PlaylistID,
        p.name AS Name,
        pt.track_id AS TrackID,
        t.title AS Title,
        t.duration AS Duration
      FROM Playlist p
      JOIN User u ON u.user_id = p.user_id
      LEFT JOIN PlaylistTrack pt ON pt.playlist_id = p.playlist_id
      LEFT JOIN Track t ON t.track_id = pt.track_id
      WHERE u.role = 'admin'
      ORDER BY p.playlist_id, pt.position
    `);

    // Organize results into nested playlists with track arrays
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
    console.error('Error fetching admin-created playlists:', err.message);
    res.status(500).json({ message: 'Failed to fetch admin playlists' });
  }
});

/**
 * Copy a public admin playlist into the user's library
 * 1. Validate it's an admin playlist
 * 2. Duplicate the playlist record under the current user
 * 3. Copy all track associations into the new playlist
 */
router.post('/save-playlist/:playlistId', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { playlistId } = req.params;

  try {
    // Step 1: Confirm it's an admin-created playlist
    const [[originalPlaylist]] = await pool.query(`
      SELECT Playlist.name AS playlist_name, Playlist.user_id 
      FROM Playlist 
      JOIN User ON Playlist.user_id = User.user_id 
      WHERE Playlist.playlist_id = ? AND User.role = 'admin'
    `, [playlistId]);

    if (!originalPlaylist) {
      return res.status(404).json({ message: 'Admin playlist not found' });
    }

    // Step 2: Create a copy of the playlist for the user
    const [insertResult] = await pool.query(
      'INSERT INTO Playlist (user_id, name, created_at) VALUES (?, ?, NOW())',
      [userId, originalPlaylist.playlist_name]
    );
    const newPlaylistId = insertResult.insertId;

    // Step 3: Copy all tracks into the user's new playlist
    await pool.query(`
      INSERT INTO PlaylistTrack (playlist_id, track_id, position)
      SELECT ?, track_id, position
      FROM PlaylistTrack
      WHERE playlist_id = ?
    `, [newPlaylistId, playlistId]);

    // Step 4: Fetch and return the new playlist info
    const [[newPlaylist]] = await pool.query(`
      SELECT playlist_id, name, created_at 
      FROM Playlist 
      WHERE playlist_id = ?
    `, [newPlaylistId]);

    res.json({
      message: 'Playlist copied to your library',
      playlist: newPlaylist
    });
  } catch (err) {
    console.error('Save playlist error:', err.message);
    res.status(500).json({ message: 'Error saving playlist' });
  }
});

/* ========================== PLAYBACK TRACKING ========================== */

/**
 * Get the most recently played track for the authenticated user
 */
router.get('/now-playing', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const [[track]] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration AS Duration,
        t.AlbumID,
        a.Title AS AlbumTitle,
        a.ReleaseYear,
        a.ArtistID,
        ar.Name AS ArtistName,
        t.GenreID,
        g.Name AS GenreName
      FROM PlaybackHistory ph
      JOIN Track t ON ph.track_id = t.track_id
      JOIN Album a ON t.AlbumID = a.AlbumID
      JOIN Artist ar ON t.ArtistID = ar.ArtistID
      JOIN Genre g ON t.GenreID = g.GenreID
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

/**
 * Log a new track play into the PlaybackHistory table
 */
router.post('/playback', authenticateUser, async (req, res) => {
  const userId = req.user.id;
  const { trackId } = req.body;

  try {
    await pool.query(
      'INSERT INTO PlaybackHistory (user_id, track_id, played_at) VALUES (?, ?, NOW())',
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

/* ========================== LIBRARY BROWSING ========================== */

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

// Get all tracks with metadata
router.get('/tracks', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.track_id AS TrackID,
        t.title AS Title,
        t.duration AS Duration,
        t.AlbumID,
        a.Title AS AlbumTitle,
        a.ReleaseYear,
        t.ArtistID,
        ar.Name AS ArtistName,
        t.GenreID,
        g.Name AS GenreName
      FROM Track t
      JOIN Album a ON t.AlbumID = a.AlbumID
      JOIN Artist ar ON t.ArtistID = ar.ArtistID
      JOIN Genre g ON t.GenreID = g.GenreID
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get tracks error:', err.message);
    res.status(500).json({ message: 'Error fetching tracks' });
  }
});

module.exports = router;
