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
  var PEOPLE = ['super_admin', 'support'];
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
        var e;
        if (r.status === 401 && path !== '/login') { location.replace('/admin/login.html'); e = new Error('Please log in'); e.status = 401; throw e; }
        if (!r.ok) { e = new Error((d && d.error) || 'Something went wrong'); e.status = r.status; throw e; }
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

  // Database values -> words staff see. ("closed" enquiries are shown as Resolved, "hidden" services as Unpublished.)
  var STATUS = {
    pending: ['Pending', 'warn'], contacted: ['Contacted', 'mute'], confirmed: ['Confirmed', 'ok'], rejected: ['Rejected', 'bad'],
    new: ['New', 'warn'], closed: ['Resolved', 'ok'],
    published: ['Published', 'ok'], hidden: ['Unpublished', 'mute'],
    valid: ['Valid', 'ok'], revoked: ['Revoked', 'bad'], expired: ['Expired', 'bad'],
    open: ['Open', 'ok'], full: ['Full', 'mute'], cancelled: ['Cancelled', 'bad']
  };
  function statusPill(v) { var s = STATUS[v] || [v, '']; return pill(s[0], s[1]); }
  function yes(v) { return +v ? pill('Yes', 'ok') : pill('No', 'mute'); }
  function cut(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n) + '...' : s); }
  function safeUrl(u) { return /^(\/|https?:\/\/)/i.test(u || ''); }
  function thumb(u) { return safeUrl(u) ? '<img class="thumb" src="' + esc(u) + '" alt="" loading="lazy">' : '<span class="thumb none" aria-hidden="true"></span>'; }

  // Contact buttons for a person (enrollment or enquiry). Bangladeshi numbers like 017... get the 88 country code for WhatsApp.
  function contactButtons(r, subject) {
    var out = [];
    if (r.email) out.push('<a class="btn sm" href="mailto:' + esc(r.email) + '?subject=' + encodeURIComponent(subject) + '">Email</a>');
    var tel = String(r.phone || '').replace(/[^\d+]/g, '');
    if (tel.length >= 6) {
      out.push('<a class="btn ghost sm" href="tel:' + esc(tel) + '">Call</a>');
      var wa = tel.replace(/^\+/, '');
      if (/^01\d{9}$/.test(wa)) wa = '88' + wa;
      if (wa.length >= 10) out.push('<a class="btn ghost sm" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>');
    }
    return out.length ? '<div class="contact-row">' + out.join('') + '</div>' : '';
  }

  function quickButtons(sec, r, attr) {
    return (sec.quick ? sec.quick(r) : []).map(function (q, i) {
      return '<button type="button" class="btn sm ' + (q.cls || 'ghost') + '" ' + attr + '="' + r.id + ':' + i + '">' + esc(q.label) + '</button>';
    }).join('');
  }

  // ---------- section definitions ----------
  var PUB = [['published', 'Published (shown on the website)'], ['hidden', 'Unpublished (hidden)']];

  function publishQuick(r) {
    return r.status === 'published' ? [{ label: 'Unpublish', patch: { status: 'hidden' } }] : [{ label: 'Publish', patch: { status: 'published' }, cls: 'ok' }];
  }

  function serviceSection(type) {
    var training = type === 'training';
    var fields = [
      { k: 'category_id', label: 'Category', t: 'select', from: 'categories', where: function (o) { return o.type === type; }, req: true,
        hint: 'Add or rename categories under Categories.' },
      { k: 'status', label: 'Publish', t: 'select', opts: PUB },
      { k: 'title', label: training ? 'Training title' : 'Service title', req: true, full: true },
      { k: 'summary', label: training ? 'Short description' : 'Description', t: 'textarea', full: true, hint: 'One or two sentences shown at the top of the card.' },
      { k: 'topics', label: training ? 'Training details (course content)' : 'Details', t: 'textarea', full: true, hint: 'One point per line. Each line becomes a bullet on the card.' },
      { k: 'image', label: 'Image', t: 'upload', accept: 'image/*', full: true, hint: 'Optional. JPG, PNG or WebP, up to 4 MB. Wide images look best.' }
    ];
    if (training) fields.push({ k: 'duration', label: 'Duration', hint: 'For example 2 days, or 16 hours' }, { k: 'fee', label: 'Fee', hint: 'For example BDT 5,000 per person' });
    else fields.push({ k: 'duration', label: 'Typical duration (optional)' });
    fields.push(
      { k: 'location', label: 'Location', hint: 'For example On-site / Online' },
      { k: 'best_for', label: 'Who it is for' },
      { k: 'sort_order', label: 'Order on the page', t: 'number', hint: 'Smaller numbers come first.' },
      // Old catalogue rows are not shown on the site; the choice appears only for them.
      { k: 'listing', label: 'Shown as', t: 'select', showIf: function (row) { return row && row.listing === 'catalogue'; },
        opts: [['catalogue', 'Not shown on site (old catalogue row)'], ['card', 'Card on the website']] }
    );
    var cols = [['image', '', function (r) { return thumb(r.image); }], ['title', 'Title', function (r) {
      return '<b>' + esc(r.title) + '</b><div class="sub">' + esc(r.category_name || '') + (r.listing === 'catalogue' ? ' · not shown on site' : '') + '</div>';
    }], ['duration', 'Duration']];
    if (training) cols.push(['fee', 'Fee']);
    cols.push(['location', 'Location'], ['status', 'Status', function (r) { return statusPill(r.status); }]);
    return {
      id: type, label: training ? 'Training services' : 'Consultancy services', group: 'Website content', roles: CONTENT, res: 'courses',
      noun: training ? 'training' : 'consultancy service',
      rowFilter: function (r) { r._view = r.listing === 'catalogue' ? 'catalogue' : r.status; return r.category_type === type; },
      intro: training
        ? 'Each published training appears as a card in "Our Training Services" on the website, with an Enroll Now button.'
        : 'Each published service appears as a card in "Our Consultancy Services" on the website.',
      defaults: { listing: 'card', status: 'published', sort_order: 0 },
      filter: { key: '_view', hideByDefault: 'catalogue', opts: [['', 'All on the website'], ['published', 'Published'], ['hidden', 'Unpublished'], ['catalogue', 'Old catalogue rows (not on website)']] },
      quick: publishQuick,
      cols: cols, fields: fields,
      deleteTip: 'Tip: choose Unpublish instead if you may need it again. A service with certificates cannot be deleted.'
    };
  }

  var SECTIONS = [
    { id: 'overview', label: 'Dashboard', group: '', roles: null, render: renderOverview },
    serviceSection('training'),
    serviceSection('consultancy'),
    {
      id: 'batches', label: 'Batch dates', group: 'Website content', roles: CONTENT, res: 'batches', noun: 'batch',
      intro: 'The next open batch date appears on the training card as "Next batch".',
      cols: [['course_title', 'Course'], ['start_date', 'Start date'], ['mode', 'Mode'], ['seats', 'Seats'], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      defaults: { mode: 'on-site', status: 'open' },
      fields: [
        { k: 'course_id', label: 'Course', t: 'select', from: 'courses', req: true, full: true },
        { k: 'start_date', label: 'Start date', t: 'date', req: true }, { k: 'mode', label: 'Mode', t: 'select', opts: [['on-site', 'On-site'], ['online', 'Online']] },
        { k: 'seats', label: 'Seats available', t: 'number' }, { k: 'status', label: 'Status', t: 'select', opts: [['open', 'Open'], ['full', 'Full'], ['cancelled', 'Cancelled']] }
      ]
    },
    {
      id: 'categories', label: 'Categories', group: 'Website content', roles: CONTENT, res: 'categories', noun: 'category',
      intro: 'Every training or consultancy service belongs to a category. The category type decides which section of the website it appears in.',
      cols: [['name', 'Name'], ['type', 'Type', function (r) { return pill(r.type === 'training' ? 'Training' : 'Consultancy', 'mute'); }], ['sort_order', 'Order']],
      defaults: { type: 'training', sort_order: 0 },
      fields: [
        { k: 'name', label: 'Name', req: true, full: true },
        { k: 'type', label: 'Type', t: 'select', opts: [['training', 'Training'], ['consultancy', 'Consultancy']] }, { k: 'sort_order', label: 'Order', t: 'number' }
      ]
    },
    {
      id: 'enrollments', label: 'Enrollments', group: 'People', roles: PEOPLE, deleteRoles: ['super_admin'], res: 'enrollments', noCreate: true, noun: 'enrollment',
      badge: 'pending_enrollments',
      intro: 'Requests from the Enroll Now button. Contact the applicant to agree the date and fee, then Confirm or Reject.',
      detailTitle: function (r) { return 'Enrollment: ' + r.name; },
      cols: [['created_at', 'Received', function (r) { return esc(fmtDT(r.created_at)); }],
        ['name', 'Applicant', function (r) { return '<b>' + esc(r.name) + '</b>' + (r.organisation ? '<div class="sub">' + esc(r.organisation) + '</div>' : ''); }],
        ['course_title', 'Course'],
        ['contact', 'Contact', function (r) { return esc(r.phone || '') + '<div class="sub">' + esc(r.email || '') + '</div>'; }],
        ['preferred_date', 'Preferred date', function (r) { return esc(r.preferred_date || '-'); }],
        ['status', 'Status', function (r) { return statusPill(r.status); }]],
      filter: { key: 'status', opts: [['', 'All statuses'], ['pending', 'Pending'], ['contacted', 'Contacted'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected']] },
      quick: function (r) {
        var q = [];
        if (r.status !== 'confirmed') q.push({ label: 'Confirm', patch: { status: 'confirmed' }, cls: 'ok' });
        if (r.status !== 'rejected') q.push({ label: 'Reject', patch: { status: 'rejected' }, cls: 'danger', confirm: 'Reject this enrollment?' });
        return q;
      },
      fields: [{ k: 'status', label: 'Status', t: 'select', opts: [['pending', 'Pending (not contacted yet)'], ['contacted', 'Contacted'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected']], full: true }],
      detail: function (r) {
        return contactButtons(r, 'Your enrollment: ' + r.course_title) +
          '<dl class="detail"><dt>Received</dt><dd>' + esc(fmtDT(r.created_at)) + '</dd><dt>Status</dt><dd>' + statusPill(r.status) + '</dd>' +
          '<dt>Course</dt><dd>' + esc(r.course_title) + '</dd><dt>Full name</dt><dd>' + esc(r.name) + '</dd>' +
          '<dt>Email</dt><dd>' + esc(r.email) + '</dd><dt>Phone</dt><dd>' + esc(r.phone) + '</dd>' +
          '<dt>Organisation</dt><dd>' + esc(r.organisation || '-') + '</dd><dt>Preferred date</dt><dd>' + esc(r.preferred_date || '-') + '</dd>' +
          '<dt>Message</dt><dd>' + esc(r.message || '-') + '</dd></dl>';
      }
    },
    {
      // Only Super admin can delete; Support marks enquiries as resolved instead.
      id: 'enquiries', label: 'Enquiries', group: 'People', roles: PEOPLE, deleteRoles: ['super_admin'], res: 'enquiries', noCreate: true, noun: 'enquiry',
      badge: 'new_enquiries',
      intro: 'Messages sent to Grow Nation. Reply by email, phone or WhatsApp, then mark the message as resolved.',
      detailTitle: function (r) { return 'Message from ' + r.name; },
      cols: [['created_at', 'Received', function (r) { return esc(fmtDT(r.created_at)); }],
        ['name', 'From', function (r) { return '<b>' + esc(r.name) + '</b>' + (r.organisation ? '<div class="sub">' + esc(r.organisation) + '</div>' : ''); }],
        ['message', 'Message', function (r) { return (r.interest ? '<b>' + esc(r.interest) + '</b><br>' : '') + cut(r.message, 90); }],
        ['contact', 'Contact', function (r) { return esc(r.phone || '') + '<div class="sub">' + esc(r.email || '') + '</div>'; }],
        ['status', 'Status', function (r) { return statusPill(r.status); }]],
      filter: { key: 'status', opts: [['', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Resolved']] },
      quick: function (r) { return r.status === 'closed' ? [] : [{ label: 'Mark resolved', patch: { status: 'closed' }, cls: 'ok' }]; },
      fields: [{ k: 'status', label: 'Status', t: 'select', opts: [['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Resolved']], full: true }],
      detail: function (r) {
        return contactButtons(r, 'Re: your message to Grow Nation') +
          '<dl class="detail"><dt>Received</dt><dd>' + esc(fmtDT(r.created_at)) + '</dd><dt>Name</dt><dd>' + esc(r.name) + '</dd>' +
          '<dt>Organisation</dt><dd>' + esc(r.organisation || '-') + '</dd><dt>Phone</dt><dd>' + esc(r.phone || '-') + '</dd>' +
          '<dt>Email</dt><dd>' + esc(r.email || '-') + '</dd><dt>Interested in</dt><dd>' + esc(r.interest || r.course_title || '-') + '</dd>' +
          '<dt>Message</dt><dd>' + esc(r.message || '-') + '</dd></dl>';
      }
    },
    {
      // Only Super admin can delete; Certificate officers revoke instead.
      id: 'certificates', label: 'Certificates', group: 'Certificates', roles: ['super_admin', 'certificate_officer'], deleteRoles: ['super_admin'], res: 'certificates', noun: 'certificate',
      intro: 'Anyone can check these numbers in the Verification section of the website. The holder\'s name is never shown there.',
      cols: [['number', 'Number', function (r) { return '<b class="mono">' + esc(r.number) + '</b>'; }], ['holder_name', 'Holder'], ['course_title', 'Course'],
        ['issue_date', 'Issued', function (r) { return '<span class="nw">' + esc(r.issue_date) + '</span>'; }],
        ['valid_until', 'Valid until', function (r) { return '<span class="nw">' + esc(r.valid_until || 'no expiry') + '</span>'; }],
        ['status', 'Status', function (r) { return statusPill(r.status === 'revoked' ? 'revoked' : (+r.is_expired ? 'expired' : 'valid')); }],
        ['check', 'Website', function (r) { return '<a class="lnk" href="/?n=' + encodeURIComponent(r.number) + '#verification" target="_blank" rel="noopener">Check &#8599;</a>'; }]],
      filter: { key: 'status', opts: [['', 'All'], ['valid', 'Valid'], ['revoked', 'Revoked']] },
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
    { id: 'settings', label: 'Website settings', group: 'Settings', roles: CONTENT, render: renderSettings },
    {
      // Hidden from the menu: the website no longer shows these. Delete "hidden: true" to bring a section back.
      id: 'resources', label: 'Resources', roles: CONTENT, res: 'resources', noun: 'resource', hidden: true,
      cols: [['title', 'Title'], ['type', 'Type'], ['status', 'Status', function (r) { return statusPill(r.status); }]],
      fields: [{ k: 'title', label: 'Title', req: true, full: true }, { k: 'status', label: 'Status', t: 'select', opts: PUB }]
    },
    {
      id: 'slides', label: 'Home slider', roles: CONTENT, res: 'slides', noun: 'slide', hidden: true,
      cols: [['sort_order', 'Order'], ['title', 'Title'], ['active', 'Active', function (r) { return yes(r.active); }]],
      fields: [{ k: 'title', label: 'Headline', req: true, full: true }, { k: 'active', label: 'Show this slide', t: 'check' }]
    },
    {
      id: 'testimonials', label: 'Testimonials', roles: CONTENT, res: 'testimonials', noun: 'testimonial', hidden: true,
      cols: [['name', 'Name'], ['quote', 'Quote', function (r) { return cut(r.quote, 80); }], ['active', 'Active', function (r) { return yes(r.active); }]],
      fields: [{ k: 'name', label: 'Name', req: true }, { k: 'quote', label: 'Quote', t: 'textarea', req: true, full: true }, { k: 'active', label: 'Show on website', t: 'check' }]
    },
    {
      id: 'users', label: 'Staff users', group: 'Admin', roles: ['super_admin'], res: 'users', noun: 'user',
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
    { id: 'audit', label: 'Activity log', group: 'Admin', roles: ['super_admin'], render: renderAudit },
    { id: 'account', label: 'My account', group: 'Admin', roles: null, render: renderAccount }
  ];

  function allowed(sec) { return !sec.hidden && (!sec.roles || sec.roles.indexOf(me.role) >= 0); }
  function canDelete(sec) { return !sec.deleteRoles || sec.deleteRoles.indexOf(me.role) >= 0; }
  function secById(id) { return SECTIONS.filter(function (s) { return s.id === id; })[0]; }

  // ---------- navigation ----------
  var NAV_ICON = {
    overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    training: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    consultancy: '<path d="M4 7h16v12H4z"/><path d="M9 7V4h6v3M4 12h16"/>',
    enrollments: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 11-3"/><path d="M15 17l2 2 4-4"/>',
    enquiries: '<path d="M4 4h16v12H8l-4 4z"/>',
    certificates: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
    batches: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    categories: '<path d="M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    audit: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  var badges = {};

  function buildNav() {
    var last = null;
    $('#nav').innerHTML = SECTIONS.filter(allowed).map(function (s) {
      var head = '';
      if (s.group && s.group !== last) head = '<div class="ngroup">' + esc(s.group) + '</div>';
      last = s.group;
      var b = s.badge && badges[s.badge] ? '<span class="nbadge">' + esc(badges[s.badge]) + '</span>' : '';
      return head + '<a class="nav" href="#' + s.id + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (NAV_ICON[s.id] || '') + '</svg><span>' + esc(s.label) + '</span>' + b + '</a>';
    }).join('');
    $('#who').innerHTML = '<b>' + esc(me.name) + '</b><span>' + esc(ROLE_LABEL[me.role] || me.role) + '</span>';
    markNav();
  }

  function markNav() {
    var id = location.hash.replace('#', '') || 'overview';
    $$('#nav a').forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  // Pending enrollments / new enquiries counts shown next to the menu items.
  function refreshBadges() {
    if (PEOPLE.indexOf(me.role) < 0) return Promise.resolve();
    return api('/stats').then(function (s) { badges = s; buildNav(); return s; }).catch(function () {});
  }

  function route() {
    var id = location.hash.replace('#', '') || 'overview';
    var sec = SECTIONS.filter(function (s) { return s.id === id && allowed(s); })[0] || SECTIONS[0];
    markNav();
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

  function applyQuick(sec, row, q) {
    if (q.confirm && !confirm(q.confirm)) return Promise.resolve();
    return api('/' + sec.res + '/' + row.id, { json: q.patch, method: 'PUT' }).then(function () {
      flash(q.label.replace(/^Mark /, '') + ': done.');
      if ($('#dlg').open) $('#dlg').close();
      refreshBadges();
      route();
    }).catch(function (e) { flash(e.message, true); });
  }

  function renderResource(sec) {
    return api('/' + sec.res).then(function (rows) {
      if (sec.rowFilter) rows = rows.filter(sec.rowFilter);
      var q = '', fval = '';
      var tools = $('#tools');
      var html = '<input type="search" id="q" placeholder="Search..." aria-label="Search">';
      if (sec.filter) html += '<select id="flt" aria-label="Filter">' + sec.filter.opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      if (!sec.noCreate) html += '<button class="btn" id="add">+ Add ' + esc(sec.noun) + '</button>';
      tools.innerHTML = html;

      function byId(id) { return rows.filter(function (r) { return String(r.id) === String(id); })[0]; }

      function draw() {
        var list = rows.filter(function (r) {
          if (fval && r[sec.filter.key] !== fval) return false;
          if (!fval && sec.filter && sec.filter.hideByDefault && r[sec.filter.key] === sec.filter.hideByDefault) return false;
          if (!q) return true;
          return Object.keys(r).some(function (k) { return String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q) >= 0; });
        });
        var intro = sec.intro ? '<p class="intro">' + esc(sec.intro) + '</p>' : '';
        var del = canDelete(sec);
        if (!del && sec.id === 'certificates') intro += '<p class="intro">To withdraw a certificate, edit it and set the status to Revoked. Only a Super admin can delete.</p>';
        if (!del && sec.id === 'enquiries') intro += '<p class="intro">Only a Super admin can delete a message.</p>';
        var total = rows.filter(function (r) { return !(sec.filter && sec.filter.hideByDefault && r[sec.filter.key] === sec.filter.hideByDefault) || fval === sec.filter.hideByDefault; }).length;
        var count = '<p class="count">Showing ' + list.length + ' of ' + total + '</p>';
        if (!list.length) {
          $('#view').innerHTML = intro + '<div class="panel empty">' + (rows.length ? 'Nothing matches your search.' : 'Nothing here yet.' + (sec.noCreate ? '' : ' Click "Add ' + esc(sec.noun) + '" to create the first one.')) + '</div>';
          return;
        }
        $('#view').innerHTML = intro + count + '<div class="tw"><table><thead><tr>' + sec.cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
          list.map(function (r) {
            return '<tr>' + sec.cols.map(function (c) { return '<td' + (c[0] === 'image' ? ' class="tc"' : '') + '>' + (c[2] ? c[2](r) : cut(r[c[0]], 70)) + '</td>'; }).join('') +
              '<td class="act">' + quickButtons(sec, r, 'data-q') +
              '<button class="btn ghost sm" data-e="' + r.id + '">' + (sec.detail ? 'View' : 'Edit') + '</button>' +
              (del ? '<button class="btn danger sm" data-d="' + r.id + '" aria-label="Delete">Delete</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
        $$('[data-e]').forEach(function (b) { b.onclick = function () { openForm(sec, byId(b.getAttribute('data-e'))); }; });
        $$('[data-q]').forEach(function (b) {
          b.onclick = function () {
            var p = b.getAttribute('data-q').split(':'), row = byId(p[0]);
            applyQuick(sec, row, sec.quick(row)[+p[1]]);
          };
        });
        $$('[data-d]').forEach(function (b) {
          b.onclick = function () {
            var row = byId(b.getAttribute('data-d'));
            if (!confirm('Delete this ' + sec.noun + '? This cannot be undone.' + (sec.deleteTip ? '\n\n' + sec.deleteTip : ''))) return;
            api('/' + sec.res + '/' + row.id, { method: 'DELETE' }).then(function () { flash('Deleted.'); refreshBadges(); route(); }).catch(function (e) { flash(e.message, true); });
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
    var lab = '<label for="' + id + '">' + esc(f.label) + (f.req || (f.createReq && !row) ? ' <b class="req">*</b>' : '') + '</label>';
    var hint = f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '';
    var cls = f.full ? ' class="full"' : '';
    var body;
    if (f.t === 'textarea') body = '<textarea id="' + id + '" name="' + f.k + '">' + esc(v) + '</textarea>';
    else if (f.t === 'check') {
      return '<div' + cls + '><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="' + id + '" name="' + f.k + '"' + (+v ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + hint + '</div>';
    } else if (f.t === 'select') {
      var opts = (typeof f.opts === 'function' ? f.opts(row) : f.opts) ||
        (lookups[f.from] || []).filter(function (o) { return !f.where || f.where(o); }).map(function (o) { return [o.id, o.name || o.title]; });
      if (!opts.length && f.from) hint = '<div class="hint warn">Nothing to choose yet: add one first under ' + esc(f.from === 'categories' ? 'Categories' : 'Training services') + '.</div>';
      body = '<select id="' + id + '" name="' + f.k + '">' + (f.req && !row ? '<option value="">Choose...</option>' : '') +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    } else if (f.t === 'upload') {
      var isImg = /image/.test(f.accept || '') && !/pdf/.test(f.accept || '');
      body = (isImg ? '<div class="preview" id="' + id + '_pv">' + (safeUrl(v) ? '<img src="' + esc(v) + '" alt="">' : '<span>No image</span>') + '</div>' : '') +
        '<div class="up"><input type="text" id="' + id + '" name="' + f.k + '" value="' + esc(v) + '" placeholder="Choose a file or paste a link">' +
        '<label class="btn ghost sm" for="' + id + '_file" style="margin:0;white-space:nowrap">Upload</label>' +
        '<input type="file" id="' + id + '_file" data-for="' + id + '" accept="' + esc(f.accept || '') + '"></div>';
    } else {
      var type = f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'password' ? 'password' : (f.type || 'text');
      body = '<input id="' + id + '" name="' + f.k + '" type="' + type + '" value="' + (f.t === 'password' ? '' : esc(v)) + '"' + (f.t === 'password' ? ' autocomplete="new-password"' : '') + '>';
    }
    return '<div' + cls + '>' + lab + body + hint + '</div>';
  }

  function visibleFields(sec, row) {
    return sec.fields.filter(function (f) { return !(f.editOnly && !row) && (!f.showIf || f.showIf(row)); });
  }

  function openForm(sec, row) {
    cur = { sec: sec, row: row };
    return loadLookups().then(function () {
      $('#dtitle').textContent = sec.detail ? (sec.detailTitle ? sec.detailTitle(row) : 'Details') : (row ? 'Edit ' : 'Add ') + sec.noun;
      var html = sec.detail && row ? '<div class="full">' + sec.detail(row) + (sec.quick && sec.quick(row).length ? '<div class="quick-row"><span>Quick action:</span>' + quickButtons(sec, row, 'data-dq') + '</div>' : '') + '</div>' : '';
      html += visibleFields(sec, row).map(function (f) { return fieldHTML(sec, f, row); }).join('');
      $('#dbody').innerHTML = html;
      $('#dmsg').textContent = '';
      $('#dsave').textContent = sec.detail ? 'Save status' : 'Save';
      $$('#dbody [data-dq]').forEach(function (b) {
        b.onclick = function () { applyQuick(sec, row, sec.quick(row)[+b.getAttribute('data-dq').split(':')[1]]); };
      });
      $$('#dbody input[type=file]').forEach(function (inp) {
        inp.onchange = function () {
          if (!inp.files[0]) return;
          var fd = new FormData();
          fd.append('file', inp.files[0]);
          $('#dmsg').textContent = 'Uploading...';
          api('/upload', { form: fd }).then(function (r) {
            var target = inp.getAttribute('data-for');
            $('#' + target).value = r.url;
            var pv = $('#' + target + '_pv');
            if (pv) pv.innerHTML = '<img src="' + esc(r.url) + '" alt="">';
            $('#dmsg').textContent = '';
          }).catch(function (e) { $('#dmsg').textContent = e.message; });
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
    visibleFields(sec, row).forEach(function (f) {
      var el = $('#f_' + f.k);
      if (!el) return;
      if (f.t === 'check') body[f.k] = el.checked ? 1 : 0;
      else if (f.t === 'password') { if (el.value) body[f.k] = el.value; }
      else body[f.k] = el.value;
    });
    if (!row && sec.defaults) Object.keys(sec.defaults).forEach(function (k) { if (!(k in body)) body[k] = sec.defaults[k]; });
    var btn = $('#dsave');
    btn.disabled = true;
    $('#dmsg').textContent = '';
    var path = '/' + sec.res + (row ? '/' + row.id : '');
    api(path, { json: body, method: row ? 'PUT' : 'POST' }).then(function () {
      $('#dlg').close();
      flash(row ? 'Saved.' : 'Added.');
      refreshBadges();
      route();
    }).catch(function (e) { $('#dmsg').textContent = e.message; }).then(function () { btn.disabled = false; });
  });

  // ---------- dashboard ----------
  var STAT_CARDS = [
    ['total_trainings', 'Total trainings', 'training'], ['total_consultancy', 'Consultancy services', 'consultancy'],
    ['total_enrollments', 'Total enrollments', 'enrollments'], ['pending_enrollments', 'Pending enrollments', 'enrollments', 'warn'],
    ['total_enquiries', 'Total enquiries', 'enquiries'], ['new_enquiries', 'New enquiries', 'enquiries', 'warn'],
    ['upcoming_batches', 'Upcoming batches', 'batches'], ['certificates', 'Certificates issued', 'certificates'], ['revoked', 'Revoked certificates', 'certificates']
  ];

  function renderOverview() {
    return api('/stats').then(function (s) {
      badges = s; buildNav();
      var cards = STAT_CARDS.filter(function (c) { return s[c[0]] !== undefined; }).map(function (c) {
        var target = secById(c[2]);
        var tag = target && allowed(target) ? 'a href="#' + c[2] + '"' : 'div';
        return '<' + tag + ' class="stat' + (c[3] && +s[c[0]] ? ' ' + c[3] : '') + '"><span class="si" aria-hidden="true"><svg viewBox="0 0 24 24">' + (NAV_ICON[c[2]] || '') + '</svg></span>' +
          '<b>' + esc(s[c[0]]) + '</b><span>' + esc(c[1]) + '</span></' + tag.split(' ')[0] + '>';
      }).join('');
      var warn = me.twofa_enabled ? '' : '<div class="err">Two-step login is off for your account. Turn it on under <a href="#account">My account</a> to protect the admin panel.</div>';
      var hello = '<div class="hello"><div><span class="badge">Grow Nation admin</span><h3>Welcome, ' + esc(me.name) + '</h3>' +
        '<p class="slogan">Train. <span>Transform.</span> Triumph.</p></div>' +
        '<div class="hello-act"><a class="btn ghost" href="/" target="_blank" rel="noopener">View website &#8599;</a></div></div>';
      var recent = '';
      if (s.recent_enrollments) {
        var sec = secById('enrollments');
        recent = '<div class="panel"><div class="ph"><h3>Recent enrollments</h3><a class="lnk" href="#enrollments">See all &rarr;</a></div>' +
          (s.recent_enrollments.length
            ? '<div class="tw flat"><table><thead><tr><th>Received</th><th>Applicant</th><th>Course</th><th>Contact</th><th>Status</th><th></th></tr></thead><tbody>' +
              s.recent_enrollments.map(function (r) {
                return '<tr><td>' + esc(fmtDT(r.created_at)) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.course_title) + '</td>' +
                  '<td>' + esc(r.phone) + '<div class="sub">' + esc(r.email) + '</div></td><td>' + statusPill(r.status) + '</td>' +
                  '<td class="act">' + quickButtons(sec, r, 'data-rq') + '</td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<p class="empty" style="padding:18px">No enrollments yet. They appear here when someone clicks Enroll Now on the website.</p>') + '</div>';
      }
      $('#view').innerHTML = warn + hello + '<div class="stats">' + cards + '</div>' + recent;
      $$('[data-rq]').forEach(function (b) {
        b.onclick = function () {
          var p = b.getAttribute('data-rq').split(':');
          var row = s.recent_enrollments.filter(function (r) { return String(r.id) === p[0]; })[0];
          applyQuick(sec_enr(), row, sec_enr().quick(row)[+p[1]]);
        };
      });
    });
  }
  function sec_enr() { return secById('enrollments'); }

  // ---------- website settings ----------
  var SETTING_GROUPS = [
    ['Contact information', 'Shown in the Contact us area at the bottom of every page, and on the About Us address card.', [
      ['office_address', 'Office address', 'textarea'], ['phone', 'Phone'], ['email', 'Email', 'email'],
      ['whatsapp', 'WhatsApp number', '', 'Digits with country code, e.g. 8801XXXXXXXXX. Adds the green WhatsApp button to every page.'],
      ['website', 'Website', '', 'For example www.grownation.org'], ['hours', 'Office hours'], ['registration', 'Registration line', '', 'Not shown on the website at the moment.']]],
    ['Social media links', 'Icons appear in the website footer. Paste the full link (starting with https://). Leave empty to hide an icon.', [
      ['facebook', 'Facebook page', 'url'], ['linkedin', 'LinkedIn page', 'url'], ['instagram', 'Instagram', 'url'], ['youtube', 'YouTube channel', 'url']]]
  ];

  function renderSettings() {
    return api('/settings').then(function (s) {
      var keys = [];
      $('#view').innerHTML = '<form id="sf" novalidate><div class="cols2">' + SETTING_GROUPS.map(function (g) {
        return '<div class="panel"><h3>' + esc(g[0]) + '</h3><p class="hint" style="margin:0 0 16px">' + esc(g[1]) + '</p>' + g[2].map(function (f) {
          keys.push(f[0]);
          var input = f[2] === 'textarea'
            ? '<textarea id="s_' + f[0] + '" rows="3">' + esc(s[f[0]]) + '</textarea>'
            : '<input id="s_' + f[0] + '" type="' + (f[2] || 'text') + '" value="' + esc(s[f[0]]) + '"' + (f[2] === 'url' ? ' placeholder="https://"' : '') + '>';
          return '<div class="frow"><label for="s_' + f[0] + '">' + esc(f[1]) + '</label>' + input + (f[3] ? '<div class="hint">' + esc(f[3]) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }).join('') + '</div><div class="savebar"><button class="btn" type="submit">Save settings</button><a class="lnk" href="/#contact" target="_blank" rel="noopener">See it on the website &#8599;</a></div></form>';
      $('#sf').onsubmit = function (e) {
        e.preventDefault();
        var body = {};
        keys.forEach(function (k) { body[k] = $('#s_' + k).value; });
        api('/settings', { json: body, method: 'PUT' }).then(function () { flash('Settings saved. The website shows them right away.'); window.scrollTo(0, 0); })
          .catch(function (er) { flash(er.message, true); window.scrollTo(0, 0); });
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

  api("/me").then(function (u) { me = u; buildNav(); route(); if (location.hash && location.hash !== "#overview") refreshBadges(); }).catch(function (e) {
    if (e.status === 401) return; // already on the way to the login page
    var msg = e.status ? e.message : 'Could not reach the server. Check that it is running, then reload the page.';
    $('#title').textContent = 'Could not load the dashboard';
    $('#view').innerHTML = '<div class="err" role="alert">' + esc(msg) + '</div><p><button class="btn" type="button" id="retry">Try again</button></p>';
    $('#retry').onclick = function () { location.reload(); };
  });
})();
