// Shared by every public page: header, footer, helpers, small animations.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function api(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) { var e = new Error((d && d.error) || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  // Only allow local paths and http(s) links in values that come from the database.
  function safe(u) { return /^(\/|https?:\/\/)/i.test(u || '') ? u : '#'; }

  // Turn the "website" setting (e.g. www.grownation.org) into a link. Returns '' if it doesn't look like a web address.
  function siteLink(w) {
    var host = String(w || '').trim().replace(/^https?:\/\//i, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s"'<>]*)?$/i.test(host)) return '';
    return '<a href="https://' + esc(host) + '" target="_blank" rel="noopener">' + esc(host.replace(/\/$/, '')) + '</a>';
  }

  var settings = api('/api/settings').catch(function () { return {}; });

  var NAV = [
    ['Home', '/', 'home'],
    ['About', '/about.html', 'about'],
    ['Our Resources', '/resources.html', 'resources'],
    ['Our Services', '/services.html', 'services'],
    ['Verification', '/verify.html', 'verify']
  ];

  function current() {
    var p = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (p === '' || p === '/') return 'home';
    return p.replace(/^\//, '');
  }

  function buildLayout() {
    var cur = current();
    var logo = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="lg" viewBox="0 0 260 260"><path d="M0 0H125V125Z"/><path d="M135 0H260V125Z"/><path d="M135 135H260V260Z"/></symbol></svg>';
    var links = NAV.map(function (n) {
      return '<a href="' + n[1] + '"' + (n[2] === cur ? ' aria-current="page"' : '') + '>' + n[0] + '</a>';
    }).join('');
    var header = '<header><div class="wrap bar"><a class="brand" href="/" aria-label="Grow Nation home"><svg aria-hidden="true"><use href="#lg"/></svg><b>Grow<br>Nation</b></a>' +
      '<nav aria-label="Main"><div class="pill">' + links + '</div><a class="cta" href="/contact.html"' + (cur === 'contact' ? ' aria-current="page"' : '') + '>Contact us</a></nav></div></header>';
    var footer = '<footer><div class="wrap"><div class="fg"><div><a class="brand" href="/" style="margin-bottom:12px"><svg aria-hidden="true"><use href="#lg"/></svg><b>Grow<br>Nation</b></a>' +
      '<p>Grow Nation &mdash; an industrial consulting &amp; training organization. Train. Transform. Triumph.</p><p id="ft-contact" class="note"></p></div>' +
      '<div><h3>Pages</h3>' + NAV.map(function (n) { return '<a href="' + n[1] + '">' + n[0] + '</a>'; }).join('') + '<a href="/contact.html">Contact us</a></div>' +
      '<div><h3>Popular programmes</h3><a href="/services.html#catalogue">HACCP and GMP</a><a href="/services.html#catalogue">ISO 22000 Internal Auditor</a><a href="/services.html#catalogue">5S and Lean basics</a><a href="/services.html#catalogue">Labour law for supervisors</a></div>' +
      '</div><div class="copy">&copy; ' + new Date().getFullYear() + ' Grow Nation &middot; Mohammadpur, Dhaka, Bangladesh</div></div></footer>';

    document.body.insertAdjacentHTML('afterbegin', logo + '<div id="site-header">' + header + '</div>');
    var f = $('#site-footer');
    if (f) f.innerHTML = footer;

    settings.then(function (s) {
      var bits = [];
      if (s.phone) bits.push('Phone: ' + esc(s.phone));
      if (s.email) bits.push('Email: ' + esc(s.email));
      var web = siteLink(s.website);
      if (web) bits.push('Website: ' + web);
      var el = $('#ft-contact');
      if (el) el.innerHTML = bits.join('<br>');
      var wa = String(s.whatsapp || '').replace(/\D/g, '');
      if (wa.length >= 8) {
        document.body.insertAdjacentHTML('beforeend',
          '<a class="wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.3z"/></svg><span>WhatsApp</span></a>');
      }
    });
  }

  // Scroll-in effect and card tilt (skipped when the visitor prefers less motion).
  function reveal(root) {
    if (RM || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    $$('.card,.step,.tw,.vbox,.vt,.quote,.chips span', root || document).forEach(function (el, i) {
      if (el.classList.contains('rv')) return;
      el.classList.add('rv');
      el.style.transitionDelay = (i % 4) * 80 + 'ms';
      io.observe(el);
    });
  }

  if (!RM && window.matchMedia && matchMedia('(hover:hover)').matches) {
    var cur;
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card,.step');
      if (cur && cur !== c) { cur.style.transform = ''; cur.style.boxShadow = ''; }
      cur = c;
      if (!c) return;
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transition = 'transform .08s';
      c.style.transform = 'perspective(700px) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 10) + 'deg) translateZ(6px)';
      c.style.boxShadow = '0 18px 36px #6D28D933';
    });
  }

  window.GN = { $: $, $$: $$, esc: esc, api: api, safe: safe, siteLink: siteLink, settings: settings, reveal: reveal, RM: RM };
  buildLayout();
  reveal();
})();
