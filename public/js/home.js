(function () {
  var G = window.GN, $ = G.$, esc = G.esc;

  // ---- Six programme areas (from MySQL) ----
  G.api('/api/courses?type=training&listing=card').then(function (rows) {
    var box = $('#hs');
    if (!rows.length) { box.innerHTML = '<p class="empty">Programmes will appear here soon.</p>'; return; }
    box.innerHTML = rows.map(function (c) {
      return '<a class="card" href="/training.html#' + esc(G.slug(c.title)) + '"><h3>' + esc(c.title) + '</h3><p>' + esc(c.summary) + '</p><small>For: ' + esc(c.best_for) + '</small></a>';
    }).join('');
    G.reveal(box);
  }).catch(function () {
    $('#hs').innerHTML = '<p class="empty">Programmes could not be loaded. Please refresh the page.</p>';
  });

  // ---- Slider ----
  G.api('/api/slides').then(function (slides) {
    if (!slides.length) return;
    $('#slider-sec').hidden = false;
    var box = $('#slider'), i = 0, timer = null;

    // Old slide links point to pages that no longer exist: send them to the new pages.
    // (Edit the slide text and link in Admin > Home slider to make this permanent.)
    function fixLink(u) {
      var p = String(u || '').trim();
      if (/^\/(resources(\.html)?)(#.*)?$/i.test(p)) return '/consultancy.html';
      if (/^\/services(\.html)?#consultancy$/i.test(p)) return '/consultancy.html';
      if (/^\/services(\.html)?(#.*)?$/i.test(p)) return '/training.html';
      if (/^\/contact(\.html)?(\?.*)?$/i.test(p)) return '#contact';
      return p;
    }
    box.innerHTML = slides.map(function (s, n) {
      var link = fixLink(s.button_link);
      var btn = s.button_text ? '<a class="btn" href="' + esc(link === '#contact' ? link : G.safe(link)) + '">' + esc(s.button_text) + '</a>' : '';
      return '<div class="slide' + (n ? '' : ' on') + '" data-img="' + esc(s.image || '') + '" role="group" aria-label="Slide ' + (n + 1) + ' of ' + slides.length + '">' +
        (s.eyebrow ? '<small>' + esc(s.eyebrow) + '</small>' : '') + '<h3>' + esc(s.title) + '</h3>' +
        (s.text ? '<p>' + esc(s.text) + '</p>' : '') + btn + '</div>';
    }).join('') + '<div class="dots">' + slides.map(function (s, n) {
      return '<button type="button" aria-label="Go to slide ' + (n + 1) + '"' + (n ? '' : ' aria-current="true"') + '></button>';
    }).join('') + '</div>';

    var els = G.$$('.slide', box), dots = G.$$('.dots button', box);
    els.forEach(function (el) {
      var u = el.getAttribute('data-img');
      if (u && /^(\/|https?:\/\/)/i.test(u)) {
        el.style.backgroundImage = 'linear-gradient(100deg,rgba(46,16,101,.9),rgba(46,16,101,.25)),url("' + u.replace(/["\\\n\r]/g, '') + '")';
      }
    });

    function show(n) {
      i = (n + els.length) % els.length;
      els.forEach(function (el, k) { el.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    }
    function play() { if (!G.RM && els.length > 1) { stop(); timer = setInterval(function () { show(i + 1); }, 6000); } }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    $('#sl-prev').onclick = function () { show(i - 1); play(); };
    $('#sl-next').onclick = function () { show(i + 1); play(); };
    dots.forEach(function (d, k) { d.onclick = function () { show(k); play(); }; });
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', play);
    box.addEventListener('focusin', stop);
    box.addEventListener('focusout', play);
    if (els.length < 2) { $('.sl-ctl').style.display = 'none'; $('.dots', box).style.display = 'none'; }
    play();
  }).catch(function () {});

  // ---- Testimonials (section stays hidden until the team adds some) ----
  G.api('/api/testimonials').then(function (rows) {
    if (!rows.length) return;
    $('#tsec').hidden = false;
    $('#tgrid').innerHTML = rows.map(function (t) {
      return '<div class="card tcard"><blockquote>&ldquo;' + esc(t.quote) + '&rdquo;</blockquote><cite>' + esc(t.name) + (t.role ? '<span>' + esc(t.role) + '</span>' : '') + '</cite></div>';
    }).join('');
    G.reveal($('#tgrid'));
  }).catch(function () {});

  // ---- Verifier box sends the number to the Verification page ----
  $('#hv').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#hn').value.trim();
    location.href = '/verify.html' + (v ? '?n=' + encodeURIComponent(v) : '');
  });

  // ---- 3D logo (falls back to the flat logo if WebGL is not available) ----
  (function () {
    var st = $('#stage');
    if (!st || !window.THREE) return;
    try {
      var T = THREE, RM = G.RM;
      var ren = new T.WebGLRenderer({ antialias: true, alpha: true });
      ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, 0.1, 50);
      cam.position.z = 5.2;
      sc.add(new T.AmbientLight(0xffffff, 0.7));
      var d = new T.DirectionalLight(0xffffff, 1.1); d.position.set(3, 4, 5); sc.add(d);
      [[0xc4b5fd, 2.4, -4, -1, 3], [0x7c3aed, 2.2, 4, 2, 3], [0xffffff, 1.2, 0, -3, 4]].forEach(function (l) {
        var p = new T.PointLight(l[0], l[1], 20); p.position.set(l[2], l[3], l[4]); sc.add(p);
      });
      var g = new T.Group(); sc.add(g);
      var M = [];
      var r1 = new T.Mesh(new T.TorusGeometry(1.55, 0.012, 8, 120), new T.MeshBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.55 }));
      r1.rotation.x = 1.2; sc.add(r1);
      var r2 = new T.Mesh(new T.TorusGeometry(1.75, 0.008, 8, 120), new T.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.85 }));
      r2.rotation.x = 1.2; r2.rotation.y = 0.5; sc.add(r2);
      var pts = [];
      for (var k = 0; k < 14; k++) {
        var pm = new T.Mesh(new T.TetrahedronGeometry(0.06 + Math.random() * 0.06), new T.MeshStandardMaterial({ color: k % 2 ? 0x6d28d9 : 0xc4b5fd, roughness: 0.3 }));
        pm.userData = { a: Math.random() * 6.28, r: 1.5 + Math.random() * 0.6, y: (Math.random() - 0.5) * 2, s: 0.3 + Math.random() * 0.5 };
        sc.add(pm); pts.push(pm);
      }
      [[[0, 0], [125, 0], [125, 125]], [[135, 0], [260, 0], [260, 125]], [[135, 135], [260, 135], [260, 260]]].forEach(function (q) {
        var s = new T.Shape();
        q.forEach(function (v, j) {
          var x = (v[0] - 130) / 100, y = (130 - v[1]) / 100;
          if (j) s.lineTo(x, y); else s.moveTo(x, y);
        });
        s.closePath();
        var geo = new T.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
        geo.translate(0, 0, -0.3);
        var m = new T.Mesh(geo, new T.MeshPhysicalMaterial({ color: 0x0b0b10, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }));
        m.scale.setScalar(0.001); g.add(m); M.push(m);
      });
      var mx = 0, my = 0, t0 = performance.now(), vis = true;
      addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
      function size() { var w = st.clientWidth || 300; ren.setSize(w, w, false); }
      if (window.ResizeObserver) new ResizeObserver(size).observe(st);
      if (window.IntersectionObserver) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(st);
      function loop(now) {
        requestAnimationFrame(loop);
        if (!vis || document.hidden) return;
        var t = (now - t0) / 1000, kk = Math.min(1, t / 1.3), e = 1 - Math.pow(1 - kk, 3);
        M.forEach(function (m, i) { m.scale.setScalar(Math.max(0.001, Math.min(1, e * 1.5 - i * 0.25))); });
        g.rotation.y = RM ? mx * 0.5 : t * 0.9;
        g.position.y = RM ? 0 : Math.sin(t * 1.1) * 0.06;
        g.rotation.x += ((my * 0.5) - g.rotation.x) * 0.06;
        r1.rotation.z = t * 0.4; r2.rotation.z = -t * 0.3;
        pts.forEach(function (p) {
          var u = p.userData, a = u.a + t * u.s;
          p.position.set(Math.cos(a) * u.r, u.y + Math.sin(t + u.a) * 0.1, Math.sin(a) * u.r);
          p.rotation.x = t; p.rotation.y = t * 0.7;
        });
        ren.render(sc, cam);
      }
      st.appendChild(ren.domElement);
      var mark = st.querySelector('.mark'); if (mark) mark.style.display = 'none';
      size(); requestAnimationFrame(loop);
    } catch (err) { /* keep the flat logo */ }
  })();
})();
