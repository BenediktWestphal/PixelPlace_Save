const express = require('express');
const http = require('http'); // Import http module
const { Server } = require("socket.io"); // Import Server from socket.io
const cors = require('cors');
require('dotenv').config();
const { initDB } = require('./db');
const pixelRoutes = require('./routes/pixels');

const app = express();
const server = http.createServer(app); // Create HTTP server with Express app

// Configure CORS for Socket.IO
// Ensure VITE_FRONTEND_URL is set in your .env for development,
// or your actual frontend URL for production.
const frontendUrl = process.env.VITE_FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, { // Initialize Socket.io with the server
  cors: {
    origin: frontendUrl, // Allow requests from your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware to make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.set('trust proxy', true); // Trust proxy headers for req.ip
app.use(cors({ origin: frontendUrl })); // Standard CORS for HTTP requests
app.use(express.json());

// API Routes
app.use('/api/pixels', pixelRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is healthy' });
});

app.get('/', (req, res) => {
  res.send('Hello from r/Place Clone Backend with Socket.io!');
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
  // Example: send a message to the client upon connection
  socket.emit('welcome', 'Welcome to PixelPlace! Real-time updates are active.');
});

initDB().then(() => {
  console.log('Database initialized.');
  server.listen(PORT, () => { // Use server.listen instead of app.listen
    console.log(`Server with Socket.io running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

module.exports = { app, server, io }; // Export for potential testing
