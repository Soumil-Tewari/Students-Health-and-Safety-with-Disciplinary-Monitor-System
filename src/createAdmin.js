require('dotenv').config();
const bcrypt = require('bcryptjs'), db = require('./db');
const { ADMIN_EMAIL: e, ADMIN_NAME: n = 'Admin', ADMIN_PASSWORD: p } = process.env;
if (!e || !p || p.length < 10) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars) in .env. If the password contains # or spaces, wrap it in double quotes.'); process.exit(1); }
const email = e.toLowerCase().trim(), hash = bcrypt.hashSync(p, 12);
const ex = db.prepare('SELECT user_id FROM app_user WHERE email=?').get(email);
if (ex) {
  db.prepare("UPDATE app_user SET password_hash=?, role='admin', active=1 WHERE user_id=?").run(hash, ex.user_id);
  console.log('Existing user updated: password reset for', email);
} else {
  db.prepare('INSERT INTO app_user(name,email,password_hash,role) VALUES(?,?,?,?)').run(n, email, hash, 'admin');
  console.log('Admin created:', email);
}
console.log('Login with that email and password, then remove ADMIN_PASSWORD from .env');
