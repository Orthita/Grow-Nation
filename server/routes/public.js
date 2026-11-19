const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { notifyEnquiry, notifyEnrollment } = require('../mailer');
const { enquiriesEnabled } = require('../config');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiries from this connection. Please try again later or call us.' },
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checks. Please wait a few minutes and try again.' },
});

// ---- Courses and services (published only) ----
router.get('/courses', wrap(async (req, res) => {
  const where = ["c.status = 'published'"];
  const params = [];
  if (['training', 'consultancy'].includes(req.query.type)) {
    where.push('cat.type = ?');
    params.push(req.query.type);
  }
  if (['card', 'catalogue'].includes(req.query.listing)) {
    where.push('c.listing = ?');
    params.push(req.query.listing);
  }
  const [rows] = await pool.execute(
    `SELECT c.id, c.title, c.summary, c.topics, c.duration, c.fee, c.location, c.standard, c.best_for, c.image,
            c.listing, cat.type, cat.name AS category,
            (SELECT MIN(b.start_date) FROM batches b
              WHERE b.course_id = c.id AND b.status = 'open' AND b.start_date >= CURDATE()) AS next_batch
       FROM courses c JOIN categories cat ON cat.id = c.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.sort_order, c.id`,
    params
  );
  res.json(rows.map((r) => ({ ...r, topics: r.topics ? r.topics.split(/\r?\n/).filter(Boolean) : [] })));
}));

router.get('/slides', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, title, eyebrow, text, image, button_text, button_link FROM slides WHERE active = 1 ORDER BY sort_order, id'
  );
  res.json(rows);
}));

router.get('/testimonials', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, name, role, quote, photo FROM testimonials WHERE active = 1 ORDER BY id DESC LIMIT 12'
  );
  res.json(rows);
}));

router.get('/resources', wrap(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, title, type, description, image, file_url, link FROM resources WHERE status = 'published' ORDER BY id"
  );
  res.json(rows);
}));

router.get('/settings', wrap(async (req, res) => {
  const [rows] = await pool.execute('SELECT setting_key, setting_value FROM settings');
  const out = {};
  rows.forEach((r) => { out[r.setting_key] = r.setting_value || ''; });
  res.json(out);
}));

// ---- Enquiry form ----
// The site has no enquiry form at the moment, so this is switched off unless ENQUIRIES_ENABLED=true.
// When off it answers 404 and sends no email. The code, the table and Admin > Enquiries stay for later.
const enquiriesSwitch = (req, res, next) => (enquiriesEnabled ? next() : res.status(404).json({ error: 'Not found' }));

router.post('/enquiries', enquiriesSwitch, enquiryLimiter, [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Please enter your name'),
  body('organisation').optional({ values: 'falsy' }).trim().isLength({ max: 190 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }).matches(/^[0-9+()\-\s.]{6,40}$/).withMessage('Phone number looks wrong'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Email address looks wrong').isLength({ max: 190 }),
  body('interest').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('message').optional({ values: 'falsy' }).trim().isLength({ max: 4000 }).withMessage('Message is too long'),
  body('course_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body().custom((v) => {
    if (!v.phone && !v.email) throw new Error('Please give a phone number or an email so we can reply');
    return true;
  }),
], wrap(async (req, res) => {
  // Hidden "website" field: real people leave it empty, simple bots fill it.
  if (req.body.website) return res.json({ ok: true });

  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });

  const b = req.body;
  let courseId = null;
  if (b.course_id) {
    const [c] = await pool.execute('SELECT id FROM courses WHERE id = ? LIMIT 1', [+b.course_id]);
    if (c[0]) courseId = c[0].id;
  }
  const rec = {
    name: b.name,
    organisation: b.organisation || null,
    phone: b.phone || null,
    email: b.email || null,
    interest: b.interest || null,
    message: b.message || null,
  };
  const [r] = await pool.execute(
    'INSERT INTO enquiries (course_id, name, organisation, phone, email, interest, message) VALUES (?,?,?,?,?,?,?)',
    [courseId, rec.name, rec.organisation, rec.phone, rec.email, rec.interest, rec.message]
  );
  notifyEnquiry({ id: r.insertId, ...rec }).catch((e) => console.error('[mail] failed:', e.message));
  res.status(201).json({ ok: true });
}));

// ---- Enroll Now form (Training / Consultancy cards) ----
const enrollLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enrollments from this connection. Please try again later or call us.' },
});

router.post('/enrollments', enrollLimiter, [
  body('course_id').isInt({ min: 1 }).withMessage('Please choose a course'),
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Please enter your full name'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address').isLength({ max: 190 }),
  body('phone').trim().matches(/^[0-9+()\-\s.]{6,40}$/).withMessage('Please enter a valid phone number'),
  body('organisation').optional({ values: 'falsy' }).trim().isLength({ max: 190 }).withMessage('Organisation name is too long'),
  body('preferred_date').optional({ values: 'falsy' }).trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Preferred date looks wrong')
    .custom((v) => {
      const d = new Date(v + 'T00:00:00Z');
      if (isNaN(d) || d.toISOString().slice(0, 10) !== v) throw new Error('Preferred date looks wrong');
      if (v < new Date(Date.now() - 864e5).toISOString().slice(0, 10)) throw new Error('Preferred date cannot be in the past');
      return true;
    }),
  body('message').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Message is too long (2000 characters max)'),
], wrap(async (req, res) => {
  // Hidden "website" field: real people leave it empty, simple bots fill it.
  if (req.body.website) return res.status(201).json({ ok: true });

  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });

  const b = req.body;
  const [c] = await pool.execute("SELECT id, title FROM courses WHERE id = ? AND status = 'published' LIMIT 1", [+b.course_id]);
  if (!c[0]) return res.status(400).json({ error: 'This course is not available any more. Please refresh the page.' });

  const rec = {
    course_title: c[0].title,
    name: b.name,
    email: b.email,
    phone: b.phone,
    organisation: b.organisation || null,
    preferred_date: b.preferred_date || null,
    message: b.message || null,
  };
  const [r] = await pool.execute(
    `INSERT INTO enrollments (course_id, course_title, name, email, phone, organisation, preferred_date, message)
     VALUES (?,?,?,?,?,?,?,?)`,
    [c[0].id, rec.course_title, rec.name, rec.email, rec.phone, rec.organisation, rec.preferred_date, rec.message]
  );
  notifyEnrollment({ id: r.insertId, ...rec }).catch((e) => console.error('[mail] failed:', e.message));
  res.status(201).json({ ok: true });
}));

// ---- Certificate verifier ----
// Shows only course name, dates and status. Never the holder's name or other personal details.
router.get('/certificates/:number', verifyLimiter, wrap(async (req, res) => {
  const num = String(req.params.number || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^GN-[A-Z]{2,3}-\d{4}-\d{3,5}$/.test(num)) return res.json({ status: 'not_found' });

  const [rows] = await pool.execute(
    `SELECT ce.number, ce.hours, ce.issue_date, ce.valid_until, ce.status, co.title AS course,
            (ce.valid_until IS NOT NULL AND ce.valid_until < CURDATE()) AS is_expired
       FROM certificates ce JOIN courses co ON co.id = ce.course_id
      WHERE ce.number = ? LIMIT 1`,
    [num]
  );
  const c = rows[0];
  if (!c) return res.json({ status: 'not_found' });
  if (c.status === 'revoked') return res.json({ status: 'revoked', number: c.number });
  res.json({
    status: c.is_expired ? 'expired' : 'valid',
    number: c.number,
    course: c.course,
    hours: c.hours,
    issued: c.issue_date,
    valid_until: c.valid_until,
  });
}));

module.exports = router;
