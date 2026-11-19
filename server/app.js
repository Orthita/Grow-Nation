const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { isProd, uploadDir } = require('./config');
const { totpKeyProblem } = require('./lib/crypto');

const secret = process.env.SESSION_SECRET || '';
if (secret.length < 32 || /change_me/i.test(secret)) {
  console.error('\nSESSION_SECRET is missing or too weak. Put a long random value (32+ characters) in .env\n');
  process.exit(1);
}
if (isProd && totpKeyProblem()) {
  console.error('\n' + totpKeyProblem() + '. In production, put a separate long random value (32+ characters) in TOTP_KEY in .env.\n' +
    'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// TRUST_PROXY: how many proxies sit in front of the app (e.g. 1 for Nginx or cPanel). Empty or 0 = off.
const trustProxy = String(process.env.TRUST_PROXY || '').trim();
if (/^[1-9]\d*$/.test(trustProxy)) app.set('trust proxy', +trustProxy);
else if (trustProxy && !/^(0|false|off|no)$/i.test(trustProxy)) {
  console.warn('[warning] TRUST_PROXY should be a number such as 1. Ignoring "' + trustProxy.slice(0, 20) + '".');
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': isProd ? [] : null, // would break http://localhost
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Health check for the host or an uptime monitor. Says only whether the app and the database respond.
app.get('/api/health', async (req, res) => {
  let db = false;
  try {
    await Promise.race([pool.query('SELECT 1'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
    db = true;
  } catch (e) { /* db stays false */ }
  res.set('Cache-Control', 'no-store').status(db ? 200 : 503).json({ ok: true, db });
});

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Old addresses from before the site was reorganised (301 = moved permanently).
const REDIRECTS = {
  '/services': '/training.html',
  '/services.html': '/training.html',
  '/resources': '/index.html',
  '/resources.html': '/index.html',
  '/contact': '/index.html#contact',
  '/contact.html': '/index.html#contact',
};
app.get(Object.keys(REDIRECTS), (req, res) => {
  const target = REDIRECTS[req.path.toLowerCase().replace(/\/+$/, '')] || '/index.html';
  const [page, hash] = target.split('#');
  const q = req.originalUrl.indexOf('?');
  // Keep the query string (e.g. /contact.html?course=5 still pre-selects the course).
  res.redirect(301, page + (q >= 0 ? req.originalUrl.slice(q) : '') + (hash ? '#' + hash : ''));
});

app.use('/uploads', express.static(uploadDir, { maxAge: '7d', index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: isProd ? '1h' : 0 }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request' });
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = +process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Grow Nation running at http://localhost:${port}`);
  try {
    await pool.query('SELECT 1');
    console.log('Database connected.');
  } catch (e) {
    console.error('\nCould not connect to MySQL: ' + e.message);
    console.error('Check DB_* values in .env, then run: npm run init-db\n');
  }
});
