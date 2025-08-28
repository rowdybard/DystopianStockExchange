const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Get all citizens (market board)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        c.stability_status,
        c.last_updated,
        u.alias,
        u.reputation,
        CASE 
          WHEN c.last_updated < NOW() - INTERVAL '5 minutes' THEN 0
          ELSE 1
        END as is_active
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.index_value DESC
    `);
    
    res.json({ citizens: result.rows });
  } catch (error) {
    console.error('Get citizens error:', error);
    res.status(500).json({ error: 'Failed to get citizens' });
  }
});

// Get specific citizen
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        c.stability_status,
        c.stability_expires_at,
        c.last_updated,
        u.alias,
        u.reputation,
        (SELECT COUNT(*) FROM votes WHERE target_citizen_id = c.id AND vote_type = 'affirm') as affirm_count,
        (SELECT COUNT(*) FROM votes WHERE target_citizen_id = c.id AND vote_type = 'doubt') as doubt_count
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Citizen not found' });
    }
    
    res.json({ citizen: result.rows[0] });
  } catch (error) {
    console.error('Get citizen error:', error);
    res.status(500).json({ error: 'Failed to get citizen' });
  }
});

// Update citizen index (for drift and events)
router.patch('/:id/index', async (req, res) => {
  try {
    const { id } = req.params;
    const { deltaPercent, reason } = req.body;
    
    if (!deltaPercent || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get current index
    const currentResult = await db.query(
      'SELECT index_value FROM citizens WHERE id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Citizen not found' });
    }
    
    const currentIndex = parseFloat(currentResult.rows[0].index_value);
    const newIndex = Math.max(0, currentIndex * (1 + deltaPercent / 100));
    
    // Update index
    await db.query(
      'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
      [newIndex.toFixed(2), id]
    );
    
    // Log event
    await db.query(
      'INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, $2, $3, $4)',
      ['index_change', id, reason, deltaPercent]
    );
    
    res.json({ 
      success: true, 
      newIndex: newIndex.toFixed(2),
      deltaPercent 
    });
  } catch (error) {
    console.error('Update index error:', error);
    res.status(500).json({ error: 'Failed to update index' });
  }
});

// Activate stability protocol
router.post('/:id/stability', async (req, res) => {
  try {
    const { id } = req.params;
    const { birthMonth, favoriteColor, city } = req.body;
    
    if (!birthMonth || !favoriteColor || !city) {
      return res.status(400).json({ error: 'Missing compliance data' });
    }
    
    // Check if stability is already active
    const currentResult = await db.query(
      'SELECT stability_status, stability_expires_at FROM citizens WHERE id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Citizen not found' });
    }
    
    const citizen = currentResult.rows[0];
    
    if (citizen.stability_status && new Date(citizen.stability_expires_at) > new Date()) {
      return res.status(400).json({ error: 'Stability protocol already active' });
    }
    
    // Enforce 1-hour cooldown using stability_last_activated_at
    const now = new Date();
    const lastActivated = citizen.stability_last_activated_at ? new Date(citizen.stability_last_activated_at) : null;
    if (lastActivated && now.getTime() - lastActivated.getTime() < 60 * 60 * 1000) {
      return res.status(429).json({ error: 'Stability protocol cooldown: one activation per hour' });
    }

    // Activate stability for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await db.query(
      'UPDATE citizens SET stability_status = true, stability_expires_at = $1, stability_last_activated_at = NOW() WHERE id = $2',
      [expiresAt, id]
    );
    
    // Log event
    await db.query(
      'INSERT INTO events (event_type, target_id, message) VALUES ($1, $2, $3)',
      ['stability_activated', id, 'Compliance data submitted. Volatility reduced.']
    );
    
    res.json({ 
      success: true, 
      expiresAt,
      message: 'Stability protocol activated'
    });
  } catch (error) {
    console.error('Stability protocol error:', error);
    res.status(500).json({ error: 'Failed to activate stability protocol' });
  }
});

module.exports = router;