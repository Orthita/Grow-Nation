// Encrypts small secrets (the 2FA key) before they are stored in MySQL.
// The encryption key comes from TOTP_KEY. In development only, if TOTP_KEY is missing, it falls back to
// SESSION_SECRET (the old behaviour) and prints a warning. In production server/app.js refuses to start without it.
const crypto = require('crypto');

const MIN_LEN = 32;
let warned = false;

function totpKeyProblem() {
  const k = process.env.TOTP_KEY || '';
  if (!k) return 'TOTP_KEY is missing';
  if (k.length < MIN_LEN) return 'TOTP_KEY is too short (it needs ' + MIN_LEN + '+ characters)';
  return '';
}

function key() {
  if (!totpKeyProblem()) return crypto.createHash('sha256').update('gn-2fa|' + process.env.TOTP_KEY).digest();
  if (process.env.NODE_ENV === 'production') throw new Error('TOTP_KEY is not set correctly');
  if (!warned) {
    warned = true;
    console.warn('[warning] ' + totpKeyProblem() + ': using SESSION_SECRET to encrypt 2FA keys (development only).');
  }
  return crypto.createHash('sha256').update('gn-2fa|' + (process.env.SESSION_SECRET || '')).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(blob) {
  const [iv, tag, enc] = String(blob).split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, totpKeyProblem };
