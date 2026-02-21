const mysql = require('mysql2');
require('dotenv').config();

console.log('Attempting to connect to database...');
console.log('DB Config:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  // Password not printed
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Promise-wrapped pool export karo
const promisePool = pool.promise();

// Simple test query se connection check karo (retry ke saath)
async function testConnection(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await promisePool.query('SELECT 1');  // Simple test query
      console.log('✅ Connected to database successfully!');
      return;
    } catch (err) {
      console.error(`❌ Connection attempt ${i + 1} failed:`, err.message);
      if (i === retries - 1) {
        console.error('❌ Failed to connect after retries:', err);
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5;
    }
  }
}

testConnection().catch(() => {});  // Fire and forget, app exit karega agar fail

module.exports = promisePool;  // Yeh export karo, pool.promise() nahi