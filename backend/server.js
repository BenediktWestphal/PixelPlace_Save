const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();
const { initDB } = require('./db');
const pixelRoutes = require('./routes/pixels');

const app = express();
const server = http.createServer(app);

// 🔓 Offen für alle Ursprünge – CORS für Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Keine Einschränkung – kein Frontend nötig
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware, um io im Request verfügbar zu machen
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 🔓 Offen für alle Ursprünge – CORS für Express HTTP-Requests
app.use(cors());
app.use(express.json());
app.set('trust proxy', 1); // Trust the first hop for req.ip

// API-Routen
app.use('/api/pixels', pixelRoutes);

// Health-Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is healthy' });
});

// Standard-Route
app.get('/', (req, res) => {
  res.send('Hello from r/Place Clone Backend with Socket.io!');
});

// WebSocket-Events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.emit('welcome', 'Welcome to PixelPlace! Real-time updates are active.');

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Starte Server nach erfolgreicher DB-Initialisierung
initDB().then(() => {
  console.log('Database initialized.');
  server.listen(PORT, () => {
    console.log(`Server with Socket.io running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

module.exports = { app, server, io };
