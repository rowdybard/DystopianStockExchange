const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');

const router = express.Router();

// Generate dystopian corporate-style alias
const generateAlias = () => {
  const prefixes = ['Citizen', 'Subject', 'Entity', 'Unit', 'Asset'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9999) + 1;
  return `${prefix}-${number.toString().padStart(4, '0')}`;
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const alias = generateAlias();
    
    // Create user
    const userResult = await db.query(
      'INSERT INTO users (alias) VALUES ($1) RETURNING id, alias',
      [alias]
    );
    
    const user = userResult.rows[0];
    
    // Create citizen for the user
    await db.query(
      'INSERT INTO citizens (user_id, index_value) VALUES ($1, $2)',
      [user.id, 100.00]
    );
    
    // Set session cookie (cross-site friendly for Render)
    res.cookie('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        alias: user.alias
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await db.query(
      `SELECT u.id, u.alias, u.reputation, u.daily_quota_remaining,
              c.id as citizen_id, c.index_value, c.stability_status
       FROM users u
       LEFT JOIN citizens c ON u.id = c.user_id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('userId', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ success: true });
});

module.exports = router;