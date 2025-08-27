const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Get recent events
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await db.query(`
      SELECT 
        e.id,
        e.event_type,
        e.message,
        e.delta_percent,
        e.created_at,
        u.alias as target_alias
      FROM events e
      LEFT JOIN citizens c ON e.target_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY e.created_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get events for specific citizen
router.get('/citizen/:citizenId', async (req, res) => {
  try {
    const { citizenId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await db.query(`
      SELECT 
        e.id,
        e.event_type,
        e.message,
        e.delta_percent,
        e.created_at
      FROM events e
      WHERE e.target_id = $1
      ORDER BY e.created_at DESC
      LIMIT $2
    `, [citizenId, limit]);
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get citizen events error:', error);
    res.status(500).json({ error: 'Failed to get citizen events' });
  }
});

// Trigger Tribunal event (admin endpoint)
router.post('/tribunal', async (req, res) => {
  try {
    const { eventType, targetId, message, deltaPercent } = req.body;
    
    if (!eventType || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Insert event
    const eventResult = await db.query(
      'INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, $2, $3, $4) RETURNING id',
      [eventType, targetId, message, deltaPercent]
    );
    
    // If it's a global event, apply to all citizens
    if (eventType === 'global' && deltaPercent) {
      const citizensResult = await db.query('SELECT id, index_value FROM citizens');
      
      for (const citizen of citizensResult.rows) {
        const currentIndex = parseFloat(citizen.index_value);
        const newIndex = Math.max(0, currentIndex * (1 + deltaPercent / 100));
        
        await db.query(
          'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
          [newIndex.toFixed(2), citizen.id]
        );
      }
    }
    
    res.json({ 
      success: true, 
      eventId: eventResult.rows[0].id 
    });
  } catch (error) {
    console.error('Create tribunal event error:', error);
    res.status(500).json({ error: 'Failed to create tribunal event' });
  }
});

// Get Tribunal event types
router.get('/tribunal/types', (req, res) => {
  const eventTypes = [
    {
      type: 'sector_uplift',
      name: 'Sector Uplift',
      description: 'Global positive market movement',
      defaultDelta: 3.5
    },
    {
      type: 'sector_crash',
      name: 'Sector Crash', 
      description: 'Global negative market movement',
      defaultDelta: -3.5
    },
    {
      type: 'observation_halt',
      name: 'Observation Halt',
      description: 'Market freeze for 2 minutes',
      defaultDelta: 0
    },
    {
      type: 'sanction_wave',
      name: 'Sanction Wave',
      description: 'Top 10 citizens penalized',
      defaultDelta: -10
    }
  ];
  
  res.json({ eventTypes });
});

module.exports = router;