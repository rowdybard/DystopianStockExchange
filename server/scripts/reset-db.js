const db = require('../db/connection');

const resetDatabase = async () => {
  try {
    console.log('🧨 Resetting Dystopian Exchange data...');

    // Order matters due to FKs
    await db.query('DELETE FROM events');
    await db.query('DELETE FROM votes');
    await db.query('DELETE FROM citizens');
    await db.query('DELETE FROM users');

    // Reset system state
    await db.query(`
      INSERT INTO system_state (id, market_halt_until, last_tribunal_at)
      VALUES (1, NULL, CURRENT_TIMESTAMP - INTERVAL '10 minutes')
      ON CONFLICT (id) DO UPDATE SET market_halt_until = EXCLUDED.market_halt_until, last_tribunal_at = EXCLUDED.last_tribunal_at;
    `);

    console.log('✅ Reset complete.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
};

resetDatabase();


