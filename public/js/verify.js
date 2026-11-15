(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var box = $('#vr'), input = $('#cn'), btn = $('#vb');

  function fmt(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    if (!m) return '';
    return +m[3] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + m[1];
  }

  function show(cls, title, body) {
    box.className = 'res ' + cls;
    box.innerHTML = '<b>' + esc(title) + '</b>' + body;
  }

  function check(n) {
    n = String(n || '').trim().toUpperCase().replace(/\s+/g, '');
    input.value = n;
    if (!n) { box.className = 'res'; box.textContent = 'Type a certificate number first.'; return; }
    btn.disabled = true;
    box.className = 'res'; box.textContent = 'Checking...';

    G.api('/api/certificates/' + encodeURIComponent(n)).then(function (r) {
      if (r.status === 'valid') {
        show('valid', 'Valid',
          esc(r.course) + (r.hours ? ', ' + esc(r.hours) + ' contact hours' : '') + ', issued ' + esc(fmt(r.issued)) + '.' +
          (r.valid_until ? ' Valid until ' + esc(fmt(r.valid_until)) + '.' : ''));
      } else if (r.status === 'expired') {
        show('expired', 'Expired', esc(r.course) + '. This certificate is past its validity date (' + esc(fmt(r.valid_until)) + ').');
      } else if (r.status === 'revoked') {
        show('revoked', 'Revoked', 'This certificate was withdrawn by Grow Nation.');
      } else {
        show('nf', 'Not found', 'We have no record of ' + esc(n) + '. Check the number and try again, or <a href="/contact.html">contact us</a>.');
      }
    }).catch(function (e) {
      show('err', 'Could not check', esc(e.message));
    }).then(function () { btn.disabled = false; });
  }

  $('#vf').addEventListener('submit', function (e) { e.preventDefault(); check(input.value); });

  var q = new URLSearchParams(location.search).get('n');
  if (q) check(q);
})();
