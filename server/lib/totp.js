// Two-step login (TOTP, RFC 6238) with no extra packages.
// Works with Google Authenticator, Microsoft Authenticator, Authy, etc.
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 15;
  const num = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(num % 1000000).padStart(6, '0');
}

function code(secret, time = Date.now()) {
  return hotp(secret, Math.floor(time / 30000));
}

// Accepts the current code and one step either side (clock drift).
function verify(secret, token, time = Date.now()) {
  const t = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(t)) return false;
  const step = Math.floor(time / 30000);
  let ok = false;
  for (let d = -1; d <= 1; d++) {
    const a = Buffer.from(hotp(secret, step + d));
    const b = Buffer.from(t);
    if (crypto.timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

function otpauthUrl(secret, email, issuer = 'Grow Nation') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

module.exports = { generateSecret, verify, code, otpauthUrl, base32Encode, base32Decode };
