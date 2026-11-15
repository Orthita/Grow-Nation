// Quick checks for the parts that need no database: npm test
const assert = require('assert');
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
const totp = require('../server/lib/totp');
const { clean } = require('../server/lib/validate');
const { encrypt, decrypt } = require('../server/lib/crypto');

// TOTP: RFC 6238 test vector (secret "12345678901234567890", time 59s -> 94287082 -> last 6 digits 287082)
const rfcSecret = totp.base32Encode(Buffer.from('12345678901234567890'));
assert.strictEqual(totp.code(rfcSecret, 59000), '287082');
assert.ok(totp.verify(rfcSecret, '287082', 59000));
assert.ok(!totp.verify(rfcSecret, '000000', 59000));
assert.ok(!totp.verify(rfcSecret, 'abcdef', 59000));
const s = totp.generateSecret();
assert.ok(totp.verify(s, totp.code(s)));
assert.deepStrictEqual(totp.base32Decode(totp.base32Encode(Buffer.from('hello'))), Buffer.from('hello'));

// Encryption round trip
assert.strictEqual(decrypt(encrypt('JBSWY3DPEHPK3PXP')), 'JBSWY3DPEHPK3PXP');

// Validation
const def = {
  number: { t: 'str', req: true, upper: true, re: /^GN-[A-Z]{2,3}-\d{4}-\d{3,5}$/ },
  course_id: { t: 'int', req: true, min: 1 },
  valid_until: { t: 'date' },
  status: { t: 'enum', v: ['valid', 'revoked'] },
  active: { t: 'bool' },
};
let r = clean(def, { number: ' gn-fs-2026-0142 ', course_id: '13', valid_until: '', status: 'valid', active: 'on', evil: 'x' });
assert.deepStrictEqual(r.errors, []);
assert.deepStrictEqual(r.out, { number: 'GN-FS-2026-0142', course_id: 13, valid_until: null, status: 'valid', active: 1 });
r = clean(def, { number: 'bad', course_id: 'x', valid_until: '2026-02-31', status: 'hacked' });
assert.strictEqual(r.errors.length, 4);
r = clean(def, {});
assert.strictEqual(r.errors.length, 2);
r = clean(def, { status: 'revoked' }, true);
assert.deepStrictEqual(r.errors, []);

console.log('All self-tests passed.');
