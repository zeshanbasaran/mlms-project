const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { ca: fs.readFileSync(__dirname + '/ca.pem') }
  });

  try {
    console.log('✅ Connected. Seeding data...');

    // Genre setup
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

    // Artists + Albums + Tracks
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
      await connection.query('INSERT INTO Artist (Name, Biography) VALUES (?, ?)', [artist.name, artist.bio]);
      const [[{ ArtistID }]] = await connection.query('SELECT ArtistID FROM Artist WHERE Name = ?', [artist.name]);

      for (const album of artist.albums) {
        await connection.query(
          'INSERT INTO Album (Title, ReleaseYear, GenreID, ArtistID) VALUES (?, ?, ?, ?)',
          [album.title, album.year, genreIDs[artist.genre], ArtistID]
        );
        const [[{ AlbumID }]] = await connection.query(
          'SELECT AlbumID FROM Album WHERE Title = ? AND ArtistID = ?',
          [album.title, ArtistID]
        );

        for (const title of album.tracks) {
          await connection.query(
            'INSERT INTO Track (Title, Duration, FilePath, AlbumID, ArtistID, GenreID) VALUES (?, ?, ?, ?, ?, ?)',
            [title, '00:03:30', `/music/${artist.name.toLowerCase().replace(/ /g, '-')}/${title.toLowerCase().replace(/ /g, '-')}.mp3`, AlbumID, ArtistID, genreIDs[artist.genre]]
          );
        }
      }
    }

    console.log('✅ Database seeded successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await connection.end();
  }
}

seed();
