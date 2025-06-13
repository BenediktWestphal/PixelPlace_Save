const express = require('express');
const router = express.Router();
const { query } = require('../db');

const PIXEL_COOLDOWN_MS = 10 * 1000; // 10 seconds cooldown period

// GET /api/pixels - Fetch all pixels
router.get('/', async (req, res) => {
  try {
    // Fetch the most recent pixel for each coordinate
    // This query ensures that only the latest color for each (x,y) pair is returned.
    const { rows } = await query(`
      SELECT p.x, p.y, p.color
      FROM pixels p
      INNER JOIN (
        SELECT x, y, MAX(timestamp) as max_timestamp
        FROM pixels
        GROUP BY x, y
      ) pm ON p.x = pm.x AND p.y = pm.y AND p.timestamp = pm.max_timestamp;
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching pixels:', err);
    res.status(500).json({ error: 'Failed to fetch pixels' });
  }
});

// POST /api/pixel - Place or update a pixel
router.post('/', async (req, res) => {
  const { x, y, color, userId } = req.body;
  const ip = req.ip; // Retrieve the user's IP address

  // Basic Input Validation
  if (typeof x !== 'number' || typeof y !== 'number' || !color || !userId) {
    return res.status(400).json({ error: 'Missing or invalid parameters (x, y, color, userId are required).' });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color format. Must be hex (e.g., #RRGGBB).' });
  }
  // Assuming a 10x10 canvas now
  if (x < 0 || x >= 10 || y < 0 || y >= 10) {
    return res.status(400).json({ error: 'Coordinates out of bounds (0-9).' });
  }

  const now = Date.now();

  try {
    // Rate Limiting Check from Database
    const cooldownCheck = await query(
      'SELECT last_pixel_timestamp FROM ip_cooldowns WHERE ip_address = $1',
      [ip]
    );

    if (cooldownCheck.rows.length > 0) {
      const lastPixelTime = new Date(cooldownCheck.rows[0].last_pixel_timestamp).getTime();
      if ((now - lastPixelTime) < PIXEL_COOLDOWN_MS) {
        const timeLeft = Math.ceil((PIXEL_COOLDOWN_MS - (now - lastPixelTime)) / 1000);
        return res.status(429).json({
          error: 'Rate limit exceeded. Try again later.',
          cooldownActive: true,
          timeLeftSec: timeLeft
        });
      }
    }

    // Insert the new pixel event. The GET endpoint will handle showing the latest.
    const { rows } = await query(
      'INSERT INTO pixels (x, y, color, user_id) VALUES ($1, $2, $3, $4) RETURNING id, x, y, color, user_id, timestamp',
      [x, y, color, userId]
    );

    // Update last pixel time for the IP address in the database
    await query(
      `INSERT INTO ip_cooldowns (ip_address, last_pixel_timestamp)
       VALUES ($1, CURRENT_TIMESTAMP)
       ON CONFLICT (ip_address)
       DO UPDATE SET last_pixel_timestamp = CURRENT_TIMESTAMP;`,
      [ip]
    );

    const newPixelData = { x, y, color, userId: rows[0].user_id, timestamp: rows[0].timestamp };

    // Emit the event to all connected clients via Socket.IO
    req.io.emit('pixel_updated', newPixelData);
    console.log('Emitted pixel_updated event:', newPixelData);

    res.status(201).json({ message: 'Pixel updated successfully', pixel: rows[0] });
  } catch (err) {
    console.error('Error updating pixel:', err);
    res.status(500).json({ error: 'Failed to update pixel' });
  }
});

module.exports = router;
