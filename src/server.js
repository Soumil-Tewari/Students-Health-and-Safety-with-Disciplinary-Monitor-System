require('dotenv').config();
const express = require('express'), cors = require('cors'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), path = require('path'), crypto = require('crypto');
const db = require('./db');
const { scheduleReplicaSync } = require('./neonReplica');

const SECRET = process.env.JWT_SECRET || (console.warn('JWT_SECRET not set: using a random one (tokens reset on restart)'), crypto.randomBytes(32).toString('hex'));
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(DIST));

const ALL = ['admin', 'staff', 'medical', 'viewer'];
const audit = (u, action, entity, id, detail) =>
  db.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)')
    .run(u.id, action, entity, String(id ?? ''), detail ? JSON.stringify(detail) : null);

// ---- Resource definitions (r=required, e=enum, d=date, t=textarea, em=email, def=default)
const RES = {
  students: { table: 'student', pk: 'student_id', read: ALL, write: ['admin', 'staff'],
    search: ['student_id', 'name', 'class', 'department'], filters: ['class', 'department', 'gender'],
    fields: { name: { r: 1 }, dob: { d: 1 }, gender: { e: ['Male', 'Female', 'Other'] }, class: {}, department: {}, phone: {} } },
  parents: { table: 'parent', pk: 'parent_id', read: ['admin', 'staff', 'viewer'], write: ['admin', 'staff'],
    search: ['name', 'phone', 'email'], filters: [],
    fields: { name: { r: 1 }, phone: {}, email: { em: 1 } } },
  staff: { table: 'staff', pk: 'staff_id', read: ALL, write: ['admin'],
    search: ['name', 'role'], filters: ['role'],
    fields: { name: { r: 1 }, role: { r: 1 }, phone: {} } },
  health: { table: 'health_record', pk: 'health_id', read: ['admin', 'medical'], write: ['admin', 'medical'], sensitive: 1,
    search: ['illness', 'medication'], filters: ['student_id'], date: 'date',
    fields: { student_id: { r: 1, n: 1 }, date: { r: 1, d: 1 }, illness: { r: 1 }, medication: {}, doctor_notes: { t: 1 } } },
  incidents: { table: 'safety_incident', pk: 'incident_id', read: ['admin', 'staff', 'medical'], write: ['admin', 'staff'],
    search: ['location', 'incident_type', 'description'], filters: ['severity', 'incident_type', 'student_id'], date: 'date',
    fields: { student_id: { r: 1, n: 1 }, date: { r: 1, d: 1 }, location: {}, incident_type: { r: 1 },
      severity: { r: 1, e: ['Low', 'Medium', 'High', 'Critical'] }, description: { t: 1 }, staff_id: { n: 1 } } },
  discipline: { table: 'discipline_record', pk: 'record_id', read: ['admin', 'staff'], write: ['admin', 'staff'], sensitive: 1,
    search: ['violation', 'action_taken'], filters: ['status', 'student_id'], date: 'date',
    fields: { student_id: { r: 1, n: 1 }, date: { r: 1, d: 1 }, violation: { r: 1 }, action_taken: { t: 1 },
      status: { e: ['Open', 'Under Review', 'Resolved', 'Closed'], def: 'Open' } } },
  alerts: { table: 'alert', pk: 'alert_id', read: ['admin', 'staff', 'medical'], write: ['admin', 'staff'],
    search: ['alert_type'], filters: ['status', 'alert_type', 'student_id'], date: 'date_time',
    fields: { student_id: { r: 1, n: 1 }, staff_id: { n: 1 }, alert_type: { r: 1 },
      status: { e: ['Unread', 'Acknowledged', 'Resolved'], def: 'Unread' } } },
};

function clean(c, b, partial) {
  const o = {}, errs = [];
  for (const [k, s] of Object.entries(c.fields)) {
    let v = b[k];
    if (v === undefined) {
      if (partial) continue;
      if (s.def) v = s.def; else if (s.r) { errs.push(`${k} is required`); continue; } else continue;
    }
    if (v === '' || v === null) v = null;
    if (v === null && s.r) { errs.push(`${k} is required`); continue; }
    if (v !== null && s.n && !Number.isInteger(Number(v))) errs.push(`${k} must be a number`);
    if (v !== null && s.n) v = Number(v);
    if (v !== null && s.e && !s.e.includes(v)) errs.push(`${k} must be one of: ${s.e.join(', ')}`);
    if (v !== null && s.d && !/^\d{4}-\d{2}-\d{2}/.test(v)) errs.push(`${k} must be YYYY-MM-DD`);
    if (v !== null && s.em && !/^\S+@\S+\.\S+$/.test(v)) errs.push(`${k} must be a valid email`);
    if (typeof v === 'string' && v.length > 2000) errs.push(`${k} too long`);
    o[k] = v;
  }
  return { o, errs };
}

// ---- Auth
const auth = (req, res, next) => {
  try {
    const p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    const u = db.prepare('SELECT user_id,name,role,staff_id FROM app_user WHERE user_id=? AND active=1').get(p.sub);
    if (!u) throw 0;
    req.user = { id: u.user_id, name: u.name, role: u.role, staff_id: u.staff_id };
    next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : (audit(req.user, 'DENIED', req.path), res.status(403).json({ error: 'Forbidden' }));

app.get('/api/status', (req, res) => res.json({ ok: true, hasUsers: db.prepare('SELECT COUNT(*) n FROM app_user').get().n > 0 }));
app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const u = db.prepare('SELECT * FROM app_user WHERE email=? AND active=1').get(String(email).toLowerCase());
  if (!u || !bcrypt.compareSync(String(password), u.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ sub: u.user_id }, SECRET, { expiresIn: '8h' });
  audit({ id: u.user_id }, 'LOGIN', 'app_user', u.user_id);
  res.json({ token, user: { name: u.name, role: u.role } });
});
app.use('/api', auth);
app.post('/api/auth/logout', (req, res) => { audit(req.user, 'LOGOUT', 'app_user', req.user.id); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json(req.user));

app.get('/api/meta', (req, res) => {
  const m = {};
  for (const [k, c] of Object.entries(RES)) if (c.read.includes(req.user.role))
    m[k] = { pk: c.pk, fields: c.fields, filters: c.filters, canWrite: c.write.includes(req.user.role), hasStudent: !!c.fields.student_id, dated: !!c.date };
  res.json({ role: req.user.role, resources: m });
});

// ---- Dashboard (real aggregates; sensitive counts only for permitted roles)
app.get('/api/dashboard', (req, res) => {
  const r = req.user.role, one = (s) => db.prepare(s).get().n;
  const can = (k) => RES[k].read.includes(r);
  res.json({
    students: one('SELECT COUNT(*) n FROM student WHERE archived=0'),
    staff: one('SELECT COUNT(*) n FROM staff WHERE archived=0'),
    incidents: can('incidents') ? one('SELECT COUNT(*) n FROM safety_incident WHERE archived=0') : null,
    healthRecords: can('health') ? one('SELECT COUNT(*) n FROM health_record WHERE archived=0') : null,
    pendingDiscipline: can('discipline') ? one("SELECT COUNT(*) n FROM discipline_record WHERE archived=0 AND status IN ('Open','Under Review')") : null,
    unresolvedAlerts: can('alerts') ? one("SELECT COUNT(*) n FROM alert WHERE archived=0 AND status!='Resolved'") : null,
    incidentTrend: can('incidents') ? db.prepare("SELECT substr(date,1,7) month, COUNT(*) n FROM safety_incident WHERE archived=0 GROUP BY month ORDER BY month DESC LIMIT 6").all().reverse() : null,
    disciplineByStatus: can('discipline') ? db.prepare('SELECT status, COUNT(*) n FROM discipline_record WHERE archived=0 GROUP BY status').all() : null,
    recentIncidents: can('incidents') ? db.prepare('SELECT i.incident_id,i.date,i.incident_type,i.severity,s.name student_name FROM safety_incident i JOIN student s USING(student_id) WHERE i.archived=0 ORDER BY i.date DESC,i.incident_id DESC LIMIT 5').all() : null,
    recentAlerts: can('alerts') ? db.prepare('SELECT a.alert_id,a.date_time,a.alert_type,a.status,s.name student_name FROM alert a JOIN student s USING(student_id) WHERE a.archived=0 ORDER BY a.date_time DESC,a.alert_id DESC LIMIT 5').all() : null,
    recentActivity: r === 'admin' ? db.prepare('SELECT at,action,entity,entity_id FROM audit_log ORDER BY id DESC LIMIT 8').all() : null,
  });
});

// ---- Generic CRUD
const dbErr = (e, res, next) => /constraint failed/i.test(e.message || '')
  ? res.status(400).json({ error: /FOREIGN KEY/.test(e.message) ? 'Referenced record does not exist' : 'Constraint violation: ' + e.message })
  : next(e);

function profile(k, row, user) {
  const q = (sql, ...a) => db.prepare(sql).all(...a), can = (x) => RES[x].read.includes(user.role);
  if (k === 'students') {
    row.parents = q('SELECT p.parent_id,p.name,p.phone,p.email,sp.relation FROM student_parent sp JOIN parent p USING(parent_id) WHERE sp.student_id=? AND p.archived=0', row.student_id);
    if (can('incidents')) row.incidents = q('SELECT * FROM safety_incident WHERE student_id=? AND archived=0 ORDER BY date DESC', row.student_id);
    if (can('discipline')) row.discipline = q('SELECT * FROM discipline_record WHERE student_id=? AND archived=0 ORDER BY date DESC', row.student_id);
    if (can('alerts')) row.alerts = q('SELECT * FROM alert WHERE student_id=? AND archived=0 ORDER BY date_time DESC', row.student_id);
    if (can('health')) row.health = q('SELECT * FROM health_record WHERE student_id=? AND archived=0 ORDER BY date DESC', row.student_id);
  }
  if (k === 'parents') row.students = q('SELECT s.student_id,s.name,s.class,sp.relation FROM student_parent sp JOIN student s USING(student_id) WHERE sp.parent_id=?', row.parent_id);
  if (k === 'staff') {
    row.incidents_reported = q('SELECT incident_id,date,incident_type,severity FROM safety_incident WHERE staff_id=? AND archived=0', row.staff_id);
    row.alerts_generated = q('SELECT alert_id,date_time,alert_type,status FROM alert WHERE staff_id=? AND archived=0', row.staff_id);
  }
  return row;
}

for (const [k, c] of Object.entries(RES)) {
  const r = express.Router(), hasS = !!c.fields.student_id;
  const from = `${c.table} t ${hasS ? 'LEFT JOIN student s ON s.student_id=t.student_id' : ''}`;
  const sel = `t.*${hasS ? ', s.name AS student_name' : ''}`;

  r.get('/', allow(...c.read), (req, res) => {
    const q = req.query, w = [], p = [];
    if (q.archived !== '1') w.push('t.archived=0');
    if (q.q) {
      const parts = c.search.map(f => `CAST(t.${f} AS TEXT) LIKE ?`); p.push(...c.search.map(() => `%${q.q}%`));
      if (hasS) { parts.push('s.name LIKE ?'); p.push(`%${q.q}%`); }
      w.push(`(${parts.join(' OR ')})`);
    }
    for (const f of c.filters) if (q[f]) { w.push(`t.${f}=?`); p.push(q[f]); }
    if (k === 'alerts' && q.unresolved === '1') w.push("t.status!='Resolved'");
    if (c.date && q.from) { w.push(`t.${c.date}>=?`); p.push(q.from); }
    if (c.date && q.to) { w.push(`t.${c.date}<=?`); p.push(q.to + 'z'); }
    const sort = [c.pk, ...Object.keys(c.fields)].includes(q.sort) ? q.sort : c.pk;
    const dir = q.order === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 100), page = Math.max(parseInt(q.page) || 1, 1);
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) n FROM ${from} ${where}`).get(...p).n;
    const rows = db.prepare(`SELECT ${sel} FROM ${from} ${where} ORDER BY t.${sort} ${dir} LIMIT ? OFFSET ?`).all(...p, limit, (page - 1) * limit);
    if (c.sensitive) audit(req.user, 'LIST', c.table, null, q);
    res.json({ data: rows, total, page, limit });
  });

  r.get('/:id', allow(...c.read), (req, res) => {
    const row = db.prepare(`SELECT ${sel} FROM ${from} WHERE t.${c.pk}=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (c.sensitive) audit(req.user, 'VIEW', c.table, req.params.id);
    res.json(profile(k, row, req.user));
  });

  r.post('/', allow(...c.write), (req, res, next) => {
    const { o, errs } = clean(c, req.body || {}, false);
    if (errs.length) return res.status(422).json({ error: errs.join('; ') });
    try {
      const cols = Object.keys(o);
      const info = db.prepare(`INSERT INTO ${c.table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).run(...Object.values(o));
      audit(req.user, 'CREATE', c.table, info.lastInsertRowid);
      scheduleReplicaSync();
      res.status(201).json(db.prepare(`SELECT * FROM ${c.table} WHERE ${c.pk}=?`).get(info.lastInsertRowid));
    } catch (e) { dbErr(e, res, next); }
  });

  r.put('/:id', allow(...c.write), (req, res, next) => {
    const { o, errs } = clean(c, req.body || {}, true);
    if (errs.length) return res.status(422).json({ error: errs.join('; ') });
    const cols = Object.keys(o);
    if (!cols.length) return res.status(422).json({ error: 'No fields to update' });
    try {
      const info = db.prepare(`UPDATE ${c.table} SET ${cols.map(x => x + '=?').join(',')}, updated_at=datetime('now') WHERE ${c.pk}=?`).run(...Object.values(o), req.params.id);
      if (!info.changes) return res.status(404).json({ error: 'Not found' });
      audit(req.user, 'UPDATE', c.table, req.params.id, o);
      scheduleReplicaSync();
      res.json(db.prepare(`SELECT * FROM ${c.table} WHERE ${c.pk}=?`).get(req.params.id));
    } catch (e) { dbErr(e, res, next); }
  });

  // DELETE archives (soft delete); medical/disciplinary/incident data is never physically removed.
  r.delete('/:id', allow(...c.write), (req, res) => {
    const info = db.prepare(`UPDATE ${c.table} SET archived=1, updated_at=datetime('now') WHERE ${c.pk}=?`).run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Not found' });
    audit(req.user, 'ARCHIVE', c.table, req.params.id);
    scheduleReplicaSync();
    res.json({ ok: true });
  });
  app.use('/api/' + k, r);
}

// ---- Student <-> Parent links
app.post('/api/links', allow('admin', 'staff'), (req, res, next) => {
  const { student_id, parent_id, relation } = req.body || {};
  if (!student_id || !parent_id || !relation) return res.status(422).json({ error: 'student_id, parent_id and relation are required' });
  try {
    db.prepare('INSERT INTO student_parent(student_id,parent_id,relation) VALUES(?,?,?)').run(student_id, parent_id, relation);
    audit(req.user, 'LINK', 'student_parent', `${student_id}-${parent_id}`);
    scheduleReplicaSync();
    res.status(201).json({ ok: true });
  } catch (e) { /UNIQUE|PRIMARY/.test(e.message) ? res.status(409).json({ error: 'Already linked' }) : dbErr(e, res, next); }
});
app.delete('/api/links/:sid/:pid', allow('admin', 'staff'), (req, res) => {
  const i = db.prepare('DELETE FROM student_parent WHERE student_id=? AND parent_id=?').run(req.params.sid, req.params.pid);
  if (!i.changes) return res.status(404).json({ error: 'Link not found' });
  audit(req.user, 'UNLINK', 'student_parent', `${req.params.sid}-${req.params.pid}`);
  scheduleReplicaSync();
  res.json({ ok: true });
});

// ---- User management (admin) and audit log
const ROLES = ['admin', 'staff', 'medical', 'viewer'];
app.get('/api/users', allow('admin'), (req, res) => res.json(db.prepare('SELECT user_id,name,email,role,staff_id,active FROM app_user').all()));
app.post('/api/users', allow('admin'), (req, res, next) => {
  const { name, email, password, role, staff_id = null } = req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || !ROLES.includes(role) || (password || '').length < 10)
    return res.status(422).json({ error: 'name, valid email, role and password (min 10 chars) required' });
  try {
    const i = db.prepare('INSERT INTO app_user(name,email,password_hash,role,staff_id) VALUES(?,?,?,?,?)').run(name, email.toLowerCase(), bcrypt.hashSync(password, 12), role, staff_id);
    audit(req.user, 'CREATE', 'app_user', i.lastInsertRowid);
    scheduleReplicaSync();
    res.status(201).json({ user_id: i.lastInsertRowid });
  } catch (e) { /UNIQUE/.test(e.message) ? res.status(409).json({ error: 'Email already in use' }) : dbErr(e, res, next); }
});
app.delete('/api/users/:id', allow('admin'), (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate yourself' });
  const i = db.prepare('UPDATE app_user SET active=0 WHERE user_id=?').run(req.params.id);
  i.changes ? (audit(req.user, 'DEACTIVATE', 'app_user', req.params.id), scheduleReplicaSync(), res.json({ ok: true })) : res.status(404).json({ error: 'Not found' });
});
app.get('/api/audit', allow('admin'), (req, res) => res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all()));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html'), e => e && res.status(404).send('Frontend not built: run npm run build')));
if (require.main === module) {
  scheduleReplicaSync();
  app.listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:' + (process.env.PORT || 3000)));
}
module.exports = app;
