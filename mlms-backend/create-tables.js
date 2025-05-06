const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function createTables() {
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

  const connection = await mysql.createConnection(config);
  console.log('✅ Connected to database');

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const tableStatements = [
        // USERS
        `CREATE TABLE IF NOT EXISTS users (
          user_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100),
          email VARCHAR(150) UNIQUE,
          password_hash VARCHAR(255),
          role ENUM('admin', 'regular_user') DEFAULT 'regular_user',
          last_login_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      
        // SUBSCRIPTIONS
        `CREATE TABLE IF NOT EXISTS subscriptions (
          subscription_id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          subscription_type VARCHAR(50),
          start_date DATE,
          end_date DATE,
          is_active BOOLEAN DEFAULT true,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`,
      
        // ARTISTS
        `CREATE TABLE IF NOT EXISTS artists (
          artist_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) UNIQUE,
          biography TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      
        // GENRES
        `CREATE TABLE IF NOT EXISTS genres (
          genre_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(50) UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      
        // ALBUMS
        `CREATE TABLE IF NOT EXISTS albums (
          album_id INT PRIMARY KEY AUTO_INCREMENT,
          artist_id INT,
          genre_id INT,
          title VARCHAR(100),
          release_year YEAR,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (artist_id) REFERENCES artists(artist_id),
          FOREIGN KEY (genre_id) REFERENCES genres(genre_id)
        )`,
      
        // TRACKS
        `CREATE TABLE IF NOT EXISTS tracks (
          track_id INT PRIMARY KEY AUTO_INCREMENT,
          title VARCHAR(255),
          duration_seconds INT,
          file_path TEXT,
          album_id INT,
          artist_id INT,
          genre_id INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (album_id) REFERENCES albums(album_id),
          FOREIGN KEY (artist_id) REFERENCES artists(artist_id),
          FOREIGN KEY (genre_id) REFERENCES genres(genre_id)
        )`,
      
        // PLAYLISTS
        `CREATE TABLE IF NOT EXISTS playlists (
          playlist_id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          name VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`,
      
        // PLAYLIST_TRACKS
        `CREATE TABLE IF NOT EXISTS playlist_tracks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          playlist_id INT,
          track_id INT,
          track_order INT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id),
          FOREIGN KEY (track_id) REFERENCES tracks(track_id)
        )`,
      
        // LIKED_TRACKS
        `CREATE TABLE IF NOT EXISTS liked_tracks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          track_id INT,
          liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (track_id) REFERENCES tracks(track_id)
        )`,
      
        // SEARCH_HISTORY
        `CREATE TABLE IF NOT EXISTS search_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          search_query TEXT,
          searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`,
      
        // PLAYBACK_HISTORY
        `CREATE TABLE IF NOT EXISTS playback_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          track_id INT,
          played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (track_id) REFERENCES tracks(track_id)
        )`,
      
        // DOWNLOAD_HISTORY
        `CREATE TABLE IF NOT EXISTS download_history (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          track_id INT,
          downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (track_id) REFERENCES tracks(track_id)
        )`,
      
        // USER_ACTIVITY
        `CREATE TABLE IF NOT EXISTS user_activity (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          activity VARCHAR(255),
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`
      ];      

    for (const stmt of tableStatements) {
      await connection.query(stmt);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ All tables created');
  } catch (err) {
    console.error('❌ Table creation error:', err.message);
  } finally {
    await connection.end();
    console.log('🔚 Connection closed');
  }
}

createTables();
