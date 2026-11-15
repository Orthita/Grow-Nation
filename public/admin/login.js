(function () {
  var $ = function (s) { return document.querySelector(s); };
  var needCode = false;

  // Already logged in? Go straight to the dashboard.
  fetch('/api/admin/me', { credentials: 'same-origin' }).then(function (r) { if (r.ok) location.replace('/admin/dashboard.html'); }).catch(function () {});

  function err(m) {
    var b = $('#lerr');
    b.textContent = m || '';
    b.classList.toggle('hid', !m);
  }

  $('#lf').addEventListener('submit', function (e) {
    e.preventDefault();
    err('');
    var btn = $('#lb');
    btn.disabled = true;
    var payload = { email: $('#em').value, password: $('#pw').value };
    if (needCode) payload.code = $('#cd').value;

    fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (x) {
      if (x.ok && x.d.need_code) {
        needCode = true;
        $('#step1').classList.add('hid');
        $('#step2').classList.remove('hid');
        $('#cd').focus();
      } else if (x.ok) {
        location.href = '/admin/dashboard.html';
      } else {
        if (x.d.need_code) { needCode = true; $('#step1').classList.add('hid'); $('#step2').classList.remove('hid'); }
        err(x.d.error || 'Login failed');
      }
    }).catch(function () {
      err('Could not reach the server');
    }).then(function () { btn.disabled = false; });
  });
})();
