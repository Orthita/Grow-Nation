(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var courses = [], tab = 'training';

  function enroll(c) { return '/contact.html?course=' + encodeURIComponent(c.id); }

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    if (!m) return '';
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + +m[3] + ', ' + m[1];
  }

  function card(c) {
    var chips = '';
    if (c.duration) chips += '<span>Duration: ' + esc(c.duration) + '</span>';
    if (c.location) chips += '<span>Location: ' + esc(c.location) + '</span>';
    if (c.next_batch) chips += '<span>Next batch: ' + esc(fmtDate(c.next_batch)) + '</span>';
    var img = c.image ? '<img src="' + esc(G.safe(c.image)) + '" alt="" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:14px">' : '';
    return '<div class="card">' + img + '<h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p>' +
      (chips ? '<div class="meta">' + chips + '</div>' : '') +
      (c.topics.length ? '<h3 style="font-size:.95rem;margin-top:16px">Course content</h3><ul>' + c.topics.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (c.best_for ? '<div class="for">For: ' + esc(c.best_for) + '</div>' : '') +
      '<a class="btn sm" href="' + enroll(c) + '">Enroll Now</a></div>';
  }

  function draw() {
    var cat = tab === 'catalogue';
    $('#svc').classList.toggle('hid', cat);
    $('#cat').classList.toggle('hid', !cat);
    G.$$('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-p') === tab ? 'true' : 'false'); });

    if (cat) {
      var rows = courses.filter(function (c) { return c.listing === 'catalogue'; });
      $('#rows').innerHTML = rows.length ? rows.map(function (c) {
        return '<tr><td>' + esc(c.title) + '</td><td>' + esc(c.standard || '') + '</td><td>' + esc(c.duration || '') + '</td><td>' + esc(c.best_for || '') + '</td><td><a href="' + enroll(c) + '">Enroll</a></td></tr>';
      }).join('') : '<tr><td colspan="5">Course catalogue is being prepared.</td></tr>';
      G.reveal($('#cat'));
      return;
    }
    var list = courses.filter(function (c) { return c.listing === 'card' && c.type === tab; });
    $('#svc').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">Nothing listed here yet.</p>';
    G.reveal($('#svc'));
  }

  function fromHash() {
    var h = location.hash.replace('#', '');
    if (['training', 'consultancy', 'catalogue'].indexOf(h) >= 0) tab = h;
  }

  G.$$('.tab').forEach(function (t) {
    t.onclick = function () {
      tab = t.getAttribute('data-p');
      history.replaceState(null, '', '#' + tab);
      draw();
    };
  });
  window.addEventListener('hashchange', function () { fromHash(); draw(); });
  fromHash();

  G.api('/api/courses').then(function (rows) { courses = rows; draw(); }).catch(function () {
    $('#svc').innerHTML = '<p class="empty">Services could not be loaded. Please refresh the page.</p>';
  });
})();
