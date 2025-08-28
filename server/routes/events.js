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

// Get tribunal state (market halt status)
router.get('/tribunal/state', async (req, res) => {
  try {
    const s = await db.query('SELECT market_halt_until FROM system_state WHERE id = 1');
    const marketHaltUntil = s.rows[0]?.market_halt_until || null;
    res.json({ marketHaltUntil });
  } catch (error) {
    console.error('Get tribunal state error:', error);
    res.status(500).json({ error: 'Failed to get tribunal state' });
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
    
    if (!eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Handle event types aligned to spec
    const now = new Date();
    if (eventType === 'observation_halt') {
      const haltUntil = new Date(Date.now() + 2 * 60 * 1000);
      const evt = await db.query(
        'INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3) RETURNING id',
        ['observation_halt', message || 'Observation Halt enacted — market frozen.', 0]
      );
      await db.query(
        `INSERT INTO system_state (id, market_halt_until, last_tribunal_at)
         VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET market_halt_until = EXCLUDED.market_halt_until, last_tribunal_at = EXCLUDED.last_tribunal_at`,
        [haltUntil, now]
      );
      return res.json({ success: true, eventId: evt.rows[0].id, haltUntil });
    }

    if (eventType === 'sector_uplift') {
      const delta = typeof deltaPercent === 'number' ? deltaPercent : 3.5;
      const citizens = await db.query('SELECT id, index_value FROM citizens');
      for (const c of citizens.rows) {
        const newIndex = Math.max(0, parseFloat(c.index_value) * (1 + delta / 100));
        await db.query('UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2', [newIndex.toFixed(2), c.id]);
      }
      const evt = await db.query('INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3) RETURNING id', ['sector_uplift', message || `Sector Uplift (+${delta}%).`, delta]);
      await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
      return res.json({ success: true, eventId: evt.rows[0].id });
    }

    if (eventType === 'sector_crash') {
      const baseDelta = typeof deltaPercent === 'number' ? deltaPercent : -3.5;
      const citizens = await db.query('SELECT id, index_value, stability_status, stability_expires_at FROM citizens');
      const factor = parseFloat(process.env.STABILITY_DAMPEN_FACTOR || '0.5');
      for (const c of citizens.rows) {
        const stabilityActive = c.stability_status && c.stability_expires_at && new Date(c.stability_expires_at) > new Date();
        const applied = stabilityActive && baseDelta < 0 ? baseDelta * factor : baseDelta;
        const newIndex = Math.max(0, parseFloat(c.index_value) * (1 + applied / 100));
        await db.query('UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2', [newIndex.toFixed(2), c.id]);
      }
      const evt = await db.query('INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3) RETURNING id', ['sector_crash', message || `Sector Crash (${baseDelta}%).`, baseDelta]);
      await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
      return res.json({ success: true, eventId: evt.rows[0].id });
    }

    if (eventType === 'sanction_wave') {
      const baseDelta = typeof deltaPercent === 'number' ? deltaPercent : -10;
      const top = await db.query('SELECT id, index_value, stability_status, stability_expires_at FROM citizens ORDER BY index_value DESC LIMIT 10');
      const factor = parseFloat(process.env.STABILITY_DAMPEN_FACTOR || '0.5');
      for (const c of top.rows) {
        const stabilityActive = c.stability_status && c.stability_expires_at && new Date(c.stability_expires_at) > new Date();
        const applied = stabilityActive && baseDelta < 0 ? baseDelta * factor : baseDelta;
        const newIndex = Math.max(0, parseFloat(c.index_value) * (1 + applied / 100));
        await db.query('UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2', [newIndex.toFixed(2), c.id]);
        await db.query('INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, $2, $3, $4)', ['sanction', c.id, 'Citizen sanctioned (-10%).', applied]);
      }
      const evt = await db.query('INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3) RETURNING id', ['sanction_wave', message || 'Sanction Wave (top 10 penalized).', baseDelta]);
      await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
      return res.json({ success: true, eventId: evt.rows[0].id });
    }

    return res.status(400).json({ error: 'Unsupported eventType' });
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