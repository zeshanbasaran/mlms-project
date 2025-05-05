/**
 * MySQL Database Pool Configuration
 * ----------------------------------
 * Uses `mysql2/promise` to create a secure connection pool.
 * Loads credentials and SSL config from environment variables.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

// Create a secure MySQL connection pool using SSL certificate
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(__dirname + '/ca.pem') // Ensure the CA cert file is placed correctly
  }
});

module.exports = pool;
