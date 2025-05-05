const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function fetchPlaylistsWithTracks() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      ca: fs.readFileSync(__dirname + '/ca.pem'),
    },
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');

    const [playlists] = await connection.query(`
      SELECT p.playlist_id, p.name, p.created_at
      FROM Playlist p
      ORDER BY p.created_at DESC
    `);

    for (const playlist of playlists) {
      const [tracks] = await connection.query(`
        SELECT 
          t.track_id, t.title, t.duration, 
          al.Title AS album_title,
          ar.Name AS artist_name,
          g.Name AS genre_name
        FROM PlaylistTrack pt
        JOIN Track t ON pt.track_id = t.track_id
        LEFT JOIN Album al ON t.AlbumID = al.AlbumID
        LEFT JOIN Artist ar ON t.ArtistID = ar.ArtistID
        LEFT JOIN Genre g ON t.GenreID = g.GenreID
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC
      `, [playlist.playlist_id]);

      playlist.tracks = tracks;
    }

    console.log('🎧 Playlists with tracks:', JSON.stringify(playlists, null, 2));
    await connection.end();
    console.log('🔚 Connection closed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

fetchPlaylistsWithTracks();
