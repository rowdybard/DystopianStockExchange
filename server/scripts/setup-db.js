const db = require('../db/connection');

const setupDatabase = async () => {
  try {
    console.log('🏗️ Setting up Dystopian Exchange Database...');

    // Required extensions
    await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alias VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT,
        install_id TEXT,
        register_ip TEXT,
        reputation INTEGER DEFAULT 0,
        daily_quota_remaining INTEGER DEFAULT 20,
        quota_reset_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS citizens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        index_value DECIMAL(10,2) DEFAULT 100.00,
        stability_status BOOLEAN DEFAULT FALSE,
        stability_expires_at TIMESTAMP,
        index_value_midnight_utc DECIMAL(10,2),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        target_citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE,
        vote_type VARCHAR(10) CHECK (vote_type IN ('affirm', 'doubt')),
        weight DECIMAL(3,2) DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(50) NOT NULL,
        target_id UUID,
        message TEXT NOT NULL,
        delta_percent DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Global/system state (singleton)
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_state (
        id SMALLINT PRIMARY KEY DEFAULT 1,
        market_halt_until TIMESTAMP,
        last_tribunal_at TIMESTAMP
      );
    `);

    // Ensure a singleton row exists
    await db.query(`
      INSERT INTO system_state (id, market_halt_until, last_tribunal_at)
      VALUES (1, NULL, CURRENT_TIMESTAMP - INTERVAL '10 minutes')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_citizens_user_id ON citizens(user_id);
      CREATE INDEX IF NOT EXISTS idx_votes_actor_id ON votes(actor_id);
      CREATE INDEX IF NOT EXISTS idx_votes_target_id ON votes(target_citizen_id);
      CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_target ON events(target_id);
    `);

    // Phase 3 migrations (idempotent)
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS install_id TEXT;
    `);
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS register_ip TEXT;
    `);
    await db.query(`
      ALTER TABLE citizens
      ADD COLUMN IF NOT EXISTS stability_last_activated_at TIMESTAMP;
    `);

    // Phase 5 migration: ensure midnight snapshot column exists on existing DBs
    await db.query(`
      ALTER TABLE citizens
      ADD COLUMN IF NOT EXISTS index_value_midnight_utc DECIMAL(10,2);
    `);

    // Phase 6: protection tracking (per-UTC-day cap)
    await db.query(`
      ALTER TABLE citizens
      ADD COLUMN IF NOT EXISTS protection_minutes_today INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS protection_minutes_reset_date DATE;
    `);

    await db.query(`
      ALTER TABLE votes
      ADD COLUMN IF NOT EXISTS created_utc_date DATE DEFAULT (NOW() AT TIME ZONE 'UTC')::date;
    `);

    // Initialize midnight snapshot for existing rows if missing
    await db.query(`
      UPDATE citizens
      SET index_value_midnight_utc = index_value
      WHERE index_value_midnight_utc IS NULL;
    `);

    console.log('✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();