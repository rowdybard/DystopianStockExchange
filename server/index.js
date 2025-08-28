const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Database connection
const db = require('./db/connection');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/citizens', require('./routes/citizens'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/events', require('./routes/events'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dystopian Exchange Server Running' });
});

// Serve frontend in production from client/dist
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🏛️ Dystopian Exchange Server running on port ${PORT}`);
});

// Start schedulers (drift + tribunal)
try {
  const { startSchedulers } = require('./services/schedulers');
  const stopSchedulers = startSchedulers();
  process.on('SIGTERM', () => {
    stopSchedulers && stopSchedulers();
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    stopSchedulers && stopSchedulers();
    server.close(() => process.exit(0));
  });
} catch (err) {
  console.error('Failed to start schedulers:', err);
}

module.exports = app;