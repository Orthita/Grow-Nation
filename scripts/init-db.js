// Creates the database, tables, starter content and the first Super admin.
// Usage: npm run init-db
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const root = path.join(__dirname, '..');
const strip = (sql) => sql.replace(/^\s*(CREATE DATABASE|USE)\b[^;]*;\s*$/gim, '');

(async () => {
  const db = process.env.DB_NAME || 'grow_nation';
  if (!/^[A-Za-z0-9_]+$/.test(db)) throw new Error('DB_NAME may only contain letters, numbers and underscore');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);
  await conn.query(strip(fs.readFileSync(path.join(root, 'database', 'schema.sql'), 'utf8')));
  console.log('Tables ready.');

  // Small upgrades for databases created before a column or value existed. Each step is safe to repeat.
  const colInfo = async (table, col) => (await conn.query(
    'SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [db, table, col]
  ))[0][0];
  if (!(await colInfo('courses', 'fee'))) {
    await conn.query('ALTER TABLE courses ADD COLUMN fee VARCHAR(120) NULL AFTER duration');
    console.log('Upgrade: added courses.fee');
  }
  const st = await colInfo('enrollments', 'status');
  if (st && !/'rejected'/.test(st.t)) {
    await conn.query("ALTER TABLE enrollments MODIFY status ENUM('pending','contacted','confirmed','rejected','cancelled') NOT NULL DEFAULT 'pending'");
    await conn.query("UPDATE enrollments SET status = 'rejected' WHERE status = 'cancelled'");
    await conn.query("ALTER TABLE enrollments MODIFY status ENUM('pending','contacted','confirmed','rejected') NOT NULL DEFAULT 'pending'");
    console.log('Upgrade: enrollment status "cancelled" is now "rejected"');
  }

  const [[cat]] = await conn.query('SELECT COUNT(*) AS n FROM categories');
  if (cat.n === 0 && !process.argv.includes('--no-seed')) {
    await conn.query(strip(fs.readFileSync(path.join(root, 'database', 'seed.sql'), 'utf8')));
    console.log('Starter content added (courses, slides, contact details). No certificates: add real ones in the admin panel.');
  } else {
    console.log('Starter content skipped (database already has data).');
  }

  const [[usr]] = await conn.query('SELECT COUNT(*) AS n FROM users');
  if (usr.n === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password || password.length < 10) {
      password = crypto.randomBytes(9).toString('base64url');
      generated = true;
    }
    const hash = await bcrypt.hash(password, 12);
    await conn.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [process.env.ADMIN_NAME || 'Super Admin', email, hash, 'super_admin']
    );
    console.log('\nFirst Super admin created:');
    console.log('  Email:    ' + email);
    console.log('  Password: ' + password + (generated ? '   (generated, change it after first login)' : ''));
  } else {
    console.log('Admin users already exist, nothing created.');
  }

  await conn.end();
  console.log('\nDone.');
})().catch((e) => {
  console.error('init-db failed:', e.message);
  process.exit(1);
});
