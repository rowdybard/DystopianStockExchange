const db = require('../db/connection');

const setupDatabase = async () => {
  try {
    console.log('🏗️ Setting up Dystopian Exchange Database...');

    // Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alias VARCHAR(50) UNIQUE NOT NULL,
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

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_citizens_user_id ON citizens(user_id);
      CREATE INDEX IF NOT EXISTS idx_votes_actor_id ON votes(actor_id);
      CREATE INDEX IF NOT EXISTS idx_votes_target_id ON votes(target_citizen_id);
      CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `);

    console.log('✅ Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();