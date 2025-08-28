const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { createRateLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Basic rate limiters
const rlRegister = createRateLimiter(3, 60 * 1000); // 3/min per IP
const rlRegisterDaily = createRateLimiter(20, 24 * 60 * 60 * 1000); // 20/day per IP
const rlLogin = createRateLimiter(10, 60 * 1000); // 10/min per IP

// Database connection
const db = require('./db/connection');

// Routes
// Wrap auth routes with rate limits where appropriate
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/register') return rlRegister(req, res, () => rlRegisterDaily(req, res, () => require('./routes/auth')(req, res, next)));
  if (req.method === 'POST' && req.path === '/login') return rlLogin(req, res, () => require('./routes/auth')(req, res, next));
  return require('./routes/auth')(req, res, next);
});
app.use('/api/citizens', require('./routes/citizens'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/events', require('./routes/events'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dystopian Exchange Server Running' });
});

// Serve frontend from client/dist when present (works in dev/CI too)
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('Frontend build not found at', distPath);
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

// Start schedulers (drift + tribunal) unless disabled
if (!process.env.DISABLE_SCHEDULERS) {
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
}

module.exports = app;