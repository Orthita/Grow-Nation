(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ROLE_LABEL = { super_admin: 'Super admin', editor: 'Editor', certificate_officer: 'Certificate officer', support: 'Support' };
  var CONTENT = ['super_admin', 'editor'];
  var me = null;
  var lookups = { categories: [], courses: [] };

  // ---------- API ----------
  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } };
    if (opts.json !== undefined) {
      init.method = opts.method || 'POST';
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.json);
    }
    if (opts.form) { init.method = 'POST'; init.body = opts.form; }
    return fetch('/api/admin' + path, init).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (r.status === 401 && path !== '/login') { location.replace('/admin/login.html'); throw new Error('Please log in'); }
        if (!r.ok) throw new Error((d && d.error) || 'Something went wrong');
        return d;
      });
    });
  }

  // ---------- small helpers ----------
  function flash(msg, bad) {
    var b = $('#msg');
    b.innerHTML = msg ? '<div class="' + (bad ? 'err' : 'okmsg') + '" role="' + (bad ? 'alert' : 'status') + '">' + esc(msg) + '</div>' : '';
    if (msg && !bad) setTimeout(function () { if (b.firstChild && b.firstChild.className === 'okmsg') b.innerHTML = ''; }, 4000);
  }
  function fmtDT(s) { return s ? String(s).slice(0, 16).replace('T', ' ') : ''; }
  function pill(v, cls) { return '<span class="pill' + (cls ? ' ' + cls : '') + '">' + esc(v) + '</span>'; }
  function statusPill(v) {
    var bad = ['revoked', 'hidden', 'cancelled', 'expired'].indexOf(v) >= 0;
    var mute = ['closed', 'full'].indexOf(v) >= 0;
    return pill(v, bad ? 'bad' : mute ? 'mute' : '');
  }
  function yes(v) { return +v ? pill('Yes') : pill('No', 'mute'); }
  function cut(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n) + '...' : s); }

  // ---------- section definitions ----------
  var PUB = [['published', 'Published'], ['hidden', 'Hidden']];
  var SECTIONS = [
    { id: 'overview', label: 'Overview', roles: null, render: renderOverview },
    {
      id: 'enquiries', label: 'Enquiries', roles: ['super_admin', 'support'], res: 'enquiries', noCreate: true, noun: 'enquiry',
      cols: [['created_at', 'Date', function (r) { return esc(fmtDT(r.created_at)); }], ['name', 'Name'], ['organisation', 'Organisation'],
        ['contact', 'Contact', function (r) { return esc(r.phone || '') + (r.phone && r.email ? '<br>' : '') + esc(r.email || ''); }],
        ['interest', 'Interested in'], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      filter: { key: 'status', opts: [['', 'All statuses'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']] },
      fields: [{ k: 'status', label: 'Status', t: 'select', opts: [['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']], full: true }],
      detail: function (r) {
        return '<dl class="detail"><dt>Received</dt><dd>' + esc(fmtDT(r.created_at)) + '</dd><dt>Name</dt><dd>' + esc(r.name) + '</dd>' +
          '<dt>Organisation</dt><dd>' + esc(r.organisation || '-') + '</dd><dt>Phone</dt><dd>' + esc(r.phone || '-') + '</dd>' +
          '<dt>Email</dt><dd>' + esc(r.email || '-') + '</dd><dt>Interested in</dt><dd>' + esc(r.interest || '-') + '</dd>' +
          (r.course_title ? '<dt>Course</dt><dd>' + esc(r.course_title) + '</dd>' : '') +
          '<dt>Message</dt><dd>' + esc(r.message || '-') + '</dd></dl>';
      }
    },
    {
      id: 'courses', label: 'Courses and services', roles: CONTENT, res: 'courses', noun: 'course',
      cols: [['title', 'Title'], ['category_name', 'Category'], ['listing', 'Shown as', function (r) { return r.listing === 'card' ? pill('Card', 'mute') : pill('Not shown on site', 'bad'); }],
        ['duration', 'Duration'], ['sort_order', 'Order'], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      defaults: { listing: 'card', status: 'published', sort_order: 0 },
      fields: [
        { k: 'category_id', label: 'Category', t: 'select', from: 'categories', req: true },
        { k: 'listing', label: 'Shown as', t: 'select', hint: 'Cards appear on the Training or Consultancy page, depending on the category. Certificates can link to any course.',
          // "catalogue" is no longer shown on the site: offer it only to keep existing catalogue rows unchanged.
          opts: function (row) { return row && row.listing === 'catalogue' ? [['catalogue', 'Not shown on site (old catalogue row)'], ['card', 'Card on Training / Consultancy page']] : [['card', 'Card on Training / Consultancy page']]; } },
        { k: 'title', label: 'Title', req: true, full: true },
        { k: 'summary', label: 'Short summary', t: 'textarea', full: true },
        { k: 'topics', label: 'Course content', t: 'textarea', full: true, hint: 'One topic per line (cards only).' },
        { k: 'duration', label: 'Duration' }, { k: 'location', label: 'Location (on-site / online)' },
        { k: 'standard', label: 'Standard (not shown on site)' }, { k: 'best_for', label: 'Best for' },
        { k: 'image', label: 'Image', t: 'upload', accept: 'image/*', full: true },
        { k: 'status', label: 'Status', t: 'select', opts: PUB }, { k: 'sort_order', label: 'Order (small number first)', t: 'number' }
      ]
    },
    {
      id: 'batches', label: 'Batch dates', roles: CONTENT, res: 'batches', noun: 'batch',
      cols: [['course_title', 'Course'], ['start_date', 'Start date'], ['mode', 'Mode'], ['seats', 'Seats'], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      defaults: { mode: 'on-site', status: 'open' },
      fields: [
        { k: 'course_id', label: 'Course', t: 'select', from: 'courses', req: true, full: true },
        { k: 'start_date', label: 'Start date', t: 'date', req: true }, { k: 'mode', label: 'Mode', t: 'select', opts: [['on-site', 'On-site'], ['online', 'Online']] },
        { k: 'seats', label: 'Seats available', t: 'number' }, { k: 'status', label: 'Status', t: 'select', opts: [['open', 'Open'], ['full', 'Full'], ['cancelled', 'Cancelled']] }
      ]
    },
    {
      id: 'certificates', label: 'Certificates', roles: ['super_admin', 'certificate_officer'], res: 'certificates', noun: 'certificate',
      cols: [['number', 'Number'], ['holder_name', 'Holder'], ['course_title', 'Course'], ['issue_date', 'Issued'], ['valid_until', 'Valid until', function (r) { return esc(r.valid_until || 'no expiry'); }],
        ['status', 'Status', function (r) { return statusPill(r.status === 'revoked' ? 'revoked' : (+r.is_expired ? 'expired' : 'valid')); }]],
      defaults: { status: 'valid' },
      fields: [
        { k: 'number', label: 'Certificate number', req: true, hint: 'Format: GN-FS-2026-0142 (issuer, area, year, serial).' },
        { k: 'course_id', label: 'Course', t: 'select', from: 'courses', req: true },
        { k: 'holder_name', label: 'Holder name', req: true, hint: 'Never shown on the public verifier.' }, { k: 'hours', label: 'Contact hours', t: 'number' },
        { k: 'issue_date', label: 'Issue date', t: 'date', req: true }, { k: 'valid_until', label: 'Valid until', t: 'date', hint: 'Leave empty if it never expires.' },
        { k: 'status', label: 'Status', t: 'select', opts: [['valid', 'Valid'], ['revoked', 'Revoked (withdrawn)']] },
        { k: 'file', label: 'Certificate file (PDF)', t: 'upload', accept: 'application/pdf,image/*', full: true }
      ]
    },
    {
      // Hidden from the admin menu: the public Resources page was removed. Delete "hidden: true" to bring it back.
      id: 'resources', label: 'Resources', roles: CONTENT, res: 'resources', noun: 'resource', hidden: true,
      cols: [['title', 'Title'], ['type', 'Type'], ['file_url', 'File', function (r) { return r.file_url ? pill('Yes') : pill('No', 'mute'); }], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      defaults: { type: 'learning', status: 'published' },
      fields: [
        { k: 'title', label: 'Title', req: true, full: true },
        { k: 'type', label: 'Type', t: 'select', opts: [['learning', 'Learning Materials'], ['career', 'Career Guidance'], ['workplace', 'Workplace Resources']] },
        { k: 'status', label: 'Status', t: 'select', opts: PUB },
        { k: 'description', label: 'Description', t: 'textarea', full: true },
        { k: 'image', label: 'Image', t: 'upload', accept: 'image/*', full: true },
        { k: 'file_url', label: 'Downloadable file', t: 'upload', accept: '.pdf,.docx,.xlsx,.pptx,image/*', full: true },
        { k: 'link', label: 'External link (optional)', full: true }
      ]
    },
    {
      id: 'slides', label: 'Home slider', roles: CONTENT, res: 'slides', noun: 'slide',
      cols: [['sort_order', 'Order'], ['title', 'Title'], ['button_text', 'Button'], ['active', 'Active', function (r) { return yes(r.active); }]],
      defaults: { sort_order: 0, active: 1 },
      fields: [
        { k: 'eyebrow', label: 'Small label (e.g. 01 / Training)' }, { k: 'sort_order', label: 'Order', t: 'number' },
        { k: 'title', label: 'Headline', req: true, full: true }, { k: 'text', label: 'Text', t: 'textarea', full: true },
        { k: 'image', label: 'Background image (optional)', t: 'upload', accept: 'image/*', full: true },
        { k: 'button_text', label: 'Button text' }, { k: 'button_link', label: 'Button link', hint: 'For example /training.html, /consultancy.html or #contact' },
        { k: 'active', label: 'Show this slide', t: 'check' }
      ]
    },
    {
      id: 'testimonials', label: 'Testimonials', roles: CONTENT, res: 'testimonials', noun: 'testimonial',
      intro: 'Add only real feedback from real clients, with their permission. The section on the home page stays hidden until at least one is active.',
      cols: [['name', 'Name'], ['role', 'Role'], ['quote', 'Quote', function (r) { return cut(r.quote, 80); }], ['active', 'Active', function (r) { return yes(r.active); }]],
      defaults: { active: 1 },
      fields: [
        { k: 'name', label: 'Name', req: true }, { k: 'role', label: 'Role / organisation' },
        { k: 'quote', label: 'Quote', t: 'textarea', req: true, full: true },
        { k: 'photo', label: 'Photo (optional)', t: 'upload', accept: 'image/*', full: true },
        { k: 'active', label: 'Show on website', t: 'check' }
      ]
    },
    {
      id: 'categories', label: 'Categories', roles: CONTENT, res: 'categories', noun: 'category',
      cols: [['name', 'Name'], ['type', 'Type'], ['sort_order', 'Order']],
      defaults: { type: 'training', sort_order: 0 },
      fields: [
        { k: 'name', label: 'Name', req: true, full: true },
        { k: 'type', label: 'Type', t: 'select', opts: [['training', 'Training'], ['consultancy', 'Consultancy']] }, { k: 'sort_order', label: 'Order', t: 'number' }
      ]
    },
    { id: 'settings', label: 'Contact details', roles: CONTENT, render: renderSettings },
    {
      id: 'users', label: 'Staff users', roles: ['super_admin'], res: 'users', noun: 'user',
      cols: [['name', 'Name'], ['email', 'Email'], ['role', 'Role', function (r) { return esc(ROLE_LABEL[r.role] || r.role); }],
        ['active', 'Active', function (r) { return yes(r.active); }], ['twofa_enabled', 'Two-step', function (r) { return yes(r.twofa_enabled); }],
        ['last_login', 'Last login', function (r) { return esc(fmtDT(r.last_login) || 'never'); }]],
      defaults: { role: 'support', active: 1 },
      fields: [
        { k: 'name', label: 'Name', req: true }, { k: 'email', label: 'Email', req: true, type: 'email' },
        { k: 'role', label: 'Role', t: 'select', opts: [['super_admin', 'Super admin'], ['editor', 'Editor'], ['certificate_officer', 'Certificate officer'], ['support', 'Support']] },
        { k: 'active', label: 'Account active', t: 'check' },
        { k: 'password', label: 'Password', t: 'password', full: true, hint: 'At least 10 characters. When editing, leave empty to keep the current password.', createReq: true },
        { k: 'reset_2fa', label: 'Reset two-step login (if they lost their phone)', t: 'check', editOnly: true, full: true }
      ]
    },
    { id: 'audit', label: 'Activity log', roles: ['super_admin'], render: renderAudit },
    { id: 'account', label: 'My account', roles: null, render: renderAccount }
  ];

  function allowed(sec) { return !sec.hidden && (!sec.roles || sec.roles.indexOf(me.role) >= 0); }

  // ---------- navigation ----------
  function buildNav() {
    $('#nav').innerHTML = SECTIONS.filter(allowed).map(function (s) {
      return '<a class="nav" href="#' + s.id + '">' + esc(s.label) + '</a>';
    }).join('');
    $('#who').innerHTML = esc(me.name) + '<br>' + esc(ROLE_LABEL[me.role] || me.role);
  }

  function route() {
    var id = location.hash.replace('#', '') || 'overview';
    var sec = SECTIONS.filter(function (s) { return s.id === id && allowed(s); })[0] || SECTIONS[0];
    $$('#nav a').forEach(function (a) { if (a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#title').textContent = sec.label;
    $('#tools').innerHTML = '';
    $('#side').classList.remove('open');
    flash('');
    $('#view').innerHTML = '<p class="empty">Loading...</p>';
    var p = sec.render ? sec.render(sec) : renderResource(sec);
    Promise.resolve(p).catch(function (e) { $('#view').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }

  // ---------- generic list + form ----------
  var cur = null; // { sec, row }

  function renderResource(sec) {
    return api('/' + sec.res).then(function (rows) {
      var q = '', fval = '';
      var tools = $('#tools');
      var html = '<input type="search" id="q" placeholder="Search..." aria-label="Search">';
      if (sec.filter) html += '<select id="flt" aria-label="Filter">' + sec.filter.opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      if (!sec.noCreate) html += '<button class="btn" id="add">Add ' + esc(sec.noun) + '</button>';
      tools.innerHTML = html;

      function draw() {
        var list = rows.filter(function (r) {
          if (fval && r[sec.filter.key] !== fval) return false;
          if (!q) return true;
          return Object.keys(r).some(function (k) { return String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q) >= 0; });
        });
        var intro = sec.intro ? '<p class="hint" style="margin:0 0 12px">' + esc(sec.intro) + '</p>' : '';
        if (!list.length) { $('#view').innerHTML = intro + '<div class="panel empty">Nothing here yet.</div>'; return; }
        $('#view').innerHTML = intro + '<div class="tw"><table><thead><tr>' + sec.cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
          list.map(function (r) {
            return '<tr>' + sec.cols.map(function (c) { return '<td>' + (c[2] ? c[2](r) : cut(r[c[0]], 70)) + '</td>'; }).join('') +
              '<td class="act"><button class="btn ghost sm" data-e="' + r.id + '">' + (sec.detail ? 'View' : 'Edit') + '</button>' +
              '<button class="btn danger sm" data-d="' + r.id + '">Delete</button></td></tr>';
          }).join('') + '</tbody></table></div>';
        $$('[data-e]').forEach(function (b) {
          b.onclick = function () { openForm(sec, rows.filter(function (r) { return String(r.id) === b.getAttribute('data-e'); })[0]); };
        });
        $$('[data-d]').forEach(function (b) {
          b.onclick = function () {
            var row = rows.filter(function (r) { return String(r.id) === b.getAttribute('data-d'); })[0];
            if (!confirm('Delete this ' + sec.noun + '? This cannot be undone.' + (sec.id === 'courses' ? '\n\nTip: choose Hidden instead if you may need it again.' : ''))) return;
            api('/' + sec.res + '/' + row.id, { method: 'DELETE' }).then(function () { flash('Deleted.'); route(); }).catch(function (e) { flash(e.message, true); });
          };
        });
      }
      $('#q').oninput = function () { q = this.value.trim().toLowerCase(); draw(); };
      if (sec.filter) $('#flt').onchange = function () { fval = this.value; draw(); };
      if (!sec.noCreate) $('#add').onclick = function () { openForm(sec, null); };
      draw();
    });
  }

  function loadLookups() {
    return api('/lookups').then(function (l) { lookups = l; });
  }

  function fieldHTML(sec, f, row) {
    var id = 'f_' + f.k;
    var v = row ? row[f.k] : (sec.defaults && sec.defaults[f.k] !== undefined ? sec.defaults[f.k] : '');
    if (v == null) v = '';
    var lab = '<label for="' + id + '">' + esc(f.label) + (f.req || (f.createReq && !row) ? ' *' : '') + '</label>';
    var hint = f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '';
    var cls = f.full ? ' class="full"' : '';
    var body;
    if (f.t === 'textarea') body = '<textarea id="' + id + '" name="' + f.k + '">' + esc(v) + '</textarea>';
    else if (f.t === 'check') {
      return '<div' + cls + '><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="' + id + '" name="' + f.k + '"' + (+v ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + hint + '</div>';
    } else if (f.t === 'select') {
      var opts = (typeof f.opts === 'function' ? f.opts(row) : f.opts) || (lookups[f.from] || []).map(function (o) { return [o.id, o.name || o.title]; });
      body = '<select id="' + id + '" name="' + f.k + '">' + (f.req && !row ? '<option value="">Choose...</option>' : '') +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    } else if (f.t === 'upload') {
      body = '<div class="up"><input type="text" id="' + id + '" name="' + f.k + '" value="' + esc(v) + '" placeholder="Choose a file or paste a link">' +
        '<label class="btn ghost sm" for="' + id + '_file" style="margin:0;white-space:nowrap">Upload</label>' +
        '<input type="file" id="' + id + '_file" data-for="' + id + '" accept="' + esc(f.accept || '') + '"></div>';
    } else {
      var type = f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'password' ? 'password' : (f.type || 'text');
      body = '<input id="' + id + '" name="' + f.k + '" type="' + type + '" value="' + (f.t === 'password' ? '' : esc(v)) + '"' + (f.t === 'password' ? ' autocomplete="new-password"' : '') + '>';
    }
    return '<div' + cls + '>' + lab + body + hint + '</div>';
  }

  function openForm(sec, row) {
    cur = { sec: sec, row: row };
    return loadLookups().then(function () {
      $('#dtitle').textContent = sec.detail ? 'Enquiry from ' + row.name : (row ? 'Edit ' : 'Add ') + sec.noun;
      var html = sec.detail && row ? '<div class="full">' + sec.detail(row) + '</div>' : '';
      html += sec.fields.filter(function (f) { return !(f.editOnly && !row); }).map(function (f) { return fieldHTML(sec, f, row); }).join('');
      $('#dbody').innerHTML = html;
      $('#dmsg').textContent = '';
      $('#dsave').textContent = sec.detail ? 'Save status' : 'Save';
      $$('#dbody input[type=file]').forEach(function (inp) {
        inp.onchange = function () {
          if (!inp.files[0]) return;
          var fd = new FormData();
          fd.append('file', inp.files[0]);
          $('#dmsg').textContent = 'Uploading...';
          api('/upload', { form: fd }).then(function (r) { $('#' + inp.getAttribute('data-for')).value = r.url; $('#dmsg').textContent = ''; })
            .catch(function (e) { $('#dmsg').textContent = e.message; });
        };
      });
      $('#dlg').showModal();
    }).catch(function (e) { flash(e.message, true); });
  }

  $('#dcancel').onclick = $('#dclose').onclick = function () { $('#dlg').close(); };

  $('#dform').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!cur) return;
    var sec = cur.sec, row = cur.row, body = {};
    sec.fields.forEach(function (f) {
      var el = $('#f_' + f.k);
      if (!el) return;
      if (f.t === 'check') body[f.k] = el.checked ? 1 : 0;
      else if (f.t === 'password') { if (el.value) body[f.k] = el.value; }
      else body[f.k] = el.value;
    });
    var btn = $('#dsave');
    btn.disabled = true;
    $('#dmsg').textContent = '';
    var path = '/' + sec.res + (row ? '/' + row.id : '');
    api(path, { json: body, method: row ? 'PUT' : 'POST' }).then(function () {
      $('#dlg').close();
      flash(row ? 'Saved.' : 'Added.');
      route();
    }).catch(function (e) { $('#dmsg').textContent = e.message; }).then(function () { btn.disabled = false; });
  });

  // ---------- overview ----------
  function renderOverview() {
    return api('/stats').then(function (s) {
      var L = { new_enquiries: 'New enquiries', total_enquiries: 'All enquiries', published_courses: 'Published courses', upcoming_batches: 'Upcoming batches', certificates: 'Certificates issued', revoked: 'Revoked certificates' };
      var cards = Object.keys(s).map(function (k) { return '<div class="stat"><b>' + esc(s[k]) + '</b><span>' + esc(L[k] || k) + '</span></div>'; }).join('');
      var warn = me.twofa_enabled ? '' : '<div class="err">Two-step login is off for your account. Turn it on under <a href="#account">My account</a> to protect the admin panel.</div>';
      $('#view').innerHTML = warn + '<div class="stats">' + cards + '</div>' +
        '<div class="panel"><h3>Welcome, ' + esc(me.name) + '</h3><p style="margin:0;color:var(--mute)">You are logged in as ' + esc(ROLE_LABEL[me.role]) + '. Use the menu on the left to manage what your role allows.</p></div>';
    });
  }

  // ---------- contact details ----------
  function renderSettings() {
    return api('/settings').then(function (s) {
      var F = [['office_address', 'Office address'], ['registration', 'Registration line'], ['phone', 'Phone'], ['email', 'Public email'], ['website', 'Website (e.g. www.grownation.org)'], ['whatsapp', 'WhatsApp number (digits with country code, e.g. 8801XXXXXXXXX)'], ['hours', 'Office hours']];
      $('#view').innerHTML = '<form class="panel" id="sf" novalidate style="max-width:640px"><p class="hint" style="margin-top:0">These appear on the Contact page and footer. The WhatsApp button shows on every page once a number is added.</p>' +
        F.map(function (f) { return '<div style="margin-bottom:14px"><label for="s_' + f[0] + '">' + esc(f[1]) + '</label><input id="s_' + f[0] + '" value="' + esc(s[f[0]]) + '"></div>'; }).join('') +
        '<button class="btn" type="submit">Save</button></form>';
      $('#sf').onsubmit = function (e) {
        e.preventDefault();
        var body = {};
        F.forEach(function (f) { body[f[0]] = $('#s_' + f[0]).value; });
        api('/settings', { json: body, method: 'PUT' }).then(function () { flash('Saved.'); }).catch(function (er) { flash(er.message, true); });
      };
    });
  }

  // ---------- activity log ----------
  function renderAudit() {
    return api('/audit-logs').then(function (rows) {
      $('#view').innerHTML = rows.length ? '<div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Table</th><th>Record</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + esc(fmtDT(r.created_at)) + '</td><td>' + esc(r.user_name || '') + '</td><td>' + esc(r.action) + '</td><td>' + esc(r.table_name || '') + '</td><td>' + esc(r.record_id || '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="panel empty">No activity yet.</div>';
    });
  }

  // ---------- my account ----------
  function renderAccount() {
    function draw() {
      var tf = me.twofa_enabled
        ? '<p>Two-step login is <b>on</b>.</p><form id="tf-off" novalidate><label for="tf_pw">Password (to turn it off)</label><input id="tf_pw" type="password" autocomplete="current-password" style="max-width:280px;margin-bottom:10px"><br><button class="btn danger" type="submit">Turn off two-step login</button></form>'
        : '<p>Two-step login is <b>off</b>. It asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) every time you log in.</p><div id="tf-box"><button class="btn" id="tf-start">Set up two-step login</button></div>';
      $('#view').innerHTML = '<div class="cols2"><div class="panel"><h3>Change password</h3><form id="pf" novalidate>' +
        '<div style="margin-bottom:12px"><label for="pw0">Current password</label><input id="pw0" type="password" autocomplete="current-password"></div>' +
        '<div style="margin-bottom:12px"><label for="pw1">New password</label><input id="pw1" type="password" autocomplete="new-password"><div class="hint">At least 10 characters.</div></div>' +
        '<button class="btn" type="submit">Change password</button></form></div>' +
        '<div class="panel"><h3>Two-step login</h3>' + tf + '</div></div>';

      $('#pf').onsubmit = function (e) {
        e.preventDefault();
        api('/change-password', { json: { current: $('#pw0').value, next: $('#pw1').value } })
          .then(function () { flash('Password changed.'); $('#pw0').value = ''; $('#pw1').value = ''; }).catch(function (er) { flash(er.message, true); });
      };
      var start = $('#tf-start');
      if (start) start.onclick = function () {
        api('/2fa/setup', { method: 'POST', json: {} }).then(function (r) {
          $('#tf-box').innerHTML = '<ol style="padding-left:18px"><li>Open your authenticator app and add a new account with <b>manual entry</b>.</li><li>Type this key (spaces do not matter):<code class="key">' + esc(r.secret.replace(/(.{4})/g, '$1 ').trim()) + '</code></li><li>Enter the 6-digit code the app shows:</li></ol>' +
            '<form id="tf-on" novalidate><input id="tf_code" inputmode="numeric" maxlength="7" placeholder="123456" style="max-width:160px;margin-bottom:10px"><br><button class="btn" type="submit">Turn on</button></form>';
          $('#tf-on').onsubmit = function (e) {
            e.preventDefault();
            api('/2fa/enable', { json: { code: $('#tf_code').value } }).then(function () { me.twofa_enabled = true; flash('Two-step login is on.'); draw(); }).catch(function (er) { flash(er.message, true); });
          };
        }).catch(function (er) { flash(er.message, true); });
      };
      var off = $('#tf-off');
      if (off) off.onsubmit = function (e) {
        e.preventDefault();
        api('/2fa/disable', { json: { password: $('#tf_pw').value } }).then(function () { me.twofa_enabled = false; flash('Two-step login is off.'); draw(); }).catch(function (er) { flash(er.message, true); });
      };
    }
    draw();
    return Promise.resolve();
  }

  // ---------- start ----------
  $('#menu').onclick = function () { $('#side').classList.toggle('open'); };
  $('#logout').onclick = function () {
    api('/logout', { method: 'POST', json: {} }).catch(function () {}).then(function () { location.replace('/admin/login.html'); });
  };
  window.addEventListener('hashchange', route);

  api('/me').then(function (u) { me = u; buildNav(); route(); });
})();
