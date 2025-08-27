const express = require('express');
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

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    message: '🏛️ Dystopian Citizen Exchange API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      citizens: '/api/citizens',
      votes: '/api/votes',
      events: '/api/events',
      leaderboard: '/api/leaderboard'
    },
    note: 'This is the backend API. Frontend will be available in Phase 2.'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏛️ Dystopian Exchange Server running on port ${PORT}`);
});

module.exports = app;