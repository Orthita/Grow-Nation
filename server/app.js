const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const isProd = process.env.NODE_ENV === 'production';
const secret = process.env.SESSION_SECRET || '';
if (secret.length < 32 || /change_me/i.test(secret)) {
  console.error('\nSESSION_SECRET is missing or too weak. Put a long random value (32+ characters) in .env\n');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1); // running behind Nginx

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

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', index: false, dotfiles: 'deny' }));
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
