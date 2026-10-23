const db = require('./db');

const tables = [
  ['student', 'student_id'],
  ['parent', 'parent_id'],
  ['staff', 'staff_id'],
  ['health_record', 'health_id'],
  ['safety_incident', 'incident_id'],
  ['discipline_record', 'record_id'],
  ['alert', 'alert_id'],
  ['app_user', 'user_id'],
  ['audit_log', 'id'],
  ['student_parent', null]
];

let pool;
let pending = null;
let warned = false;

function getPool() {
  if (!process.env.NEON_DATABASE_URL) {
    if (!warned) {
      console.warn('NEON_DATABASE_URL not set: Neon replica sync is disabled.');
      warned = true;
    }
    return null;
  }
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2
    });
  }
  return pool;
}

async function createSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS student (
      student_id INTEGER PRIMARY KEY, name TEXT NOT NULL, dob TEXT, gender TEXT,
      class TEXT, department TEXT, phone TEXT, archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parent (
      parent_id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
      archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff (
      staff_id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT,
      archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS health_record (
      health_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT NOT NULL,
      illness TEXT NOT NULL, medication TEXT, doctor_notes TEXT, archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS safety_incident (
      incident_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT NOT NULL,
      location TEXT, incident_type TEXT NOT NULL, severity TEXT NOT NULL, description TEXT,
      staff_id INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS discipline_record (
      record_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT NOT NULL,
      violation TEXT NOT NULL, action_taken TEXT, status TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alert (
      alert_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, staff_id INTEGER, alert_type TEXT NOT NULL,
      date_time TEXT NOT NULL, status TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_user (
      user_id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL, staff_id INTEGER, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, entity TEXT, entity_id TEXT, detail TEXT, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS student_parent (
      student_id INTEGER NOT NULL, parent_id INTEGER NOT NULL, relation TEXT NOT NULL,
      PRIMARY KEY (student_id, parent_id)
    );
  `);
}

async function syncNow() {
  const p = getPool();
  if (!p) return;
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    await createSchema(client);
    await client.query('TRUNCATE student_parent, alert, discipline_record, safety_incident, health_record, parent, student, staff, app_user, audit_log');
    for (const [table] of tables) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const quoted = columns.map(c => `"${c}"`).join(', ');
      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`, values);
      }
    }
    await client.query('COMMIT');
    console.log('Neon replica synchronized.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Neon replica sync failed:', error.message);
  } finally {
    client.release();
  }
}

function scheduleReplicaSync() {
  if (pending) return;
  pending = Promise.resolve().then(syncNow).finally(() => { pending = null; });
}

module.exports = { scheduleReplicaSync, syncNow };
