// ===========================================
// BLADEOPS — Database Configuration
// ===========================================
const { Pool } = require('pg');
require('dotenv').config();

// Usa DATABASE_URL directamente se disponível (Supabase/cloud)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'bladeops',
      user:     process.env.DB_USER     || 'postgres',
      password: String(process.env.DB_PASSWORD),
      ssl: false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
    });

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Database connected');
  }
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Query [${duration}ms]:`, text.substring(0, 80));
    }
    return res;
  } catch (err) {
    console.error('❌ Query error:', err.message, '\nQuery:', text);
    throw err;
  }
};

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };