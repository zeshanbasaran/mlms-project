const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function fixAndSeed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { ca: fs.readFileSync(__dirname + '/ca.pem') }
  });

  try {
    console.log('🧹 Cleaning and prepping database...');

    // 🔄 Step 1: Delete duplicate records (Artist, Genre, Album, Track)
    await connection.query(`
      DELETE a1 FROM Artist a1
      JOIN Artist a2 ON a1.Name = a2.Name AND a1.ArtistID > a2.ArtistID;
    `);

    await connection.query(`
      DELETE g1 FROM Genre g1
      JOIN Genre g2 ON g1.Name = g2.Name AND g1.GenreID > g2.GenreID;
    `);

    await connection.query(`
      DELETE al1 FROM Album al1
      JOIN Album al2 ON al1.Title = al2.Title AND al1.ArtistID = al2.ArtistID AND al1.AlbumID > al2.AlbumID;
    `);

    await connection.query(`
      DELETE t1 FROM Track t1
      JOIN Track t2 ON t1.Title = t2.Title AND t1.AlbumID = t2.AlbumID AND t1.TrackID > t2.TrackID;
    `);

    // ✅ Step 2: Add unique constraints safely
    const safeAlter = async (sql) => {
      try {
        await connection.query(sql);
      } catch (err) {
        if (!err.message.includes('Duplicate') && !err.message.includes('already exists')) {
          throw err;
        }
      }
    };

    await safeAlter('ALTER TABLE Artist ADD UNIQUE (Name)');
    await safeAlter('ALTER TABLE Genre ADD UNIQUE (Name)');
    await safeAlter('ALTER TABLE Album ADD UNIQUE KEY unique_album (Title, ArtistID)');
    await safeAlter('ALTER TABLE Track ADD UNIQUE KEY unique_track (Title, AlbumID)');

    console.log('✅ Constraints added and duplicates removed.');

    // 🎵 Genre + artist/album/track data
    const genres = {
      'Hip-Hop': 'Urban genre with rhythmic speech and beats',
      'R&B': 'Rhythm and blues with soulful vocals'
    };
    const genreIDs = {};
    for (const [name, desc] of Object.entries(genres)) {
      await connection.query('INSERT IGNORE INTO Genre (Name, Description) VALUES (?, ?)', [name, desc]);
      const [[{ GenreID }]] = await connection.query('SELECT GenreID FROM Genre WHERE Name = ?', [name]);
      genreIDs[name] = GenreID;
    }

    const data = [
      {
        name: 'Kendrick Lamar',
        bio: 'Pulitzer Prize-winning rapper known for lyrical storytelling.',
        genre: 'Hip-Hop',
        albums: [
          {
            title: 'DAMN.',
            year: 2017,
            tracks: ['DNA.', 'YAH.', 'ELEMENT.', 'HUMBLE.', 'LOVE.']
          },
          {
            title: 'To Pimp a Butterfly',
            year: 2015,
            tracks: ['Wesley\'s Theory', 'King Kunta', 'These Walls', 'Alright', 'Mortal Man']
          }
        ]
      },
      {
        name: 'SZA',
        bio: 'Genre-blending R&B artist known for emotional vulnerability.',
        genre: 'R&B',
        albums: [
          {
            title: 'CTRL',
            year: 2017,
            tracks: ['Supermodel', 'Love Galore', 'Drew Barrymore', 'Broken Clocks', 'The Weekend']
          },
          {
            title: 'SOS',
            year: 2022,
            tracks: ['Kill Bill', 'Nobody Gets Me', 'Good Days', 'Blind', 'Shirt']
          }
        ]
      },
      {
        name: 'Outkast',
        bio: 'Iconic hip-hop duo known for innovation and Southern flavor.',
        genre: 'Hip-Hop',
        albums: [
          {
            title: 'Speakerboxxx/The Love Below',
            year: 2003,
            tracks: ['Hey Ya!', 'The Way You Move', 'GhettoMusick', 'Roses', 'Prototype']
          },
          {
            title: 'ATLiens',
            year: 1996,
            tracks: ['Elevators', 'ATLiens', 'Two Dope Boyz', 'Babylon', 'Wailin']
          }
        ]
      }
    ];

    for (const artist of data) {
      await connection.query(
        'INSERT IGNORE INTO Artist (Name, Biography) VALUES (?, ?)',
        [artist.name, artist.bio]
      );
      const [[{ ArtistID }]] = await connection.query('SELECT ArtistID FROM Artist WHERE Name = ?', [artist.name]);

      for (const album of artist.albums) {
        await connection.query(
          'INSERT IGNORE INTO Album (Title, ReleaseYear, GenreID, ArtistID) VALUES (?, ?, ?, ?)',
          [album.title, album.year, genreIDs[artist.genre], ArtistID]
        );
        const [[{ AlbumID }]] = await connection.query(
          'SELECT AlbumID FROM Album WHERE Title = ? AND ArtistID = ?',
          [album.title, ArtistID]
        );

        for (const title of album.tracks) {
          await connection.query(
            'INSERT IGNORE INTO Track (Title, Duration, FilePath, AlbumID, ArtistID, GenreID) VALUES (?, ?, ?, ?, ?, ?)',
            [
              title,
              '00:03:30',
              `/music/${artist.name.toLowerCase().replace(/ /g, '-')}/${title.toLowerCase().replace(/[^a-z0-9]/gi, '-')}.mp3`,
              AlbumID,
              ArtistID,
              genreIDs[artist.genre]
            ]
          );
        }
      }
    }

    console.log('✅ Database seeded successfully!');
  } catch (err) {
    console.error('❌ Error during seeding:', err.message);
  } finally {
    await connection.end();
  }
}

fixAndSeed();
