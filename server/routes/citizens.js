const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Get all citizens (market board)
router.get('/', async (req, res) => {
  try {
    // If migration hasn't added index_value_midnight_utc yet, fall back to NULL
    const colCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'citizens'
          AND column_name = 'index_value_midnight_utc'
      ) AS has_col;
    `);
    const hasMidnight = !!colCheck.rows[0]?.has_col;

    const sql = hasMidnight ? `
      SELECT 
        c.id,
        c.index_value,
        c.index_value_midnight_utc,
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
    ` : `
      SELECT 
        c.id,
        c.index_value,
        NULL::DECIMAL(10,2) AS index_value_midnight_utc,
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
    `;

    const result = await db.query(sql);
    
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
        c.stability_last_activated_at,
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
// Purchase protection by spending index_value
router.post('/:id/stability', async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes } = req.body; // 10, 20, 30
    
    const allowed = [10, 20, 30];
    const duration = parseInt(minutes, 10);
    if (!allowed.includes(duration)) {
      return res.status(400).json({ error: 'Invalid protection duration' });
    }
    
    // Check if stability is already active
    const currentResult = await db.query(
      'SELECT stability_status, stability_expires_at, stability_last_activated_at, index_value FROM citizens WHERE id = $1',
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

    // Price schedule: 10m = 1.0 index point, 20m = 1.8, 30m = 2.5
    const costMap = { 10: 1.0, 20: 1.8, 30: 2.5 };
    const cost = costMap[duration];
    const currentIndex = parseFloat(citizen.index_value);
    if (currentIndex <= cost) {
      return res.status(400).json({ error: 'Insufficient index to purchase protection' });
    }

    const expiresAt = new Date(Date.now() + duration * 60 * 1000);
    
    await db.query(
      'UPDATE citizens SET index_value = $1, stability_status = true, stability_expires_at = $2, stability_last_activated_at = NOW(), last_updated = NOW() WHERE id = $3',
      [(currentIndex - cost).toFixed(2), expiresAt, id]
    );
    
    // Log event
    await db.query(
      'INSERT INTO events (event_type, target_id, message) VALUES ($1, $2, $3)',
      ['stability_activated', id, `Protection purchased: ${duration}m for -${cost.toFixed(2)} index. Volatility reduced.`]
    );
    
    res.json({ 
      success: true, 
      expiresAt,
      message: 'Protection activated'
    });
  } catch (error) {
    console.error('Stability protocol error:', error);
    res.status(500).json({ error: 'Failed to activate stability protocol' });
  }
});

module.exports = router;