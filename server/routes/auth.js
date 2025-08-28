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

async function moderateAlias(candidate) {
  if (!candidate) return { ok: false, reason: 'Missing alias' };
  const trimmed = String(candidate).trim();
  if (!/^[-A-Za-z0-9]{3,24}$/.test(trimmed)) return { ok: false, reason: 'Alias must be 3-24 chars, letters/numbers/hyphen' };
  // Basic blocklist of real companies (minimal examples)
  const block = ['google','apple','microsoft','amazon','meta','coca','pepsi','nike','adidas','tesla','netflix','disney','mcdonalds','ibm','intel','samsung','oracle','nvidia','paypal','uber','lyft','tiktok'];
  const lower = trimmed.toLowerCase();
  if (block.some(b => lower.includes(b))) return { ok: false, reason: 'Alias too brand-like' };

  // Optional: OpenAI moderation (requires OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = require('openai').OpenAI;
      const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // Keep it cheap: classify short alias for brand/sensitive content via small reasoning call
      const prompt = `Decide if this alias is allowed for a dystopian game ticker. Reject if it appears to be a real brand/company or contains hateful/sexual/violent slurs. Answer strictly as JSON: {"allow": true|false, "reason": "..."}. Alias: "${trimmed}"`;
      const resp = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'You are a strict content and brand-misuse classifier.' }, { role: 'user', content: prompt }],
        temperature: 0
      });
      const content = resp.choices?.[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content);
        if (!parsed.allow) return { ok: false, reason: parsed.reason || 'Alias rejected by moderation' };
      } catch {}
    } catch (e) {
      console.warn('OpenAI moderation skipped:', e?.message);
    }
  }
  return { ok: true };
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { password, alias: requestedAlias } = req.body || {};
    const alias = requestedAlias ? String(requestedAlias).trim() : generateAlias();
    // If custom alias provided, moderate & check uniqueness
    if (requestedAlias) {
      const mod = await moderateAlias(alias);
      if (!mod.ok) return res.status(400).json({ error: mod.reason });
      const exists = await db.query('SELECT 1 FROM users WHERE LOWER(alias) = LOWER($1)', [alias]);
      if (exists.rows.length) return res.status(409).json({ error: 'Alias taken' });
    }
    
    let passwordHash = null;
    if (password) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }
    
    // Install fingerprint and IP
    const installId = req.cookies.install_id || req.cookies.installId || null;
    const registerIp = req.ip || req.connection?.remoteAddress || null;

    // Enforce one account per device (install_id)
    if (installId) {
      const existingByInstall = await db.query('SELECT id, alias FROM users WHERE install_id = $1 LIMIT 1', [installId]);
      if (existingByInstall.rows.length) {
        return res.status(409).json({ error: 'An account already exists on this device. Please login instead.', alias: existingByInstall.rows[0].alias });
      }
    }

    // Create user
    const userResult = await db.query(
      'INSERT INTO users (alias, password_hash, install_id, register_ip) VALUES ($1, $2, $3, $4) RETURNING id, alias',
      [alias, passwordHash, installId, registerIp]
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
              (u.password_hash IS NOT NULL) as has_password,
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

// Set or change password for current user
router.post('/set-password', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const { password } = req.body || {};
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// Login with password
router.post('/login', async (req, res) => {
  try {
    const { alias, password } = req.body || {};
    if (!alias || !password) return res.status(400).json({ error: 'Missing credentials' });
    const result = await db.query('SELECT id, password_hash FROM users WHERE LOWER(alias) = LOWER($1)', [alias]);
    if (!result.rows.length || !result.rows[0].password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.cookie('userId', result.rows[0].id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Check if this device already has a registered account
router.get('/install-status', async (req, res) => {
  try {
    const installId = req.cookies.install_id || req.cookies.installId || null;
    if (!installId) return res.json({ hasAccount: false });
    const r = await db.query('SELECT alias FROM users WHERE install_id = $1 LIMIT 1', [installId]);
    if (r.rows.length) return res.json({ hasAccount: true, alias: r.rows[0].alias });
    return res.json({ hasAccount: false });
  } catch (error) {
    console.error('Install status error:', error);
    res.status(500).json({ error: 'Failed to get install status' });
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