const express = require('express');
const router = express.Router();
const { query } = require('../db');

// In-memory store for rate limiting: stores the last pixel placement timestamp for each user ID.
// { [userId: string]: timestamp }
// Note: For a production application with multiple server instances or requiring persistence
// across restarts, an external store like Redis would be more appropriate.
const ipLastPixelTime = {};
const PIXEL_COOLDOWN_MS = 10 * 1000; // 10 seconds cooldown period
const ADMIN_PIXEL_COOLDOWN_MS = 1 * 1000; // 1 second cooldown for admins

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
  const { x, y, color, userId, isAdmin } = req.body; // Destructure isAdmin
  const ip = req.ip; // Get user's IP address

  // Basic Input Validation
  if (typeof x !== 'number' || typeof y !== 'number' || !color || !userId) {
    return res.status(400).json({ error: 'Missing or invalid parameters (x, y, color, userId are required).' });
  }
  // Additional check for userId format if provided
  if (userId && typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId format. Must be a string.' });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color format. Must be hex (e.g., #RRGGBB).' });
  }
  // Assuming a 10x10 canvas now
  if (x < 0 || x >= 100 || y < 0 || y >= 100) {
    return res.status(400).json({ error: 'Coordinates out of bounds (0-99).' });
  }

  // Rate Limiting Check
  const now = Date.now();
  const currentCooldownMs = isAdmin ? ADMIN_PIXEL_COOLDOWN_MS : PIXEL_COOLDOWN_MS; // Determine cooldown

  if (ipLastPixelTime[ip] && (now - ipLastPixelTime[ip] < currentCooldownMs)) {
    const timeLeft = Math.ceil((currentCooldownMs - (now - ipLastPixelTime[ip])) / 1000);
    return res.status(429).json({
      error: 'Rate limit exceeded. Try again later.',
      cooldownActive: true,
      timeLeftSec: timeLeft,
      cooldownMs: currentCooldownMs // Inform client about the specific cooldown
    });
  }

  try {
    // Insert the new pixel event. The GET endpoint will handle showing the latest.
    const { rows } = await query(
      'INSERT INTO pixels (x, y, color, user_id, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING id, x, y, color, user_id, ip_address, timestamp',
      [x, y, color, userId, ip]
    );

    ipLastPixelTime[ip] = now; // Update last pixel time for the IP after successful placement

    // Ensure newPixelData includes all relevant fields from the database response
    const newPixelData = {
      x: rows[0].x,
      y: rows[0].y,
      color: rows[0].color,
      userId: rows[0].user_id,
      ip_address: rows[0].ip_address, // Include ip_address
      timestamp: rows[0].timestamp
    };

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
