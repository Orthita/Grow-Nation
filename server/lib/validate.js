// Small, dependency-free input checker used by the admin routes.
// def = { field: { t: 'str'|'text'|'int'|'enum'|'date'|'bool', req, max, min, v: [...], re, upper } }
// Returns { out, errors }. Only fields listed in def are ever returned.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function clean(def, input, partial = false) {
  const out = {};
  const errors = [];
  input = input && typeof input === 'object' ? input : {};

  for (const [k, d] of Object.entries(def)) {
    if (!(k in input) || input[k] === undefined) {
      if (!partial && d.req) errors.push(`${k} is required`);
      continue;
    }
    let v = input[k];

    if (d.t === 'bool') {
      out[k] = v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0;
      continue;
    }

    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === null) {
      if (d.req) errors.push(`${k} is required`);
      else out[k] = null;
      continue;
    }

    switch (d.t) {
      case 'str':
      case 'text': {
        if (typeof v !== 'string') { errors.push(`${k} must be text`); break; }
        if (d.upper) v = v.toUpperCase().replace(/\s+/g, '');
        const max = d.max || (d.t === 'text' ? 5000 : 255);
        if (v.length > max) { errors.push(`${k} is too long (max ${max})`); break; }
        if (d.re && !d.re.test(v)) { errors.push(d.reMsg || `${k} has a wrong format`); break; }
        out[k] = v;
        break;
      }
      case 'int': {
        const n = Number(v);
        if (!Number.isInteger(n)) { errors.push(`${k} must be a whole number`); break; }
        if ((d.min !== undefined && n < d.min) || (d.max !== undefined && n > d.max)) {
          errors.push(`${k} is out of range`);
          break;
        }
        out[k] = n;
        break;
      }
      case 'enum':
        if (!d.v.includes(v)) errors.push(`${k} must be one of: ${d.v.join(', ')}`);
        else out[k] = v;
        break;
      case 'date':
        if (!isRealDate(String(v))) errors.push(`${k} must be a date (YYYY-MM-DD)`);
        else out[k] = String(v);
        break;
      default:
        errors.push(`${k}: unknown type`);
    }
  }
  return { out, errors };
}

module.exports = { clean, isRealDate };
