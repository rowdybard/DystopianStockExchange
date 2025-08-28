const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Submit a vote (affirm or doubt)
router.post('/', async (req, res) => {
  try {
    // Market halt check
    const haltRes = await db.query('SELECT market_halt_until FROM system_state WHERE id = 1');
    if (haltRes.rows.length && haltRes.rows[0].market_halt_until && new Date(haltRes.rows[0].market_halt_until) > new Date()) {
      return res.status(423).json({ error: 'Market is under Observation Halt' });
    }

    const { targetCitizenId, voteType } = req.body;
    const actorId = req.cookies.userId;
    
    if (!actorId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!targetCitizenId || !voteType || !['affirm', 'doubt'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote data' });
    }
    
    // Block self-voting
    const selfCheck = await db.query(
      'SELECT 1 FROM citizens WHERE id = $1 AND user_id = $2',
      [targetCitizenId, actorId]
    );
    if (selfCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Self-voting is not permitted' });
    }

    // Check daily quota
    const quotaResult = await db.query(
      'SELECT daily_quota_remaining, quota_reset_date, created_at FROM users WHERE id = $1',
      [actorId]
    );
    
    if (quotaResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = quotaResult.rows[0];
    
    // Reset quota if it's a new UTC day
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (user.quota_reset_date !== todayUtc) {
      await db.query(
        'UPDATE users SET daily_quota_remaining = 20, quota_reset_date = CURRENT_DATE WHERE id = $1',
        [actorId]
      );
      user.daily_quota_remaining = 20;
    }
    
    if (user.daily_quota_remaining <= 0) {
      return res.status(429).json({ error: 'Daily vote quota exceeded' });
    }

    // New account cooldown: 10 minutes post-registration
    if (new Date(user.created_at).getTime() > Date.now() - 10*60*1000) {
      return res.status(429).json({ error: 'New account cooldown: voting enabled after 10 minutes' });
    }
    
    // Check per-type limit (max 2 per target per UTC day per type)
    const existingVoteResult = await db.query(
      `SELECT COUNT(*) as vote_count 
       FROM votes 
       WHERE actor_id = $1 AND target_citizen_id = $2 
         AND vote_type = $3
         AND created_utc_date = (NOW() AT TIME ZONE 'UTC')::date`,
      [actorId, targetCitizenId, voteType]
    );
    
    if (parseInt(existingVoteResult.rows[0].vote_count, 10) >= 2) {
      return res.status(429).json({ error: 'Max 2 of each vote type per target per UTC day' });
    }
    
    // Calculate vote weight (0.5-1.0%)
    let weight = 0.5 + Math.random() * 0.5;
    
    // Insert vote
    await db.query(
      `INSERT INTO votes (actor_id, target_citizen_id, vote_type, weight, created_utc_date)
       VALUES ($1, $2, $3, $4, (NOW() AT TIME ZONE 'UTC')::date)`,
      [actorId, targetCitizenId, voteType, weight]
    );
    
    // Update citizen index
    const deltaPercent = voteType === 'affirm' ? weight : -weight;
    
    const citizenResult = await db.query(
      'SELECT index_value, stability_status, stability_expires_at FROM citizens WHERE id = $1',
      [targetCitizenId]
    );
    
    if (citizenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target citizen not found' });
    }
    
    const citizenRow = citizenResult.rows[0];
    const currentIndex = parseFloat(citizenRow.index_value);

    // Apply stability dampening on negative votes if active
    const stabilityActive = citizenRow.stability_status && citizenRow.stability_expires_at && new Date(citizenRow.stability_expires_at) > new Date();
    if (stabilityActive && deltaPercent < 0) {
      const factor = parseFloat(process.env.STABILITY_DAMPEN_FACTOR || '0.5');
      deltaPercent = deltaPercent * factor;
    }

    const newIndex = Math.max(0, currentIndex * (1 + deltaPercent / 100));
    
    await db.query(
      'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
      [newIndex.toFixed(2), targetCitizenId]
    );
    
    // Decrease quota
    await db.query(
      'UPDATE users SET daily_quota_remaining = daily_quota_remaining - 1 WHERE id = $1',
      [actorId]
    );
    
    // Log event
    const actorResult = await db.query('SELECT alias FROM users WHERE id = $1', [actorId]);
    const targetResult = await db.query('SELECT u.alias FROM citizens c JOIN users u ON c.user_id = u.id WHERE c.id = $1', [targetCitizenId]);
    
    const message = `${actorResult.rows[0].alias} ${voteType}ed ${targetResult.rows[0].alias} (${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%)`;
    
    await db.query(
      'INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, $2, $3, $4)',
      ['vote', targetCitizenId, message, deltaPercent]
    );
    
    res.json({
      success: true,
      newIndex: newIndex.toFixed(2),
      deltaPercent,
      remainingQuota: user.daily_quota_remaining - 1
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Get user's voting history
router.get('/history', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await db.query(`
      SELECT 
        v.vote_type,
        v.weight,
        v.created_at,
        target_user.alias as target_alias,
        target_citizen.index_value as target_index
      FROM votes v
      JOIN citizens target_citizen ON v.target_citizen_id = target_citizen.id
      JOIN users target_user ON target_citizen.user_id = target_user.id
      WHERE v.actor_id = $1
      ORDER BY v.created_at DESC
      LIMIT 20
    `, [userId]);
    
    res.json({ votes: result.rows });
  } catch (error) {
    console.error('Get vote history error:', error);
    res.status(500).json({ error: 'Failed to get vote history' });
  }
});

// Get remaining quotas (total and per-target per-type)
router.get('/quota/:targetCitizenId', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { targetCitizenId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const u = await db.query('SELECT daily_quota_remaining, quota_reset_date FROM users WHERE id = $1', [userId]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found' });

    // Reset if new UTC day for accurate number
    const user = u.rows[0];
    const todayUtc = new Date().toISOString().slice(0, 10);
    let dailyRemaining = user.daily_quota_remaining;
    if (user.quota_reset_date !== todayUtc) {
      dailyRemaining = 20;
    }

    const counts = await db.query(
      `SELECT vote_type, COUNT(*)::int as cnt
       FROM votes
       WHERE actor_id = $1 AND target_citizen_id = $2 AND created_utc_date = (NOW() AT TIME ZONE 'UTC')::date
       GROUP BY vote_type`,
      [userId, targetCitizenId]
    );

    const perType = { affirm: 0, doubt: 0 };
    for (const r of counts.rows) perType[r.vote_type] = r.cnt;

    res.json({ dailyRemaining, perTypeRemaining: { affirm: Math.max(0, 2 - perType.affirm), doubt: Math.max(0, 2 - perType.doubt) } });
  } catch (error) {
    console.error('Get quota error:', error);
    res.status(500).json({ error: 'Failed to get quotas' });
  }
});

module.exports = router;