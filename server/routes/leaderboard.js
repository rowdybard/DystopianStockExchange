const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Get leaderboards
router.get('/', async (req, res) => {
  try {
    // Top gainers (highest index values)
    const topGainersResult = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        u.alias,
        u.reputation,
        c.last_updated
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.index_value DESC
      LIMIT 10
    `);
    
    // Top losers (lowest index values)
    const topLosersResult = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        u.alias,
        u.reputation,
        c.last_updated
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.index_value ASC
      LIMIT 10
    `);
    
    // Most doubted citizens
    const mostDoubtedResult = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        u.alias,
        COUNT(v.id) as doubt_count
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN votes v ON c.id = v.target_citizen_id AND v.vote_type = 'doubt'
      GROUP BY c.id, c.index_value, u.alias
      ORDER BY doubt_count DESC
      LIMIT 10
    `);
    
    // Most affirmed citizens
    const mostAffirmedResult = await db.query(`
      SELECT 
        c.id,
        c.index_value,
        u.alias,
        COUNT(v.id) as affirm_count
      FROM citizens c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN votes v ON c.id = v.target_citizen_id AND v.vote_type = 'affirm'
      GROUP BY c.id, c.index_value, u.alias
      ORDER BY affirm_count DESC
      LIMIT 10
    `);
    
    // Most active voters
    const mostActiveVotersResult = await db.query(`
      SELECT 
        u.id,
        u.alias,
        COUNT(v.id) as vote_count,
        COUNT(CASE WHEN v.vote_type = 'affirm' THEN 1 END) as affirm_count,
        COUNT(CASE WHEN v.vote_type = 'doubt' THEN 1 END) as doubt_count
      FROM users u
      LEFT JOIN votes v ON u.id = v.actor_id
      GROUP BY u.id, u.alias
      ORDER BY vote_count DESC
      LIMIT 10
    `);
    
    res.json({
      topGainers: topGainersResult.rows,
      topLosers: topLosersResult.rows,
      mostDoubted: mostDoubtedResult.rows,
      mostAffirmed: mostAffirmedResult.rows,
      mostActiveVoters: mostActiveVotersResult.rows
    });
  } catch (error) {
    console.error('Get leaderboards error:', error);
    res.status(500).json({ error: 'Failed to get leaderboards' });
  }
});

// Get specific leaderboard
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    let query;
    let params = [limit];
    
    switch (type) {
      case 'gainers':
        query = `
          SELECT 
            c.id,
            c.index_value,
            u.alias,
            u.reputation,
            c.last_updated
          FROM citizens c
          JOIN users u ON c.user_id = u.id
          ORDER BY c.index_value DESC
          LIMIT $1
        `;
        break;
        
      case 'losers':
        query = `
          SELECT 
            c.id,
            c.index_value,
            u.alias,
            u.reputation,
            c.last_updated
          FROM citizens c
          JOIN users u ON c.user_id = u.id
          ORDER BY c.index_value ASC
          LIMIT $1
        `;
        break;
        
      case 'doubted':
        query = `
          SELECT 
            c.id,
            c.index_value,
            u.alias,
            COUNT(v.id) as doubt_count
          FROM citizens c
          JOIN users u ON c.user_id = u.id
          LEFT JOIN votes v ON c.id = v.target_citizen_id AND v.vote_type = 'doubt'
          GROUP BY c.id, c.index_value, u.alias
          ORDER BY doubt_count DESC
          LIMIT $1
        `;
        break;
        
      case 'affirmed':
        query = `
          SELECT 
            c.id,
            c.index_value,
            u.alias,
            COUNT(v.id) as affirm_count
          FROM citizens c
          JOIN users u ON c.user_id = u.id
          LEFT JOIN votes v ON c.id = v.target_citizen_id AND v.vote_type = 'affirm'
          GROUP BY c.id, c.index_value, u.alias
          ORDER BY affirm_count DESC
          LIMIT $1
        `;
        break;
        
      case 'voters':
        query = `
          SELECT 
            u.id,
            u.alias,
            COUNT(v.id) as vote_count,
            COUNT(CASE WHEN v.vote_type = 'affirm' THEN 1 END) as affirm_count,
            COUNT(CASE WHEN v.vote_type = 'doubt' THEN 1 END) as doubt_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.actor_id
          GROUP BY u.id, u.alias
          ORDER BY vote_count DESC
          LIMIT $1
        `;
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid leaderboard type' });
    }
    
    const result = await db.query(query, params);
    res.json({ [type]: result.rows });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

module.exports = router;