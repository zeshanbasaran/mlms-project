const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkLibraryContents() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to database\n');

  try {
    // Check Artists
    const [artists] = await connection.query('SELECT * FROM artists ORDER BY artist_id');
    console.log('🎤 Artists:');
    artists.forEach(a => console.log(`- ${a.artist_id}: ${a.name}`));

    // Check Albums with Artist info
    const [albums] = await connection.query(`
      SELECT albums.album_id, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
      FROM albums
      LEFT JOIN artists ON albums.artist_id = artists.artist_id
      ORDER BY albums.album_id
    `);
    console.log('\n💿 Albums:');
    albums.forEach(a => {
      console.log(`- ${a.album_id}: ${a.album_title} (Artist ID: ${a.artist_id}, Name: ${a.artist_name || '❌ NOT FOUND'})`);
    });

    // Check Tracks with Album & Artist info
    const [tracks] = await connection.query(`
      SELECT 
        tracks.track_id,
        tracks.title AS track_title,
        tracks.album_id,
        a.title AS album_title,
        tracks.artist_id,
        ar.name AS artist_name
      FROM tracks
      LEFT JOIN albums a ON tracks.album_id = a.album_id
      LEFT JOIN artists ar ON tracks.artist_id = ar.artist_id
      ORDER BY tracks.track_id
    `);
    console.log('\n🎶 Tracks:');
    tracks.forEach(t => {
      console.log(`- ${t.track_id}: ${t.track_title} (Album: ${t.album_title || '❌'}, Artist: ${t.artist_name || '❌'})`);
    });

  } catch (err) {
    console.error('❌ Query error:', err.message);
  } finally {
    await connection.end();
    console.log('\n🔒 Disconnected from database');
  }
}

checkLibraryContents();
