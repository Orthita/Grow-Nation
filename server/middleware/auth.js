const jwt = require('jsonwebtoken');
const pool = require('../db');

const COOKIE = 'gn_token';
const MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    // Always secure in production (HTTPS only). Locally it follows COOKIE_SECURE, so http://localhost works.
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: MAX_AGE,
  };
}

function secret() {
  return process.env.SESSION_SECRET;
}

function issue(res, user) {
  const token = jwt.sign({ id: user.id }, secret(), { expiresIn: '8h' });
  res.cookie(COOKIE, token, cookieOptions());
}

function clear(res) {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

// Loads the user fresh from MySQL on every request, so a deactivated account stops working at once.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please log in' });
    let payload;
    try {
      payload = jwt.verify(token, secret());
    } catch (e) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, twofa_enabled, active FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );
    const u = rows[0];
    if (!u || !u.active) return res.status(401).json({ error: 'Account is not active' });
    req.user = u;
    next();
  } catch (e) {
    next(e);
  }
}

const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Your role cannot do this' });
  }
  next();
};

module.exports = { requireAuth, allow, issue, clear };
