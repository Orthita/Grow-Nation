const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { requireAuth, allow, issue, clear } = require('../middleware/auth');
const { clean } = require('../lib/validate');
const totp = require('../lib/totp');
const { encrypt, decrypt } = require('../lib/crypto');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ROLES = ['super_admin', 'editor', 'certificate_officer', 'support'];
const CONTENT = ['super_admin', 'editor'];
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// ---- CSRF guard: every write needs a header that other websites cannot set ----
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'fetch') {
    return res.status(403).json({ error: 'Bad request' });
  }
  next();
});

async function audit(req, action, table, recordId, user) {
  const u = user || req.user || {};
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [u.id || null, u.email || u.name || null, action, table || null, recordId == null ? null : String(recordId)]
    );
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

function dbError(e, res, next) {
  if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That value already exists (it must be unique).' });
  if (e && (e.code === 'ER_ROW_IS_REFERENCED_2' || e.code === 'ER_ROW_IS_REFERENCED')) {
    return res.status(409).json({ error: 'This record is used by something else (for example a certificate). Hide it instead of deleting it.' });
  }
  if (e && e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'The linked record does not exist.' });
  return next(e);
}

// ======================= Login / logout =======================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  const code = req.body && req.body.code;
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password' });

  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  const u = rows[0];
  const passOk = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !u.active || !passOk) {
    await audit(req, 'login_failed', 'users', u ? u.id : null, { email });
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  if (u.twofa_enabled) {
    if (!code) return res.json({ need_code: true });
    let ok = false;
    try { ok = totp.verify(decrypt(u.totp_secret), code); } catch (e) { ok = false; }
    if (!ok) {
      await audit(req, 'login_bad_code', 'users', u.id, u);
      return res.status(401).json({ error: 'Wrong or expired code', need_code: true });
    }
  }

  await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [u.id]);
  issue(res, u);
  await audit(req, 'login', 'users', u.id, u);
  res.json({ ok: true });
}));

router.post('/logout', (req, res) => {
  clear(res);
  res.json({ ok: true });
});

// Everything below needs a logged-in user.
router.use(requireAuth);

router.get('/me', (req, res) => {
  const { id, name, email, role, twofa_enabled } = req.user;
  res.json({ id, name, email, role, twofa_enabled: !!twofa_enabled });
});

router.post('/change-password', wrap(async (req, res) => {
  const { current, next: np } = req.body || {};
  if (typeof np !== 'string' || np.length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), rows[0].password_hash))) {
    return res.status(400).json({ error: 'Current password is wrong' });
  }
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(np, 12), req.user.id]);
  await audit(req, 'change_password', 'users', req.user.id);
  res.json({ ok: true });
}));

// ======================= Two-step login =======================
router.post('/2fa/setup', wrap(async (req, res) => {
  if (req.user.twofa_enabled) return res.status(400).json({ error: 'Two-step login is already on' });
  const secret = totp.generateSecret();
  await pool.execute('UPDATE users SET totp_secret = ? WHERE id = ?', [encrypt(secret), req.user.id]);
  res.json({ secret, otpauth: totp.otpauthUrl(secret, req.user.email) });
}));

router.post('/2fa/enable', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT totp_secret, twofa_enabled FROM users WHERE id = ?', [req.user.id]);
  if (!rows[0].totp_secret || rows[0].twofa_enabled) return res.status(400).json({ error: 'Start the setup first' });
  if (!totp.verify(decrypt(rows[0].totp_secret), req.body && req.body.code)) {
    return res.status(400).json({ error: 'That code is wrong. Check the time on your phone and try again.' });
  }
  await pool.execute('UPDATE users SET twofa_enabled = 1 WHERE id = ?', [req.user.id]);
  await audit(req, '2fa_enabled', 'users', req.user.id);
  res.json({ ok: true });
}));

router.post('/2fa/disable', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String((req.body && req.body.password) || ''), rows[0].password_hash))) {
    return res.status(400).json({ error: 'Password is wrong' });
  }
  await pool.execute('UPDATE users SET twofa_enabled = 0, totp_secret = NULL WHERE id = ?', [req.user.id]);
  await audit(req, '2fa_disabled', 'users', req.user.id);
  res.json({ ok: true });
}));

// ======================= Uploads =======================
const uploadsDir = path.join(__dirname, '..', 'uploads');
const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXT[file.mimetype]) return cb(new Error('Only images, PDF, Word, Excel and PowerPoint files are allowed'));
    cb(null, true);
  },
});

router.post('/upload', allow('super_admin', 'editor', 'certificate_officer'), (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is bigger than 8 MB' : err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    await audit(req, 'upload', 'uploads', req.file.filename);
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// ======================= Overview, lookups, contact details, audit log =======================
router.get('/stats', wrap(async (req, res) => {
  const one = async (sql) => (await pool.execute(sql))[0][0].n;
  const out = {};
  if (['super_admin', 'support'].includes(req.user.role)) out.new_enquiries = await one("SELECT COUNT(*) n FROM enquiries WHERE status='new'");
  if (['super_admin', 'support'].includes(req.user.role)) out.total_enquiries = await one('SELECT COUNT(*) n FROM enquiries');
  if (CONTENT.includes(req.user.role)) out.published_courses = await one("SELECT COUNT(*) n FROM courses WHERE status='published'");
  if (CONTENT.includes(req.user.role)) out.upcoming_batches = await one("SELECT COUNT(*) n FROM batches WHERE status='open' AND start_date >= CURDATE()");
  if (['super_admin', 'certificate_officer'].includes(req.user.role)) {
    out.certificates = await one('SELECT COUNT(*) n FROM certificates');
    out.revoked = await one("SELECT COUNT(*) n FROM certificates WHERE status='revoked'");
  }
  res.json(out);
}));

router.get('/lookups', wrap(async (req, res) => {
  const [categories] = await pool.execute('SELECT id, name FROM categories ORDER BY type, sort_order, id');
  const [courses] = await pool.execute('SELECT id, title FROM courses ORDER BY listing, sort_order, id');
  res.json({ categories, courses });
}));

const SETTING_KEYS = ['office_address', 'registration', 'phone', 'email', 'whatsapp', 'hours'];

router.get('/settings', allow(...CONTENT), wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT setting_key, setting_value FROM settings');
  const out = {};
  SETTING_KEYS.forEach((k) => { out[k] = ''; });
  rows.forEach((r) => { if (SETTING_KEYS.includes(r.setting_key)) out[r.setting_key] = r.setting_value || ''; });
  res.json(out);
}));

router.put('/settings', allow(...CONTENT), wrap(async (req, res) => {
  const def = {};
  SETTING_KEYS.forEach((k) => { def[k] = { t: 'str', max: 300 }; });
  const { out, errors } = clean(def, req.body, true);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (out.whatsapp && !/^[0-9+\s-]{6,20}$/.test(out.whatsapp)) return res.status(400).json({ error: 'WhatsApp number: digits only, with country code (for example 8801XXXXXXXXX)' });
  for (const [k, v] of Object.entries(out)) {
    await pool.execute(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [k, v == null ? '' : v]
    );
  }
  await audit(req, 'update', 'settings', null);
  res.json({ ok: true });
}));

router.get('/audit-logs', allow('super_admin'), wrap(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, user_name, action, table_name, record_id, created_at FROM audit_logs ORDER BY id DESC LIMIT 300'
  );
  res.json(rows);
}));

// ======================= Users (Super admin only) =======================
const userDef = {
  name: { t: 'str', req: true, max: 120 },
  email: { t: 'str', req: true, max: 190, re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, reMsg: 'email looks wrong' },
  role: { t: 'enum', req: true, v: ROLES },
  active: { t: 'bool' },
};

router.get('/users', allow('super_admin'), wrap(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, active, twofa_enabled, last_login, created_at FROM users ORDER BY id'
  );
  res.json(rows);
}));

router.post('/users', allow('super_admin'), wrap(async (req, res, next) => {
  const { out, errors } = clean(userDef, req.body);
  const pw = req.body && req.body.password;
  if (typeof pw !== 'string' || pw.length < 10) errors.push('password must be at least 10 characters');
  if (errors.length) return res.status(400).json({ error: errors[0] });
  try {
    const [r] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,?)',
      [out.name, out.email.toLowerCase(), await bcrypt.hash(pw, 12), out.role, out.active === undefined ? 1 : out.active]
    );
    await audit(req, 'create', 'users', r.insertId);
    res.status(201).json({ id: r.insertId });
  } catch (e) { dbError(e, res, next); }
}));

router.put('/users/:id', allow('super_admin'), wrap(async (req, res, next) => {
  const id = +req.params.id;
  const { out, errors } = clean(userDef, req.body, true);
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (id === req.user.id && ((out.role && out.role !== 'super_admin') || out.active === 0)) {
    return res.status(400).json({ error: 'You cannot remove your own Super admin access' });
  }
  if (out.email) out.email = out.email.toLowerCase();
  const sets = Object.keys(out).map((k) => `\`${k}\` = ?`);
  const vals = Object.values(out);
  const pw = req.body && req.body.password;
  if (pw) {
    if (typeof pw !== 'string' || pw.length < 10) return res.status(400).json({ error: 'password must be at least 10 characters' });
    sets.push('password_hash = ?');
    vals.push(await bcrypt.hash(pw, 12));
  }
  if (req.body && req.body.reset_2fa) sets.push('twofa_enabled = 0', 'totp_secret = NULL');
  if (!sets.length) return res.status(400).json({ error: 'Nothing to change' });
  try {
    const [r] = await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    await audit(req, 'update', 'users', id);
    res.json({ ok: true });
  } catch (e) { dbError(e, res, next); }
}));

router.delete('/users/:id', allow('super_admin'), wrap(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const [r] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  await audit(req, 'delete', 'users', id);
  res.json({ ok: true });
}));

// ======================= Content tables (generic CRUD) =======================
// Table and column names below are fixed constants; all values are passed as prepared-statement parameters.
const PUB = ['published', 'hidden'];
const RES = {
  categories: {
    table: 'categories', roles: CONTENT,
    list: 'SELECT * FROM categories ORDER BY type, sort_order, id',
    fields: {
      name: { t: 'str', req: true, max: 150 },
      type: { t: 'enum', req: true, v: ['training', 'consultancy'] },
      sort_order: { t: 'int', min: 0, max: 9999 },
    },
  },
  courses: {
    table: 'courses', roles: CONTENT,
    list: `SELECT c.*, cat.name AS category_name, cat.type AS category_type
             FROM courses c JOIN categories cat ON cat.id = c.category_id
            ORDER BY c.listing, cat.type, c.sort_order, c.id`,
    fields: {
      category_id: { t: 'int', req: true, min: 1 },
      title: { t: 'str', req: true, max: 200 },
      summary: { t: 'text', max: 1000 },
      topics: { t: 'text', max: 2000 },
      duration: { t: 'str', max: 120 },
      location: { t: 'str', max: 120 },
      standard: { t: 'str', max: 160 },
      best_for: { t: 'str', max: 200 },
      image: { t: 'str', max: 255 },
      listing: { t: 'enum', v: ['card', 'catalogue'] },
      status: { t: 'enum', v: PUB },
      sort_order: { t: 'int', min: 0, max: 9999 },
    },
  },
  batches: {
    table: 'batches', roles: CONTENT,
    list: `SELECT b.*, c.title AS course_title FROM batches b JOIN courses c ON c.id = b.course_id
            ORDER BY b.start_date DESC, b.id DESC`,
    fields: {
      course_id: { t: 'int', req: true, min: 1 },
      start_date: { t: 'date', req: true },
      mode: { t: 'enum', v: ['on-site', 'online'] },
      seats: { t: 'int', min: 0, max: 100000 },
      status: { t: 'enum', v: ['open', 'full', 'cancelled'] },
    },
  },
  enquiries: {
    table: 'enquiries', roles: ['super_admin', 'support'], noCreate: true,
    list: `SELECT e.*, c.title AS course_title FROM enquiries e LEFT JOIN courses c ON c.id = e.course_id
            ORDER BY e.created_at DESC, e.id DESC LIMIT 500`,
    fields: { status: { t: 'enum', req: true, v: ['new', 'contacted', 'closed'] } },
  },
  certificates: {
    table: 'certificates', roles: ['super_admin', 'certificate_officer'],
    list: `SELECT ce.*, co.title AS course_title,
                  (ce.valid_until IS NOT NULL AND ce.valid_until < CURDATE()) AS is_expired
             FROM certificates ce JOIN courses co ON co.id = ce.course_id
            ORDER BY ce.id DESC`,
    fields: {
      number: { t: 'str', req: true, max: 40, upper: true, re: /^GN-[A-Z]{2,3}-\d{4}-\d{3,5}$/, reMsg: 'number must look like GN-FS-2026-0142' },
      course_id: { t: 'int', req: true, min: 1 },
      holder_name: { t: 'str', req: true, max: 150 },
      hours: { t: 'int', min: 0, max: 10000 },
      issue_date: { t: 'date', req: true },
      valid_until: { t: 'date' },
      status: { t: 'enum', v: ['valid', 'revoked'] },
      file: { t: 'str', max: 255 },
    },
  },
  resources: {
    table: 'resources', roles: CONTENT,
    list: 'SELECT * FROM resources ORDER BY id DESC',
    fields: {
      title: { t: 'str', req: true, max: 200 },
      type: { t: 'enum', req: true, v: ['learning', 'career', 'workplace'] },
      description: { t: 'text', max: 1000 },
      image: { t: 'str', max: 255 },
      file_url: { t: 'str', max: 255 },
      link: { t: 'str', max: 255, re: /^https?:\/\//i, reMsg: 'link must start with http:// or https://' },
      status: { t: 'enum', v: PUB },
    },
  },
  slides: {
    table: 'slides', roles: CONTENT,
    list: 'SELECT * FROM slides ORDER BY sort_order, id',
    fields: {
      title: { t: 'str', req: true, max: 200 },
      eyebrow: { t: 'str', max: 60 },
      text: { t: 'str', max: 400 },
      image: { t: 'str', max: 255 },
      button_text: { t: 'str', max: 60 },
      button_link: { t: 'str', max: 255 },
      sort_order: { t: 'int', min: 0, max: 9999 },
      active: { t: 'bool' },
    },
  },
  testimonials: {
    table: 'testimonials', roles: CONTENT,
    list: 'SELECT * FROM testimonials ORDER BY id DESC',
    fields: {
      name: { t: 'str', req: true, max: 150 },
      role: { t: 'str', max: 190 },
      quote: { t: 'text', req: true, max: 600 },
      photo: { t: 'str', max: 255 },
      active: { t: 'bool' },
    },
  },
};

// Links and image paths must be on this site or http(s); blocks javascript: and similar.
function safeUrl(v) {
  return v == null || /^(\/|https?:\/\/)/i.test(v);
}
const URL_FIELDS = ['image', 'photo', 'file_url', 'file', 'button_link'];
// Columns that are NOT NULL in MySQL: an empty form value means "keep / use the default", never NULL.
const NOT_NULL = ['sort_order', 'status', 'listing', 'mode', 'type'];

for (const [name, R] of Object.entries(RES)) {
  const base = '/' + name;
  const cols = (o) => Object.keys(o).map((c) => `\`${c}\``);

  const checked = (body, partial) => {
    const { out, errors } = clean(R.fields, body, partial);
    for (const k of NOT_NULL) if (k in out && out[k] === null) delete out[k];
    for (const f of URL_FIELDS) {
      if (f in out && !safeUrl(out[f])) errors.push(`${f} must be a web address or a path starting with /`);
    }
    return { out, errors };
  };

  router.get(base, allow(...R.roles), wrap(async (req, res) => {
    const [rows] = await pool.execute(R.list);
    res.json(rows);
  }));

  if (!R.noCreate) {
    router.post(base, allow(...R.roles), wrap(async (req, res, next) => {
      const { out, errors } = checked(req.body, false);
      if (errors.length) return res.status(400).json({ error: errors[0] });
      if (!Object.keys(out).length) return res.status(400).json({ error: 'Nothing to save' });
      try {
        const [r] = await pool.execute(
          `INSERT INTO \`${R.table}\` (${cols(out).join(',')}) VALUES (${Object.keys(out).map(() => '?').join(',')})`,
          Object.values(out)
        );
        await audit(req, 'create', R.table, r.insertId);
        res.status(201).json({ id: r.insertId });
      } catch (e) { dbError(e, res, next); }
    }));
  }

  router.put(base + '/:id', allow(...R.roles), wrap(async (req, res, next) => {
    const { out, errors } = checked(req.body, true);
    if (errors.length) return res.status(400).json({ error: errors[0] });
    if (!Object.keys(out).length) return res.status(400).json({ error: 'Nothing to change' });
    try {
      const [r] = await pool.execute(
        `UPDATE \`${R.table}\` SET ${cols(out).map((c) => c + ' = ?').join(', ')} WHERE id = ?`,
        [...Object.values(out), +req.params.id]
      );
      if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
      await audit(req, 'update', R.table, req.params.id);
      res.json({ ok: true });
    } catch (e) { dbError(e, res, next); }
  }));

  router.delete(base + '/:id', allow(...R.roles), wrap(async (req, res, next) => {
    try {
      const [r] = await pool.execute(`DELETE FROM \`${R.table}\` WHERE id = ?`, [+req.params.id]);
      if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
      await audit(req, 'delete', R.table, req.params.id);
      res.json({ ok: true });
    } catch (e) { dbError(e, res, next); }
  }));
}

module.exports = router;
