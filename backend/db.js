const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    // Check if the pixels table exists
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'pixels'
      );
    `);

    if (!res.rows[0].exists) {
      // Create the pixels table if it doesn't exist
      await client.query(`
        CREATE TABLE pixels (
          id SERIAL PRIMARY KEY,
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          color VARCHAR(7) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Pixels table created successfully.');

      // Optional: Add an index for faster lookups by coordinates
      await client.query('CREATE INDEX IF NOT EXISTS idx_pixels_coordinates ON pixels (x, y);');
      console.log('Index on x, y coordinates created.');
    } else {
      console.log('Pixels table already exists.');
    }

    // Initialize the IP cooldowns table
    await initCooldownTable(client);

  } catch (err) {
    console.error('Error initializing database:', err);
    // It's often better to let the application fail fast if DB setup fails
    process.exit(1);
  } finally {
    client.release();
  }
};

// Function to initialize the ip_cooldowns table
const initCooldownTable = async (client) => {
  try {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ip_cooldowns'
      );
    `);

    if (!res.rows[0].exists) {
      await client.query(`
        CREATE TABLE ip_cooldowns (
          ip_address TEXT PRIMARY KEY,
          last_pixel_timestamp TIMESTAMPTZ NOT NULL
        );
      `);
      console.log('ip_cooldowns table created successfully.');
    } else {
      console.log('ip_cooldowns table already exists.');
    }
  } catch (err) {
    // Log the error but don't exit the process,
    // as the main table (pixels) might be more critical.
    console.error('Error initializing ip_cooldowns table:', err);
    // Depending on requirements, you might want to re-throw or handle differently
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDB,
  pool, // Export pool for potential direct use if needed
  // initCooldownTable is not exported as it's only used internally by initDB
};
