const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function seedDatabase() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      ca: fs.readFileSync(__dirname + '/ca.pem')
    }
  };

  const artistsData = [
    {
      name: "SZA",
      bio: "American singer-songwriter blending R&B, soul, and hip hop.",
      albums: [
        { title: "Ctrl", year: 2017, genre: "R&B", songs: ["Love Galore", "The Weekend", "Garden"] },
        { title: "SOS", year: 2022, genre: "R&B", songs: ["Nobody Gets Me", "Ghost in the Machine", "Gone Girl"] }
      ]
    },
    {
      name: "Tyler the Creator",
      bio: "Innovative rapper and producer known for blending genres.",
      albums: [
        { title: "Flower Boy", year: 2017, genre: "Hip Hop", songs: ["See You Again", "Boredom", "Garden Shed"] },
        { title: "IGOR", year: 2019, genre: "Alternative", songs: ["EARFQUAKE", "I THINK", "GONE, GONE / THANK YOU"] }
      ]
    },
    {
      name: "Bad Bunny",
      bio: "Puerto Rican artist redefining Latin trap and reggaeton.",
      albums: [
        { title: "YHLQMDLG", year: 2020, genre: "Reggaeton", songs: ["Si Veo a Tu Mamá", "La Santa", "Solía"] },
        { title: "Un Verano Sin Ti", year: 2022, genre: "Latin", songs: ["Ojitos Lindos", "Tití Me Preguntó", "Un Ratito"] }
      ]
    },
    {
      name: "Kendrick Lamar",
      bio: "Critically acclaimed rapper exploring social themes and storytelling.",
      albums: [
        { title: "DAMN.", year: 2017, genre: "Hip Hop", songs: ["LOVE.", "LOYALTY.", "FEAR."] },
        { title: "good kid, m.A.A.d city", year: 2012, genre: "Hip Hop", songs: ["Poetic Justice", "Sing About Me", "Real"] }
      ]
    },
    {
      name: "Doechii",
      bio: "Genre-defying artist blending rap and alternative pop.",
      albums: [
        { title: "Alligator Bites Never Heal", year: 2024, genre: "Rap", songs: ["DENIAL IS A RIVER", "CATFISH", "NISSAN ALTIMA"] },
        { title: "oh the places you'll go", year: 2020, genre: "Alternative", songs: ["Yucky Blucky Fruitcake", "Black Girl Memoir", "Girls"] }
      ]
    },
    {
      name: "Chappell Roan",
      bio: "Pop artist with theatrical flair and empowering lyrics.",
      albums: [
        { title: "The Rise and Fall of a Midwest Princess", year: 2023, genre: "Pop", songs: ["Red Wine Supernova", "Pink Pony Club", "Good Luck, Babe!"] },
        { title: "School Nights", year: 2020, genre: "Pop", songs: ["Love Me Anyway", "Meant to Be", "California"] }
      ]
    },
    {
      name: "Hozier",
      bio: "Irish singer-songwriter known for soulful, poetic music.",
      albums: [
        { title: "Hozier", year: 2014, genre: "Alternative", songs: ["From Eden", "Cherry Wine", "Jackie and Wilson"] },
        { title: "Wasteland, Baby!", year: 2019, genre: "Alternative", songs: ["Almost (Sweet Music)", "Shrike", "Movement"] }
      ]
    }
  ];

  const connection = await mysql.createConnection(config);
  console.log("✅ Connected");

  for (const artist of artistsData) {
    const [artistResult] = await connection.execute(
      'INSERT INTO Artist (Name, Biography) VALUES (?, ?)',
      [artist.name, artist.bio]
    );
    const artistId = artistResult.insertId;

    for (const album of artist.albums) {
      const [genreResult] = await connection.execute(
        'INSERT IGNORE INTO Genre (Name, Description) VALUES (?, ?)',
        [album.genre, `${album.genre} genre`]
      );
      const [genreRow] = await connection.execute(
        'SELECT GenreID FROM Genre WHERE Name = ?',
        [album.genre]
      );
      const genreId = genreRow[0].GenreID;

      const [albumResult] = await connection.execute(
        'INSERT INTO Album (Title, ReleaseYear, ArtistID, GenreID) VALUES (?, ?, ?, ?)',
        [album.title, album.year, artistId, genreId]
      );
      const albumId = albumResult.insertId;

      for (const song of album.songs) {
        await connection.execute(
          'INSERT INTO Track (Title, Duration, FilePath, AlbumID, ArtistID, GenreID) VALUES (?, ?, ?, ?, ?, ?)',
          [song, '03:00', `/music/${song}.mp3`, albumId, artistId, genreId]
        );
      }
    }
  }

  await connection.end();
  console.log("🎵 Music database seeded successfully!");
}

seedDatabase().catch(err => console.error("❌ Error:", err));
