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
  const { title, duration, filePath = '', albumId, artistId, genreId } = req.body;
  if (!title || !duration || !albumId || !artistId || !genreId) {
    return res.status(400).json({ message: 'All fields except filePath are required' });
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

// In /admin.js
router.delete('/delete-artist/:id', authAdmin, async (req, res) => {
  const artistId = req.params.id;
  try {
    // First delete all tracks associated with this artist
    await pool.query(`
      DELETE Track FROM Track
      JOIN Album ON Track.AlbumID = Album.AlbumID
      WHERE Album.ArtistID = ?`, [artistId]);

    // Then delete all albums by the artist
    await pool.query('DELETE FROM Album WHERE ArtistID = ?', [artistId]);

    // Finally delete the artist
    await pool.query('DELETE FROM Artist WHERE ArtistID = ?', [artistId]);

    res.sendStatus(204);
  } catch (err) {
    console.error('Delete artist error:', err.message);
    res.status(500).json({ message: 'Error deleting artist' });
  }
});

router.delete('/delete-album/:id', authAdmin, async (req, res) => {
  const albumId = req.params.id;
  try {
    await pool.query('DELETE FROM Track WHERE AlbumID = ?', [albumId]);
    await pool.query('DELETE FROM Album WHERE AlbumID = ?', [albumId]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete album error:', err.message);
    res.status(500).json({ message: 'Error deleting album' });
  }
});

router.delete('/delete-track/:id', authAdmin, async (req, res) => {
  await pool.query('DELETE FROM Track WHERE TrackID = ?', [req.params.id]);
  res.sendStatus(204);
});

router.post('/create-playlist', authAdmin, async (req, res) => {
  const { name, trackIds } = req.body;
  if (!name || !trackIds?.length) return res.status(400).json({ message: 'Missing data' });

  try {
    const [result] = await pool.query(
      'INSERT INTO Playlist (Name, UserID) VALUES (?, ?)',
      [name, 1] // assuming admin or a fixed user ID
    );
    const playlistId = result.insertId;

    for (const trackId of trackIds) {
      await pool.query(
        'INSERT INTO PlaylistTrack (PlaylistID, TrackID, TrackOrder, AddedDate) VALUES (?, ?, ?, NOW())',
        [playlistId, trackId, trackIds.indexOf(trackId) + 1]
      );
    }

    res.status(201).json({ message: 'Playlist created' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

router.get('/playlists', authAdmin, async (req, res) => {
  try {
    const [playlists] = await pool.query('SELECT * FROM Playlist');

    const [trackLinks] = await pool.query(`
      SELECT pt.PlaylistID, t.TrackID, t.Title, t.Duration
      FROM PlaylistTrack pt
      JOIN Track t ON pt.TrackID = t.TrackID
      ORDER BY pt.PlaylistID, pt.TrackOrder
    `);

    const playlistMap = playlists.map(pl => ({
      ...pl,
      tracks: trackLinks.filter(t => t.PlaylistID === pl.PlaylistID)
    }));

    res.json(playlistMap);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

router.get('/summary', authAdmin, async (req, res) => {
  try {
    const [[{ count: artists }]] = await pool.query('SELECT COUNT(*) as count FROM Artist');
    const [[{ count: albums }]] = await pool.query('SELECT COUNT(*) as count FROM Album');
    const [[{ count: tracks }]] = await pool.query('SELECT COUNT(*) as count FROM Track');
    const [[{ count: playlists }]] = await pool.query('SELECT COUNT(*) as count FROM Playlist');
    res.json({ artists, albums, tracks, playlists });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching summary' });
  }
});

router.get('/recent-activity', authAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 'Track' AS entity, Title AS name, CreatedAt AS timestamp, 'Added' AS action FROM Track
      UNION
      SELECT 'Album', Title, CreatedAt, 'Added' FROM Album
      UNION
      SELECT 'Artist', Name, CreatedAt, 'Added' FROM Artist
      UNION
      SELECT 'Playlist', Name, DateCreated, 'Created' FROM Playlist
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    res.json(rows.map(r => ({
      activity: `${r.action} ${r.entity}: ${r.name}`,
      timestamp: new Date(r.timestamp).toLocaleString(),
    })));    
  } catch (err) {
    res.status(500).json({ message: 'Error fetching activity' });
  }
});

const bcrypt = require('bcryptjs');

router.post('/change-password', authAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const [rows] = await pool.query('SELECT Password FROM User WHERE UserID = ?', [userId]);
    const user = rows[0];
    const valid = await bcrypt.compare(oldPassword, user.Password);

    if (!valid) return res.status(401).json({ message: 'Incorrect current password' });

    const newHashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE User SET Password = ? WHERE UserID = ?', [newHashed, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Artist
router.put('/update-artist/:id', authAdmin, async (req, res) => {
  const { name, biography } = req.body;
  try {
    await pool.query('UPDATE Artist SET Name = ?, Biography = ? WHERE ArtistID = ?', [name, biography, req.params.id]);
    res.json({ message: 'Artist updated successfully' });
  } catch (err) {
    console.error('Update artist error:', err.message);
    res.status(500).json({ message: 'Server error updating artist' });
  }
});

router.put('/update-album/:id', authAdmin, async (req, res) => {
  const { title, releaseYear } = req.body;
  try {
    await pool.query('UPDATE Album SET Title = ?, ReleaseYear = ? WHERE AlbumID = ?', [title, releaseYear, req.params.id]);
    res.json({ message: 'Album updated successfully' });
  } catch (err) {
    console.error('Update album error:', err.message);
    res.status(500).json({ message: 'Server error updating album' });
  }
});

router.put('/update-track/:id', authAdmin, async (req, res) => {
  const { title, duration } = req.body;
  try {
    await pool.query('UPDATE Track SET Title = ?, Duration = ? WHERE TrackID = ?', [title, duration, req.params.id]);
    res.json({ message: 'Track updated successfully' });
  } catch (err) {
    console.error('Update track error:', err.message);
    res.status(500).json({ message: 'Server error updating track' });
  }
});

router.put('/update-playlist-order/:id', authAdmin, async (req, res) => {
  const playlistId = req.params.id;
  const { trackOrder } = req.body;

  try {
    const updates = trackOrder.map(({ TrackID, TrackOrder }) => {
      return pool.query(
        'UPDATE PlaylistTrack SET TrackOrder = ? WHERE PlaylistID = ? AND TrackID = ?',
        [TrackOrder, playlistId, TrackID]
      );
    });

    await Promise.all(updates);
    res.json({ message: 'Track order updated' });
  } catch (err) {
    console.error('Update order error:', err.message);
    res.status(500).json({ message: 'Error updating order' });
  }
});

router.delete('/remove-track-from-playlist/:playlistId/:trackId', authAdmin, async (req, res) => {
  const { playlistId, trackId } = req.params;
  try {
    await pool.query(
      'DELETE FROM PlaylistTrack WHERE PlaylistID = ? AND TrackID = ?',
      [playlistId, trackId]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Remove track error:', err.message);
    res.status(500).json({ message: 'Error removing track from playlist' });
  }
});

router.post('/add-track-to-playlist', authAdmin, async (req, res) => {
  const { playlistId, trackId } = req.body;

  if (!playlistId || !trackId) {
    return res.status(400).json({ message: 'Missing playlistId or trackId' });
  }

  try {
    await pool.query(
      'INSERT INTO PlaylistTrack (PlaylistID, TrackID, TrackOrder, AddedDate) VALUES (?, ?, ?, NOW())',
      [playlistId, trackId, 999] // 999 = temporary order, will be re-ordered later
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Add track to playlist error:', err.message);
    res.status(500).json({ message: 'Error adding track to playlist' });
  }
});

router.delete('/delete-playlist/:id', authAdmin, async (req, res) => {
  const playlistId = req.params.id;
  try {
    // First delete tracks linked to the playlist
    await pool.query('DELETE FROM PlaylistTrack WHERE PlaylistID = ?', [playlistId]);
    // Then delete the playlist itself
    await pool.query('DELETE FROM Playlist WHERE PlaylistID = ?', [playlistId]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete playlist error:', err.message);
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

router.post('/add-genre', authAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Genre name is required' });

  try {
    const [result] = await pool.query('INSERT INTO Genre (Name) VALUES (?)', [name]);
    res.json({ GenreID: result.insertId });
  } catch (err) {
    console.error('Add genre error:', err.message);
    res.status(500).json({ message: 'Error creating genre' });
  }
});

router.put('/update-playlist/:id', authAdmin, async (req, res) => {
  const { name } = req.body;
  const playlistId = req.params.id;

  if (!name) {
    return res.status(400).json({ message: 'Playlist name is required' });
  }

  try {
    await pool.query('UPDATE Playlist SET Name = ? WHERE PlaylistID = ?', [name, playlistId]);
    res.json({ message: 'Playlist name updated successfully' });
  } catch (err) {
    console.error('Update playlist error:', err.message);
    res.status(500).json({ message: 'Error updating playlist name' });
  }
});

module.exports = router;
