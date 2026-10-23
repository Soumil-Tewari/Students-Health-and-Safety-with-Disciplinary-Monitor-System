const { DatabaseSync } = require('node:sqlite'); // built into Node 22.13+ (no native build)
const fs = require('fs'), path = require('path');
const file = process.env.DB_FILE || './data/school.db';
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const ts = `archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))`;

// All FKs use ON DELETE RESTRICT: records are archived, never cascaded away.
db.exec(`
CREATE TABLE IF NOT EXISTS student (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, dob TEXT, gender TEXT CHECK (gender IN ('Male','Female','Other')),
  class TEXT, department TEXT, phone TEXT, ${ts});
CREATE TABLE IF NOT EXISTS parent (
  parent_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT, email TEXT, ${ts});
CREATE TABLE IF NOT EXISTS student_parent (
  student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  parent_id INTEGER NOT NULL REFERENCES parent(parent_id) ON DELETE RESTRICT,
  relation TEXT NOT NULL,
  PRIMARY KEY (student_id, parent_id));
CREATE TABLE IF NOT EXISTS staff (
  staff_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, ${ts});
CREATE TABLE IF NOT EXISTS health_record (
  health_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  date TEXT NOT NULL, illness TEXT NOT NULL, medication TEXT, doctor_notes TEXT, ${ts});
CREATE TABLE IF NOT EXISTS safety_incident (
  incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  date TEXT NOT NULL, location TEXT, incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
  description TEXT,
  staff_id INTEGER REFERENCES staff(staff_id) ON DELETE RESTRICT, ${ts});
CREATE TABLE IF NOT EXISTS discipline_record (
  record_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  date TEXT NOT NULL, violation TEXT NOT NULL, action_taken TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Under Review','Resolved','Closed')), ${ts});
CREATE TABLE IF NOT EXISTS alert (
  alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  staff_id INTEGER REFERENCES staff(staff_id) ON DELETE RESTRICT,
  alert_type TEXT NOT NULL, date_time TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'Unread' CHECK (status IN ('Unread','Acknowledged','Resolved')), ${ts});
CREATE TABLE IF NOT EXISTS app_user (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff','medical','viewer')),
  staff_id INTEGER REFERENCES staff(staff_id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, entity TEXT,
  entity_id TEXT, detail TEXT, at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_health_student ON health_record(student_id, date);
CREATE INDEX IF NOT EXISTS ix_incident_student ON safety_incident(student_id, date);
CREATE INDEX IF NOT EXISTS ix_incident_staff ON safety_incident(staff_id);
CREATE INDEX IF NOT EXISTS ix_disc_student ON discipline_record(student_id, status);
CREATE INDEX IF NOT EXISTS ix_alert_student ON alert(student_id, status);
CREATE INDEX IF NOT EXISTS ix_alert_staff ON alert(staff_id);
CREATE INDEX IF NOT EXISTS ix_sp_parent ON student_parent(parent_id);
`);
module.exports = db;
