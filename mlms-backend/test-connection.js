const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function testConnection() {
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

  console.log("Connecting to DB with config:", config);

  try {
    const connection = await mysql.createConnection(config);
    const [rows] = await connection.query('SELECT NOW() AS now');
    console.log("✅ Connected! Current time:", rows[0].now);
    await connection.end();
  } catch (err) {
    console.error("❌ Connection failed:", err);
  }
}

testConnection();
