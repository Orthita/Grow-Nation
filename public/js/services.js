// Fills the Training (#svc-training) and Consultancy (#svc-consultancy) sections of the home page.
(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var boxes = { training: $('#svc-training'), consultancy: $('#svc-consultancy') };
  if (!boxes.training && !boxes.consultancy) return;

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    if (!m) return '';
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + +m[3] + ', ' + m[1];
  }

  // Enroll Now opens the enrollment form (popup). It is saved in MySQL and shows up in Admin > Enrollments.
  function enroll(c, st) {
    var tel = G.telHref(st.phone);
    return '<button type="button" class="btn sm" data-enroll="' + esc(c.id) + '" data-title="' + esc(c.title) + '" data-type="' + esc(c.type) + '">Enroll Now</button>' +
      (tel ? '<p class="call">or call <a href="' + esc(tel) + '">' + esc(st.phone) + '</a></p>' : '');
  }

  // ---------- Enrollment form (popup) ----------
  var dlg = null, lastBtn = null;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function buildDialog() {
    document.body.insertAdjacentHTML('beforeend',
      '<dialog class="enr" id="enr" aria-labelledby="enr-h">' +
      '<button type="button" class="enr-x" data-close aria-label="Close">&times;</button>' +
      '<div id="enr-body"></div></dialog>');
    dlg = $('#enr');
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) close();   // click outside the box, or a close button
    });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('enr-open');
      if (lastBtn) lastBtn.focus();
    });
  }

  function close() { if (dlg && dlg.open) dlg.close(); }

  function field(id, label, input, opt) {
    return '<div class="ef"><label for="' + id + '">' + label + (opt ? ' <span>(optional)</span>' : ' <b aria-hidden="true">*</b>') + '</label>' + input + '</div>';
  }

  function openForm(btn) {
    if (!dlg) buildDialog();
    lastBtn = btn;
    var id = btn.getAttribute('data-enroll'), title = btn.getAttribute('data-title');
    var training = btn.getAttribute('data-type') !== 'consultancy';
    $('#enr-body').innerHTML =
      '<form id="enr-f" novalidate>' +
      '<span class="badge">' + (training ? 'Training Enrollment' : 'Consultancy Request') + '</span>' +
      '<h2 id="enr-h">' + (training ? 'Enroll in this training' : 'Request this service') + '</h2>' +
      '<p class="enr-course"><small>Course</small>' + esc(title) + '</p>' +
      '<div class="eg">' +
      field('e-name', 'Full Name', '<input id="e-name" name="name" autocomplete="name" maxlength="150" required>') +
      field('e-email', 'Email Address', '<input id="e-email" name="email" type="email" autocomplete="email" maxlength="190" required>') +
      field('e-phone', 'Phone Number', '<input id="e-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="01XXXXXXXXX" required>') +
      field('e-org', 'Organization / Company Name', '<input id="e-org" name="organisation" autocomplete="organization" maxlength="190">', true) +
      field('e-date', 'Preferred Training Date', '<input id="e-date" name="preferred_date" type="date" min="' + today() + '">', true) +
      '<div class="ef full">' + '<label for="e-msg">Message <span>(optional)</span></label><textarea id="e-msg" name="message" rows="3" maxlength="2000"></textarea></div>' +
      '</div>' +
      // Hidden from people; simple bots fill it in and are ignored by the server.
      '<div class="sr" aria-hidden="true"><label for="e-web">Website</label><input id="e-web" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<p class="enr-err" id="enr-err" role="alert"></p>' +
      '<button class="btn" type="submit" id="enr-sub">Submit Enrollment</button>' +
      '</form>';

    var f = $('#enr-f');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#enr-err'), sub = $('#enr-sub');
      var v = function (n) { return f.elements[n].value.trim(); };
      var data = { course_id: +id, name: v('name'), email: v('email'), phone: v('phone'), organisation: v('organisation'),
        preferred_date: v('preferred_date'), message: v('message'), website: v('website') };

      // Same checks as the server, so most mistakes are caught before sending.
      var bad = null;
      if (data.name.length < 2) bad = ['name', 'Please enter your full name.'];
      else if (!G.validEmail(data.email)) bad = ['email', 'Please enter a valid email address.'];
      else if (!/^[0-9+()\-\s.]{6,40}$/.test(data.phone)) bad = ['phone', 'Please enter a valid phone number.'];
      else if (data.preferred_date && data.preferred_date < today()) bad = ['preferred_date', 'Preferred date cannot be in the past.'];
      G.$$('[aria-invalid]', f).forEach(function (x) { x.removeAttribute('aria-invalid'); });
      if (bad) { err.textContent = bad[1]; f.elements[bad[0]].setAttribute('aria-invalid', 'true'); f.elements[bad[0]].focus(); return; }

      err.textContent = '';
      sub.disabled = true; sub.textContent = 'Submitting...';
      G.api('/api/enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function () {
          $('#enr-body').innerHTML =
            '<div class="enr-ok" tabindex="-1" id="enr-ok"><span class="enr-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
            '<h2 id="enr-h">Enrollment submitted successfully!</h2>' +
            '<p>Thank you for your interest in our training program.</p>' +
            '<p>Our team will contact you shortly to confirm your enrollment.</p>' +
            '<p class="enr-course"><small>Course</small>' + esc(title) + '</p>' +
            '<button type="button" class="btn" data-close>Done</button></div>';
          $('#enr-ok').focus();
        })
        .catch(function (ex) {
          err.textContent = ex.message;
          sub.disabled = false; sub.textContent = 'Submit Enrollment';
        });
    });

    document.documentElement.classList.add('enr-open');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { $('#e-name').focus(); }, 30);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-enroll]');
    if (b) openForm(b);
  });

  function card(c, st) {
    var chips = '';
    if (c.duration) chips += '<span>Duration: ' + esc(c.duration) + '</span>';
    if (c.fee) chips += '<span>Fee: ' + esc(c.fee) + '</span>';
    if (c.location) chips += '<span>Location: ' + esc(c.location) + '</span>';
    if (c.next_batch) chips += '<span>Next batch: ' + esc(fmtDate(c.next_batch)) + '</span>';
    var img = c.image ? '<img src="' + esc(G.safe(c.image)) + '" alt="" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:14px">' : '';
    return '<div class="card" id="' + esc(G.slug(c.title)) + '">' + img + '<h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p>' +
      (chips ? '<div class="meta">' + chips + '</div>' : '') +
      (c.topics.length ? '<h3 style="font-size:.95rem;margin-top:16px">Course content</h3><ul>' + c.topics.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (c.best_for ? '<div class="for">For: ' + esc(c.best_for) + '</div>' : '') +
      enroll(c, st) + '</div>';
  }

  Promise.all([G.courses(), G.settings]).then(function (r) {
    var st = r[1] || {};
    Object.keys(boxes).forEach(function (type) {
      var box = boxes[type];
      if (!box) return;
      var list = r[0].filter(function (c) { return c.type === type; });
      box.innerHTML = list.length ? list.map(function (c) { return card(c, st); }).join('') : '<p class="empty">Nothing listed here yet.</p>';
      G.reveal(box);
    });
    // Links such as /#food-safety-quality-training: highlight and scroll to that card.
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el && el.classList.contains('card')) {
      el.classList.add('hl');
      setTimeout(function () { G.goTo(el); }, 60);
    } else if (id && el && el.hasAttribute('data-sec')) {
      // Cards above the target changed the page height: settle on the section again.
      setTimeout(function () { G.goTo(el); }, 60);
    }
  }).catch(function () {
    Object.keys(boxes).forEach(function (t) {
      if (boxes[t]) boxes[t].innerHTML = '<p class="empty">Services could not be loaded. Please refresh the page.</p>';
    });
  });
})();
