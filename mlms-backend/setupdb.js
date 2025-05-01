const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      ca: fs.readFileSync(__dirname + '/ca.pem') // comment this out if not using SSL cert
    }
  });

  try {
    console.log('Connected to the database.');

    // Create tables in correct order
    await connection.query(`
      CREATE TABLE IF NOT EXISTS User (
        UserID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(100) NOT NULL,
        Email VARCHAR(100) NOT NULL UNIQUE,
        Password VARCHAR(255) NOT NULL,
        Role ENUM('admin', 'user') DEFAULT 'user',
        LastLoginDate DATETIME
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Artist (
        ArtistID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(100) NOT NULL,
        Biography TEXT
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Genre (
        GenreID INT AUTO_INCREMENT PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Description TEXT
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Album (
        AlbumID INT AUTO_INCREMENT PRIMARY KEY,
        ArtistID INT,
        GenreID INT,
        Title VARCHAR(100) NOT NULL,
        ReleaseYear YEAR,
        FOREIGN KEY (ArtistID) REFERENCES Artist(ArtistID),
        FOREIGN KEY (GenreID) REFERENCES Genre(GenreID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Track (
        TrackID INT AUTO_INCREMENT PRIMARY KEY,
        AlbumID INT,
        ArtistID INT,
        GenreID INT,
        Title VARCHAR(100) NOT NULL,
        Duration TIME,
        FilePath VARCHAR(255),
        FOREIGN KEY (AlbumID) REFERENCES Album(AlbumID),
        FOREIGN KEY (ArtistID) REFERENCES Artist(ArtistID),
        FOREIGN KEY (GenreID) REFERENCES Genre(GenreID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Subscription (
        SubscriptionID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT,
        Type VARCHAR(50),
        StartDate DATE,
        EndDate DATE,
        IsActive BOOLEAN,
        FOREIGN KEY (UserID) REFERENCES User(UserID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS SearchHistory (
        SearchID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT,
        SearchQuery VARCHAR(255),
        SearchTime DATETIME,
        FOREIGN KEY (UserID) REFERENCES User(UserID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS PlaybackHistory (
        PlaybackID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT,
        TrackID INT,
        Timestamp DATETIME,
        FOREIGN KEY (UserID) REFERENCES User(UserID),
        FOREIGN KEY (TrackID) REFERENCES Track(TrackID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS LikedSongs (
        UserID INT,
        TrackID INT,
        LikedDate DATETIME,
        PRIMARY KEY (UserID, TrackID),
        FOREIGN KEY (UserID) REFERENCES User(UserID),
        FOREIGN KEY (TrackID) REFERENCES Track(TrackID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS DownloadHistory (
        DownloadID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT,
        TrackID INT,
        DownloadDate DATETIME,
        FOREIGN KEY (UserID) REFERENCES User(UserID),
        FOREIGN KEY (TrackID) REFERENCES Track(TrackID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS Playlist (
        PlaylistID INT AUTO_INCREMENT PRIMARY KEY,
        UserID INT,
        Name VARCHAR(100),
        DateCreated DATE,
        FOREIGN KEY (UserID) REFERENCES User(UserID)
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS PlaylistTrack (
        PlaylistID INT,
        TrackID INT,
        TrackOrder INT,
        AddedDate DATETIME,
        PRIMARY KEY (PlaylistID, TrackID),
        FOREIGN KEY (PlaylistID) REFERENCES Playlist(PlaylistID),
        FOREIGN KEY (TrackID) REFERENCES Track(TrackID)
      );
    `);

    console.log('✅ All tables created successfully.');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

setupDatabase();
