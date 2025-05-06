const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  console.log('✅ Connected to database');

  const tables = [
    'playlist_tracks',
    'playlists',
    'liked_tracks',
    'download_history',
    'playback_history',
    'tracks',
    'albums',
    'genres',
    'artists',
    'users'
  ];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await connection.query(`DELETE FROM ${table}`);
      console.log(`🗑️  Cleared: ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✅ All specified tables have been cleared.');
  } catch (err) {
    console.error('❌ Error clearing tables:', err.message);
  } finally {
    await connection.end();
    console.log('🔒 Disconnected from database');
  }
}

clearTables();
