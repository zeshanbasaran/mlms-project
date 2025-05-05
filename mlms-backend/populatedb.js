const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function seedArtists() {
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
    const tables = ['PlaybackHistory', 'DownloadHistory', 'SearchHistory', 'LikedSongs', 'PlaylistTrack', 'Playlist', 'Track', 'Album', 'Artist', 'User'];
    for (const table of tables) {
      await connection.query(`DELETE FROM ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🗑️ Cleared all tables');

    const data = [
      {
        name: 'Kendrick Lamar',
        bio: 'American rapper and songwriter known for his powerful lyrics and storytelling.',
        albums: [
          {
            title: 'good kid, m.A.A.d city',
            year: 2012,
            genre: 'Hip Hop',
            songs: ['Poetic Justice', "Sing About Me, I'm Dying of Thirst", 'Money Trees']
          },
          {
            title: 'DAMN.',
            year: 2017,
            genre: 'Hip Hop',
            songs: ['LOYALTY.', 'PRIDE.', 'LOVE.']
          }
        ]
      },
      {
        name: 'SZA',
        bio: 'American singer-songwriter blending R&B, soul, and hip hop.',
        albums: [
          {
            title: 'Ctrl',
            year: 2017,
            genre: 'R&B',
            songs: ['Love Galore', 'The Weekend', 'Garden']
          },
          {
            title: 'SOS',
            year: 2022,
            genre: 'R&B',
            songs: ['Nobody Gets Me', 'Ghost in the Machine', 'Gone Girl']
          }
        ]
      },
      {
        name: 'The Lumineers',
        bio: 'American folk rock band known for their heartfelt lyrics and acoustic sound.',
        albums: [
          {
            title: 'The Lumineers',
            year: 2012,
            genre: 'Folk Rock',
            songs: ['Ho Hey', 'Stubborn Love', 'Flowers in Your Hair']
          },
          {
            title: 'Cleopatra',
            year: 2016,
            genre: 'Folk Rock',
            songs: ['Ophelia', 'Angela', 'Sleep on the Floor']
          }
        ]
      },
      {
        name: 'Chappell Roan',
        bio: 'American pop singer and songwriter with theatrical and emotional pop anthems.',
        albums: [
          {
            title: 'The Rise and Fall of a Midwest Princess',
            year: 2023,
            genre: 'Pop',
            songs: ['Pink Pony Club', 'Casual', 'Kaleidoscope']
          },
          {
            title: 'Roan & On',
            year: 2024,
            genre: 'Pop',
            songs: ['Naked in Manhattan', 'Super Graphic Ultra Modern Girl', 'Red Wine Supernova']
          }
        ]
      },
      {
        name: 'Noah Kahan',
        bio: 'American singer-songwriter known for introspective folk-pop ballads.',
        albums: [
          {
            title: 'Stick Season',
            year: 2022,
            genre: 'Folk Pop',
            songs: ['Stick Season', 'Homesick', 'Everywhere, Everything']
          },
          {
            title: 'Busyhead',
            year: 2019,
            genre: 'Folk Pop',
            songs: ['Mess', 'False Confidence', 'Young Blood']
          }
        ]
      }
    ];

    for (const artist of data) {
      const [artistResult] = await connection.execute(
        'INSERT INTO Artist (Name, Biography, CreatedAt) VALUES (?, ?, NOW())',
        [artist.name, artist.bio]
      );
      const artistId = artistResult.insertId;

      for (const album of artist.albums) {
        await connection.execute(
          'INSERT IGNORE INTO Genre (Name, Description) VALUES (?, ?)',
          [album.genre, `${album.genre} music`]
        );

        const [[{ GenreID }]] = await connection.execute(
          'SELECT GenreID FROM Genre WHERE Name = ?',
          [album.genre]
        );

        const [albumResult] = await connection.execute(
          'INSERT INTO Album (Title, ReleaseYear, ArtistID, GenreID, CreatedAt) VALUES (?, ?, ?, ?, NOW())',
          [album.title, album.year, artistId, GenreID]
        );
        const albumId = albumResult.insertId;

        for (const song of album.songs) {
          await connection.execute(
            'INSERT INTO Track (Title, Duration, file_path, AlbumID, ArtistID, GenreID, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [song, '03:00', `/music/${song}.mp3`, albumId, artistId, GenreID]
          );
          console.log(`🎵 Inserted: ${song}`);
        }
      }
    }

    console.log('✅ Database seeded with artists and tracks');
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
  } finally {
    await connection.end();
    console.log('🔚 Connection closed');
  }
}

seedArtists();
