// One-time reset for a Super admin's login: optionally changes the email, and sets a new password
// that you type in the terminal (hidden, typed twice). The password is never printed or saved anywhere
// except as a bcrypt hash in the users table.
//
// Usage (run in PowerShell or Command Prompt, so the password can be hidden):
//   node scripts/reset-admin-password.js <current-email> [new-email]
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../server/db');

// Same rules as the site (server/routes/admin.js): email format, password at least 10 characters, bcrypt cost 12.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_LEN = 10;
const MAX_BYTES = 72; // bcrypt ignores anything after 72 bytes, so refuse longer passwords instead of silently cutting them
const COST = 12;

function fail(msg) {
  console.error('\n' + msg + '\n');
  process.exitCode = 1;
}

// Reads one line without echoing it. Needs a real terminal (PowerShell / Command Prompt).
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    process.stdout.write(question);
    let value = '';
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          done();
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') { // Ctrl+C
          done();
          process.stdout.write('\n');
          return reject(new Error('Cancelled.'));
        }
        if (ch === '\u0008' || ch === '\u007f') { value = value.slice(0, -1); continue; } // Backspace
        if (ch >= ' ') value += ch;
      }
    };
    function done() {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
    }
    input.on('data', onData);
  });
}

function askVisible(question) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

(async () => {
  const args = process.argv.slice(2);
  if (args.some((a) => !EMAIL_RE.test(a)) || args.length < 1 || args.length > 2) {
    return fail('Usage: node scripts/reset-admin-password.js <current-email> [new-email]\n(Do not put a password on the command line. You will be asked for it.)');
  }
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return fail('This terminal cannot hide typed passwords. Run the command in PowerShell or Command Prompt instead\n(in Git Bash you can use: winpty node scripts/reset-admin-password.js ...).');
  }
  const fromEmail = args[0].toLowerCase();
  const toEmail = (args[1] || args[0]).toLowerCase();

  const [found] = await pool.execute('SELECT id, email, role, active FROM users WHERE email = ? LIMIT 1', [fromEmail]);
  const user = found[0];
  if (!user) return fail('No user with the email ' + fromEmail + '. Nothing changed.');
  if (user.role !== 'super_admin') return fail(fromEmail + ' is not a Super admin. Nothing changed.');
  if (toEmail !== fromEmail) {
    const [taken] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [toEmail]);
    if (taken[0]) return fail(toEmail + ' is already used by another user (id ' + taken[0].id + '). Nothing changed.');
  }

  console.log('\nSuper admin found: id ' + user.id + ', ' + user.email + (user.active ? '' : ' (currently INACTIVE, will be re-activated)'));
  if (toEmail !== fromEmail) console.log('Email will change to: ' + toEmail);
  console.log('Password rules: at least ' + MIN_LEN + ' characters. Typing is hidden.\n');

  const p1 = await askHidden('New password: ');
  if (p1.length < MIN_LEN) return fail('Password must be at least ' + MIN_LEN + ' characters. Nothing changed.');
  if (Buffer.byteLength(p1, 'utf8') > MAX_BYTES) return fail('Password is too long (max ' + MAX_BYTES + ' bytes). Nothing changed.');
  const p2 = await askHidden('Type it again: ');
  if (p1 !== p2) return fail('The two passwords do not match. Nothing changed.');

  const ok = await askVisible('\nType YES to save these changes: ');
  if (ok !== 'YES') return fail('Not confirmed. Nothing changed.');

  const hash = await bcrypt.hash(p1, COST);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      "UPDATE users SET email = ?, password_hash = ?, active = 1 WHERE id = ? AND role = 'super_admin'",
      [toEmail, hash, user.id]
    );
    if (r.affectedRows !== 1) throw new Error('Expected to update 1 user, updated ' + r.affectedRows);
    await conn.execute(
      'INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [user.id, 'reset-admin-password script (' + toEmail + ')', 'reset_password', 'users', String(user.id)]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  console.log('\nDone. Log in at /admin/login.html with ' + toEmail + ' and the password you just typed.');
  if (toEmail !== fromEmail) console.log('The old email ' + fromEmail + ' no longer works.');
  console.log('Recorded "reset_password" in Admin > Activity log.\n');
})()
  .catch((e) => fail('Reset failed: ' + e.message + '\nNothing changed.'))
  .finally(() => pool.end().catch(() => {}));
