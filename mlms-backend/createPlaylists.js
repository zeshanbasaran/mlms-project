const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function createAdminPlaylists() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      ca: fs.readFileSync(__dirname + '/ca.pem'),
    },
  });

  console.log('✅ Connected to database');

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const adminUserId = 1;
  let playlist_id = 1;

  try {
    // Get 25 random track IDs
    const [tracks] = await connection.query(
      `SELECT track_id FROM tracks ORDER BY RAND() LIMIT 25`
    );

    if (tracks.length < 25) {
      throw new Error('❌ Not enough tracks in the database (need at least 25)');
    }

    // Create 5 playlists, 5 songs each
    for (let i = 0; i < 5; i++) {
      const playlistName = `Admin Picks #${i + 1}`;

      // Insert playlist
      await connection.query(
        `INSERT INTO playlists (playlist_id, user_id, name, created_at)
         VALUES (?, ?, ?, ?)`,
        [playlist_id, adminUserId, playlistName, now]
      );

      // Insert 5 tracks into this playlist
      for (let j = 0; j < 5; j++) {
        const track = tracks[i * 5 + j];
        await connection.query(
          `INSERT INTO playlist_tracks (playlist_id, track_id, track_order, added_at)
           VALUES (?, ?, ?, ?)`,
          [playlist_id, track.track_id, j + 1, now]
        );
      }

      playlist_id++;
    }

    console.log('🎶 Admin playlists created successfully!');
    await connection.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await connection.end();
  }
}

createAdminPlaylists();
