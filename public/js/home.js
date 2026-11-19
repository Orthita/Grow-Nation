(function () {
  var G = window.GN, $ = G.$;

  // ---- About Us: address comes from Admin > Contact details (falls back to the text in the page) ----
  G.settings.then(function (s) {
    var a = String((s && s.office_address) || '').trim();
    if (!a) return;
    $('#ab-address').textContent = a;
    $('#ab-map').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
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
