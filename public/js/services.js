// Shared by training.html and consultancy.html. The page says which type to show: <main data-type="training">.
(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var main = document.querySelector('main[data-type]');
  var type = main ? main.getAttribute('data-type') : '';
  var box = $('#svc');
  if (!box || ['training', 'consultancy'].indexOf(type) < 0) return;

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    if (!m) return '';
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + +m[3] + ', ' + m[1];
  }

  // Enroll Now opens an email to the address in Admin > Contact details (there is no enquiry form on the site).
  function enroll(c, st) {
    var href = G.validEmail(st.email)
      ? 'mailto:' + st.email + '?subject=' + encodeURIComponent('Enrollment enquiry: ' + c.title)
      : '#contact';
    var tel = G.telHref(st.phone);
    return '<a class="btn sm" href="' + esc(href) + '">Enroll Now</a>' +
      (tel ? '<p class="call">or call <a href="' + esc(tel) + '">' + esc(st.phone) + '</a></p>' : '');
  }

  function card(c, st) {
    var chips = '';
    if (c.duration) chips += '<span>Duration: ' + esc(c.duration) + '</span>';
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
    var list = r[0].filter(function (c) { return c.type === type; }), st = r[1] || {};
    box.innerHTML = list.length ? list.map(function (c) { return card(c, st); }).join('') : '<p class="empty">Nothing listed here yet.</p>';
    G.reveal(box);
    // Footer links such as /training.html#food-safety-quality-training: highlight and scroll to that card.
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && id !== 'contact' && document.getElementById(id);
    if (el && box.contains(el)) {
      el.classList.add('hl');
      setTimeout(function () { G.goTo(el); }, 60);
    }
  }).catch(function () {
    box.innerHTML = '<p class="empty">Services could not be loaded. Please refresh the page.</p>';
  });
})();
