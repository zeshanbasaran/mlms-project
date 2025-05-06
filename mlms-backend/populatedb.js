const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function seedTracks() {
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

  const genres = [
    { id: 1, name: 'R&B', description: 'Rhythm and Blues' },
    { id: 2, name: 'Pop', description: 'Popular music' },
    { id: 3, name: 'Folk', description: 'Folk and indie acoustic' },
    { id: 4, name: 'Hip Hop', description: 'Hip hop and underground rap' },
    { id: 5, name: 'Rap', description: 'Rap and Southern hip hop' },
    { id: 6, name: 'Indie Rock', description: 'Alternative and indie rock' },
    { id: 7, name: 'Soul', description: 'Soul and blues' },
    { id: 8, name: 'Southern Rock', description: 'Southern and country rock' },
  ];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Insert genres
    for (const genre of genres) {
      await connection.query(
        `INSERT IGNORE INTO genres (genre_id, name, description, created_at)
         VALUES (?, ?, ?, ?)`,
        [genre.id, genre.name, genre.description, now]
      );
    }

    const artists = [
      {
        name: 'SZA',
        genre_id: 1,
        albums: [
          {
            title: 'Ctrl',
            release_year: 2017,
            tracks: [
              'Supermodel',
              'Love Galore',
              'Doves in the Wind',
              'Drew Barrymore',
              'Prom',
            ],
          },
          {
            title: 'SOS',
            release_year: 2022,
            tracks: [
              'SOS',
              'Kill Bill',
              'Seek & Destroy',
              'Low',
              'Love Language',
            ],
          },
        ],
      },
      {
        name: 'Chappell Roan',
        genre_id: 2,
        albums: [
          {
            title: 'The Rise and Fall of a Midwest Princess',
            release_year: 2023,
            tracks: [
              'Femininomenon',
              'Red Wine Supernova',
              'After Midnight',
              'Coffee',
              'Casual',
            ],
          },
          {
            title: 'School Nights',
            release_year: 2017,
            tracks: [
              'Die Young',
              'Good Hurt',
              'Meantime',
              'Sugar High',
              'Bad for You',
            ],
          },
        ],
      },
      {
        name: 'Noah Kahan',
        genre_id: 3,
        albums: [
          {
            title: 'Stick Season',
            release_year: 2022,
            tracks: [
              'Northern Attitude',
              'Stick Season',
              'All My Love',
              'She Calls Me Back',
              'Come Over',
            ],
          },
          {
            title: 'Busyhead',
            release_year: 2019,
            tracks: [
              'False Confidence',
              'Mess',
              'Hurt Somebody',
              'Young Blood',
              'Busyhead',
            ],
          },
        ],
      },
      {
        name: 'MF DOOM',
        genre_id: 4,
        albums: [
          {
            title: 'MM..FOOD',
            release_year: 2004,
            tracks: [
              'Beef Rapp',
              'Hoe Cakes',
              'Potholderz',
              'One Beer',
              'Deep Fried Frenz',
            ],
          },
          {
            title: 'Operation: Doomsday',
            release_year: 1999,
            tracks: [
              'Doomsday',
              'Rhymes Like Dimes',
              'The Finest',
              'Go With The Flow',
              'Tick, Tick…',
            ],
          },
        ],
      },
      {
        name: 'Outkast',
        genre_id: 5,
        albums: [
          {
            title: 'Stankonia',
            release_year: 2000,
            tracks: [
              'Gasoline Dreams',
              'So Fresh, So Clean',
              'Ms. Jackson',
              'B.O.B.',
              'Humble Mumble',
            ],
          },
          {
            title: 'Aquemini',
            release_year: 1998,
            tracks: [
              'Hold On, Be Strong',
              'Return of the "G"',
              'Rosa Parks',
              'Skew It on the Bar-B',
              'Aquemini',
            ],
          },
        ],
      },
      {
        name: 'Mitski',
        genre_id: 6,
        albums: [
          {
            title: 'Be the Cowboy',
            release_year: 2018,
            tracks: [
              'Geyser',
              'Why Didn’t You Stop Me?',
              'Old Friend',
              'A Pearl',
              'Lonesome Love',
            ],
          },
          {
            title: 'Laurel Hell',
            release_year: 2022,
            tracks: [
              'Valentine, Texas',
              'Working for the Knife',
              'Stay Soft',
              'Everyone',
              'Heat Lightning',
            ],
          },
        ],
      },
      {
        name: 'Hozier',
        genre_id: 7,
        albums: [
          {
            title: 'Hozier',
            release_year: 2014,
            tracks: [
              'Take Me to Church',
              'Angel of Small Death and the Codeine Scene',
              'Jackie and Wilson',
              'Someone New',
              'Work Song',
            ],
          },
          {
            title: 'Wasteland, Baby!',
            release_year: 2019,
            tracks: [
              'Nina Cried Power',
              'Almost (Sweet Music)',
              'Movement',
              'No Plan',
              'Nobody',
            ],
          },
        ],
      },
      {
        name: 'The Red Clay Strays',
        genre_id: 8,
        albums: [
          {
            title: 'Moment of Truth',
            release_year: 2022,
            tracks: [
              'Stone’s Throw',
              'Moment of Truth',
              'Do Me Wrong',
              'Wondering Why',
              'Forgive',
            ],
          },
          {
            title: 'Made by These Moments',
            release_year: 2024,
            tracks: [
              'Heavy Heart',
              'Ghosts',
              'She’s No Good',
              'Don’t Care',
              'Sunshine',
            ],
          },
        ],
      },
    ];

    let artist_id = 1;
    let album_id = 1;
    let track_id = 1;

    for (const artist of artists) {
      await connection.query(
        `INSERT INTO artists (artist_id, name, biography, created_at) VALUES (?, ?, ?, ?)`,
        [artist_id, artist.name, `${artist.name} biography`, now]
      );

      for (const album of artist.albums) {
        await connection.query(
          `INSERT INTO albums (album_id, artist_id, genre_id, title, release_year, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [album_id, artist_id, artist.genre_id, album.title, album.release_year, now]
        );

        for (const trackTitle of album.tracks) {
          await connection.query(
            `INSERT INTO tracks (track_id, title, duration_seconds, file_path, album_id, artist_id, genre_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [track_id, trackTitle, 180, null, album_id, artist_id, artist.genre_id, now]
          );
          track_id++;
        }
        album_id++;
      }

      artist_id++;
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🎵 Data seeded successfully!');
    await connection.end();
  } catch (err) {
    console.error('❌ Error inserting tracks:', err);
    await connection.end();
  }
}

seedTracks();
