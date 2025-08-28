const db = require('../db/connection');

// Configuration
const DRIFT_MIN_INTERVAL_MS = 60 * 1000; // 1 minute
const DRIFT_MAX_INTERVAL_MS = 120 * 1000; // 2 minutes
const DRIFT_MIN_DELTA = 0.2; // %
const DRIFT_MAX_DELTA = 0.6; // %

const TRIBUNAL_BASE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const TRIBUNAL_JITTER_MS = 2 * 60 * 1000; // ±2 minutes

const STABILITY_DAMPEN_FACTOR = parseFloat(process.env.STABILITY_DAMPEN_FACTOR || '0.5');

const randomInRange = (min, max) => min + Math.random() * (max - min);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getMarketHaltUntil() {
  const res = await db.query('SELECT market_halt_until FROM system_state WHERE id = 1');
  if (res.rows.length === 0 || !res.rows[0].market_halt_until) return null;
  return new Date(res.rows[0].market_halt_until);
}

async function isMarketHalted() {
  const until = await getMarketHaltUntil();
  return until && until > new Date();
}

async function applyDriftTick() {
  if (await isMarketHalted()) return; // skip during observation halt

  const citizensRes = await db.query(`
    SELECT id, index_value, stability_status, stability_expires_at
    FROM citizens
  `);

  if (citizensRes.rows.length === 0) return;

  for (const citizen of citizensRes.rows) {
    const currentIndex = parseFloat(citizen.index_value);
    const magnitude = randomInRange(DRIFT_MIN_DELTA, DRIFT_MAX_DELTA);
    const sign = Math.random() < 0.5 ? -1 : 1;
    let deltaPercent = sign * magnitude;

    const stabilityActive = citizen.stability_status && citizen.stability_expires_at && new Date(citizen.stability_expires_at) > new Date();
    if (stabilityActive && deltaPercent < 0) {
      deltaPercent = deltaPercent * STABILITY_DAMPEN_FACTOR;
    }

    const newIndex = Math.max(0, currentIndex * (1 + deltaPercent / 100));
    await db.query(
      'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
      [newIndex.toFixed(2), citizen.id]
    );
  }
}

const EVENT_WEIGHTS = [
  { type: 'sector_uplift', weight: 0.4 },
  { type: 'sector_crash', weight: 0.3 },
  { type: 'observation_halt', weight: 0.15 },
  { type: 'sanction_wave', weight: 0.15 }
];

async function pickTribunalEventType() {
  const r = Math.random();
  let acc = 0;
  for (const e of EVENT_WEIGHTS) {
    acc += e.weight;
    if (r <= acc) return e.type;
  }
  return EVENT_WEIGHTS[EVENT_WEIGHTS.length - 1].type;
}

async function runTribunalTick() {
  const type = await pickTribunalEventType();
  const now = new Date();

  if (type !== 'observation_halt' && (await isMarketHalted())) {
    // Skip applying market-impacting events during a halt
    return;
  }

  if (type === 'observation_halt') {
    const haltUntil = new Date(Date.now() + 2 * 60 * 1000);
    await db.query(
      `INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3)`,
      ['observation_halt', 'Observation Halt enacted — market frozen.', 0]
    );
    await db.query(
      `INSERT INTO system_state (id, market_halt_until, last_tribunal_at)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET market_halt_until = EXCLUDED.market_halt_until, last_tribunal_at = EXCLUDED.last_tribunal_at`,
      [haltUntil, now]
    );
    return;
  }

  if (type === 'sector_uplift') {
    const delta = parseFloat(randomInRange(2.0, 5.0).toFixed(2));
    const citizensRes = await db.query('SELECT id, index_value FROM citizens');
    for (const citizen of citizensRes.rows) {
      const currentIndex = parseFloat(citizen.index_value);
      const newIndex = Math.max(0, currentIndex * (1 + delta / 100));
      await db.query(
        'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
        [newIndex.toFixed(2), citizen.id]
      );
    }
    await db.query(
      `INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3)`,
      ['sector_uplift', `Sector Uplift enacted (+${delta}%).`, delta]
    );
    await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
    return;
  }

  if (type === 'sector_crash') {
    const deltaMagnitude = parseFloat(randomInRange(2.0, 5.0).toFixed(2));
    const baseDelta = -deltaMagnitude;
    const citizensRes = await db.query('SELECT id, index_value, stability_status, stability_expires_at FROM citizens');
    for (const citizen of citizensRes.rows) {
      const currentIndex = parseFloat(citizen.index_value);
      const stabilityActive = citizen.stability_status && citizen.stability_expires_at && new Date(citizen.stability_expires_at) > new Date();
      const appliedDelta = stabilityActive ? baseDelta * STABILITY_DAMPEN_FACTOR : baseDelta;
      const newIndex = Math.max(0, currentIndex * (1 + appliedDelta / 100));
      await db.query(
        'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
        [newIndex.toFixed(2), citizen.id]
      );
    }
    await db.query(
      `INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3)`,
      ['sector_crash', `Sector Crash enacted (${baseDelta.toFixed(2)}%).`, baseDelta]
    );
    await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
    return;
  }

  if (type === 'sanction_wave') {
    // Penalize top 10 by a variable -5% to -10%
    const magnitude = parseFloat(randomInRange(5.0, 10.0).toFixed(2));
    const baseDelta = -magnitude;
    const topRes = await db.query(`
      SELECT id, index_value, stability_status, stability_expires_at
      FROM citizens
      ORDER BY index_value DESC
      LIMIT 10
    `);
    for (const citizen of topRes.rows) {
      const currentIndex = parseFloat(citizen.index_value);
      const stabilityActive = citizen.stability_status && citizen.stability_expires_at && new Date(citizen.stability_expires_at) > new Date();
      const appliedDelta = stabilityActive ? baseDelta * STABILITY_DAMPEN_FACTOR : baseDelta;
      const newIndex = Math.max(0, currentIndex * (1 + appliedDelta / 100));
      await db.query(
        'UPDATE citizens SET index_value = $1, last_updated = NOW() WHERE id = $2',
        [newIndex.toFixed(2), citizen.id]
      );
      await db.query(
        'INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, $2, $3, $4)',
        ['sanction', citizen.id, `Citizen sanctioned (${appliedDelta.toFixed(2)}%).`, appliedDelta]
      );
    }
    await db.query(
      `INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3)`,
      ['sanction_wave', `Sanction Wave applied to top 10 citizens (${baseDelta.toFixed(2)}%).`, baseDelta]
    );
    await db.query('UPDATE system_state SET last_tribunal_at = $1 WHERE id = 1', [now]);
    return;
  }
}

function getRandomDriftDelay() {
  return Math.floor(randomInRange(DRIFT_MIN_INTERVAL_MS, DRIFT_MAX_INTERVAL_MS));
}

function getRandomTribunalDelay() {
  const base = TRIBUNAL_BASE_INTERVAL_MS;
  const jitter = randomInRange(-TRIBUNAL_JITTER_MS, TRIBUNAL_JITTER_MS);
  return Math.max(60 * 1000, Math.floor(base + jitter));
}

async function startDriftLoop(signal) {
  while (!signal.stopped) {
    try {
      await applyDriftTick();
    } catch (err) {
      console.error('Drift loop error:', err);
    }
    await sleep(getRandomDriftDelay());
  }
}

async function startTribunalLoop(signal) {
  while (!signal.stopped) {
    try {
      await runTribunalTick();
    } catch (err) {
      console.error('Tribunal loop error:', err);
    }
    await sleep(getRandomTribunalDelay());
  }
}

function startSchedulers() {
  const signal = { stopped: false };
  startDriftLoop(signal);
  startTribunalLoop(signal);
  startMidnightSnapshotLoop(signal);
  return () => { signal.stopped = true; };
}

module.exports = { startSchedulers };

// Midnight snapshot (UTC): set index_value_midnight_utc to current index_value
function msUntilNextUtcMidnight() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const next = new Date(Date.UTC(year, month, day + 1, 0, 0, 0));
  return next.getTime() - now.getTime();
}

async function runMidnightSnapshot() {
  try {
    await db.query('UPDATE citizens SET index_value_midnight_utc = index_value');
    await db.query(
      `INSERT INTO events (event_type, target_id, message, delta_percent) VALUES ($1, NULL, $2, $3)`,
      ['midnight_snapshot', 'Midnight snapshot captured.', 0]
    );
  } catch (err) {
    console.error('Midnight snapshot error:', err);
  }
}

async function startMidnightSnapshotLoop(signal) {
  while (!signal.stopped) {
    const waitMs = msUntilNextUtcMidnight();
    await sleep(waitMs);
    if (signal.stopped) break;
    await runMidnightSnapshot();
  }
}


