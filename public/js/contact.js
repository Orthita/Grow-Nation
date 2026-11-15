(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var INTERESTS = ['Corporate & workforce training', 'Food safety & quality systems', 'Operational excellence (Lean, 5S, TPM)', 'Export readiness & certification', 'HR, labour & social compliance', 'Professional certification courses', 'Rural & community skills', 'Educational coaching', 'Overseas education support', 'Tender & project consultancy'];
  var courseId = new URLSearchParams(location.search).get('course');
  courseId = /^\d+$/.test(courseId || '') ? courseId : null;

  var sel = $('#i');
  sel.innerHTML = INTERESTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');

  // Enroll Now: course comes from the link, so the form already knows which one.
  if (courseId) {
    G.api('/api/courses').then(function (rows) {
      var c = rows.filter(function (r) { return String(r.id) === courseId; })[0];
      if (!c) { courseId = null; return; }
      var o = document.createElement('option');
      o.textContent = 'Course: ' + c.title;
      sel.insertBefore(o, sel.firstChild);
      sel.selectedIndex = 0;
      var n = $('#course-note');
      n.textContent = 'Enrolling for: ' + c.title;
      n.classList.remove('hid');
      if (!$('#m').value) $('#m').value = 'I would like to enroll in "' + c.title + '". Please share the next batch date and fees.';
    }).catch(function () { courseId = null; });
  }

  G.settings.then(function (s) {
    var h = '<dt>Office</dt><dd>' + esc(s.office_address || 'Mohammadpur, Dhaka, Bangladesh') + '</dd>';
    if (s.registration) h += '<dt>Registration</dt><dd>' + esc(s.registration) + '</dd>';
    if (s.phone) h += '<dt>Phone</dt><dd>' + esc(s.phone) + '</dd>';
    if (s.email) h += '<dt>Email</dt><dd>' + esc(s.email) + '</dd>';
    if (s.hours) h += '<dt>Hours</dt><dd>' + esc(s.hours) + '</dd>';
    $('#details').innerHTML = h;
  });

  function err(msg) {
    var b = $('#ferr');
    if (!msg) { b.classList.add('hid'); return; }
    b.textContent = msg;
    b.classList.remove('hid');
  }

  $('#f').addEventListener('submit', function (ev) {
    ev.preventDefault();
    err('');
    var name = $('#n').value.trim(), phone = $('#p').value.trim(), email = $('#e').value.trim();
    if (name.length < 2) { err('Please enter your name.'); $('#n').focus(); return; }
    if (!phone && !email) { err('Please give a phone number or an email so we can reply.'); $('#p').focus(); return; }

    var btn = $('#fb');
    btn.disabled = true;
    G.api('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        organisation: $('#o').value,
        phone: phone,
        email: email,
        interest: sel.value,
        message: $('#m').value,
        course_id: courseId,
        website: $('#w').value
      })
    }).then(function () {
      $('#f').classList.add('hid');
      $('#course-note').classList.add('hid');
      var t = $('#thanks');
      t.classList.remove('hid');
      t.focus();
    }).catch(function (e) {
      err(e.message);
      btn.disabled = false;
    });
  });
})();
