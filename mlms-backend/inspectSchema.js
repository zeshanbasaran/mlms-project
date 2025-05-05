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

  const connection = await mysql.createConnection(config);
  console.log("✅ Connected");

  try {
    const [tables] = await connection.query(`SHOW TABLES`);
    const tableKey = Object.keys(tables[0])[0]; // dynamic key like "Tables_in_yourdbname"

    for (const row of tables) {
      const tableName = row[tableKey];
      console.log(`\n📄 Table: ${tableName}`);

      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
      columns.forEach(col => {
        console.log(`  • ${col.Field} (${col.Type})${col.Key ? ' [' + col.Key + ']' : ''}`);
      });
    }
  } catch (err) {
    console.error('❌ Error reading schema:', err.message);
  } finally {
    await connection.end();
    console.log("\n✅ Done inspecting schema");
  }
}

seedDatabase().catch(err => console.error('❌ Fatal error:', err));
