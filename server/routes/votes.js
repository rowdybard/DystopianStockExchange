const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Submit a vote (affirm or doubt)
router.post('/', async (req, res) => {
  try {
    const { targetCitizenId, voteType } = req.body;
    const actorId = req.cookies.userId;
    
    if (!actorId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!targetCitizenId || !voteType || !['affirm', 'doubt'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote data' });
    }
    
    // Check daily quota
    const quotaResult = await db.query(
      'SELECT daily_quota_remaining, quota_reset_date FROM users WHERE id = $1',
      [actorId]
    );
    
    if (quotaResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = quotaResult.rows[0];
    
    // Reset quota if it's a new day
    if (user.quota_reset_date !== new Date().toISOString().split('T')[0]) {
      await db.query(
        'UPDATE users SET daily_quota_remaining = 20, quota_reset_date = CURRENT_DATE WHERE id = $1',
        [actorId]
      );
      user.daily_quota_remaining = 20;
    }
    
    if (user.daily_quota_remaining <= 0) {
      return res.status(429).json({ error: 'Daily vote quota exceeded' });
    }
    
    // Check if already voted on this citizen today
    const existingVoteResult = await db.query(
      `SELECT COUNT(*) as vote_count 
       FROM votes 
       WHERE actor_id = $1 AND target_citizen_id = $2 
       AND DATE(created_at) = CURRENT_DATE`,
      [actorId, targetCitizenId]
    );
    
    if (parseInt(existingVoteResult.rows[0].vote_count) >= 2) {
      return res.status(429).json({ error: 'Maximum votes per citizen per day exceeded' });
    }
    
    // Calculate vote weight (0.5-1.0%)
    const weight = 0.5 + Math.random() * 0.5;
    
    // Insert vote
    await db.query(
      'INSERT INTO votes (actor_id, target_citizen_id, vote_type, weight) VALUES ($1, $2, $3, $4)',
      [actorId, targetCitizenId, voteType, weight]
    );
    
    // Update citizen index
    const deltaPercent = voteType === 'affirm' ? weight : -weight;
    
    const citizenResult = await db.query(
      'SELECT index_value FROM citizens WHERE id = $1',
      [targetCitizenId]
    );
    
    if (citizenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target citizen not found' });
    }
    
    const currentIndex = parseFloat(citizenResult.rows[0].index_value);
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
    const targetResult = await db.query(
      'SELECT u.alias FROM citizens c JOIN users u ON c.user_id = u.id WHERE c.id = $1',
      [targetCitizenId]
    );
    
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

module.exports = router;