(function () {
  var G = window.GN, $ = G.$, esc = G.esc;
  var LABEL = { learning: 'Learning Materials', career: 'Career Guidance', workplace: 'Workplace Resources' };
  var all = [], type = '';

  function draw() {
    var rows = all.filter(function (r) { return !type || r.type === type; });
    var box = $('#rl');
    if (!rows.length) { box.innerHTML = '<p class="empty">Nothing here yet. New resources are added regularly.</p>'; return; }
    box.innerHTML = rows.map(function (r) {
      var btns = '';
      if (r.file_url) btns += '<a class="btn sm" href="' + esc(G.safe(r.file_url)) + '" download>Download</a> ';
      if (r.link) btns += '<a class="btn sm ghost" href="' + esc(G.safe(r.link)) + '" target="_blank" rel="noopener">Open link</a>';
      var img = r.image ? '<img src="' + esc(G.safe(r.image)) + '" alt="" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:8px;margin-bottom:14px">' : '';
      return '<div class="card">' + img + '<div class="meta" style="margin:0 0 10px"><span>' + esc(LABEL[r.type] || r.type) + '</span></div><h3>' + esc(r.title) + '</h3><p>' + esc(r.description) + '</p>' + (btns ? '<div style="margin-top:14px">' + btns + '</div>' : '') + '</div>';
    }).join('');
    G.reveal(box);
  }

  G.$$('#rf .fpill').forEach(function (b) {
    b.onclick = function () {
      type = b.getAttribute('data-t');
      G.$$('#rf .fpill').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      draw();
    };
  });

  G.api('/api/resources').then(function (rows) { all = rows; draw(); }).catch(function () {
    $('#rl').innerHTML = '<p class="empty">Resources could not be loaded. Please refresh the page.</p>';
  });
})();
