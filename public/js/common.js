// Shared by every public page: header and phone menu, footer (which is also the contact area), helpers, small animations.
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

  // Anchor id for a service card, built from its title ("Food Safety & Quality Training" -> "food-safety-quality-training").
  function slug(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  var settings = api('/api/settings').catch(function () { return {}; });

  // Published service cards (training + consultancy), loaded once.
  var cardsP = null;
  function courses() {
    if (!cardsP) cardsP = api('/api/courses?listing=card');
    return cardsP;
  }

  // Every page is a section of the one-page home page (index.html). The third value is the section id.
  var NAV = [
    ['Home', '/#home', 'home'],
    ['Our Training Services', '/#training', 'training'],
    ['Our Consultancy Services', '/#consultancy', 'consultancy'],
    ['Verification', '/#verification', 'verification'],
    ['About Us', '/#about', 'about']
  ];

  function isHome() { return /^\/(index\.html)?$/.test(location.pathname); }
  function current() { return isHome() ? 'home' : ''; }

  var ICON = {
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 7.1 7.1l1.4-2.3L21 15.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 10.5c.3 1.6 1.8 3.2 3.5 3.6l1.2-1.1 1.8.8"/>'
  };

  // Brand-neutral outline icons for the footer social links.
  var SOCIAL = {
    facebook: ['Facebook', '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>'],
    linkedin: ['LinkedIn', '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'],
    instagram: ['Instagram', '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.01"/>'],
    youtube: ['YouTube', '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>']
  };

  function validEmail(e) { return /^[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[^\s@<>"'?&]+$/.test(String(e || '')); }
  function telHref(p) { var t = String(p || '').replace(/[^\d+]/g, ''); return t.length >= 6 ? 'tel:' + t : ''; }

  function detail(icon, label, value) {
    return '<li><span class="ci" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICON[icon] + '</svg></span><div><b>' + label + '</b><span>' + value + '</span></div></li>';
  }

  function buildLayout() {
    var cur = current();
    var logo = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="lg" viewBox="0 0 260 260"><path d="M0 0H125V125Z"/><path d="M135 0H260V125Z"/><path d="M135 135H260V260Z"/></symbol></svg>';
    var links = NAV.map(function (n) {
      return '<a href="' + n[1] + '" data-nav="' + n[2] + '"' + (n[2] === cur ? ' aria-current="page"' : '') + '>' + n[0] + '</a>';
    }).join('');
    var header = '<header><div class="wrap bar"><a class="brand" href="/" aria-label="Grow Nation home"><svg aria-hidden="true"><use href="#lg"/></svg><b>Grow<br>Nation</b></a>' +
      '<button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu"><span class="mb" aria-hidden="true"></span></button>' +
      '<nav id="main-nav" aria-label="Main"><div class="pill">' + links + '</div><a class="cta" href="/#contact" data-nav="contact">Contact us</a></nav></div></header>';
    var footer = '<footer id="contact" aria-labelledby="contact-h"><div class="wrap"><div class="fg">' +
      '<div class="fbrand"><a class="brand" href="/"><svg aria-hidden="true"><use href="#lg"/></svg><b>Grow<br>Nation</b></a>' +
      '<p>An industrial consulting &amp; training organization</p>' +
      '<p class="slogan">Train. <span>Transform.</span> Triumph.</p><div class="social hid" id="ft-social"></div></div>' +
      '<div><h3 id="contact-h" tabindex="-1">Contact us</h3><ul class="clist" id="ft-contact"></ul></div>' +
      '<div><h3>Pages</h3>' + NAV.map(function (n) { return '<a href="' + n[1] + '">' + n[0] + '</a>'; }).join('') + '</div>' +
      '<div><h3>Popular programmes</h3>' +
      '<a href="/#food-safety-quality-training">HACCP and GMP</a>' +
      '<a href="/#food-safety-quality-training">ISO 22000 Internal Auditor</a>' +
      '<a href="/#operational-excellence-training">5S and Lean basics</a>' +
      '<a href="/#hr-labour-social-compliance">Labour law for supervisors</a></div>' +
      '</div><div class="copy">&copy; ' + new Date().getFullYear() + ' Grow Nation &middot; Mohammadpur, Dhaka, Bangladesh</div></div></footer>';

    document.body.insertAdjacentHTML('afterbegin', logo + '<div id="site-header">' + header + '</div>');
    var f = $('#site-footer');
    if (f) f.innerHTML = footer;

    // Contact details in the footer, all from Admin > Contact details. Empty values are left out.
    settings.then(function (s) {
      var wa = String(s.whatsapp || '').replace(/\D/g, '');
      var list = $('#ft-contact');
      if (list) {
        var rows = [];
        if (s.office_address) rows.push(detail('pin', 'Address', esc(s.office_address)));
        if (s.phone) {
          var tel = telHref(s.phone);
          rows.push(detail('phone', 'Phone', tel ? '<a href="' + esc(tel) + '">' + esc(s.phone) + '</a>' : esc(s.phone)));
        }
        if (s.email) rows.push(detail('mail', 'Email', validEmail(s.email) ? '<a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>' : esc(s.email)));
        var web = siteLink(s.website);
        if (web) rows.push(detail('web', 'Website', web));
        if (wa.length >= 8) rows.push(detail('chat', 'WhatsApp', '<a href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' + esc(s.whatsapp) + '</a>'));
        list.innerHTML = rows.join('');
        list.classList.toggle('hid', !rows.length);
      }
      // Social media links (Admin > Website settings). Only https links are shown.
      var soc = $('#ft-social');
      if (soc) {
        var links = Object.keys(SOCIAL).filter(function (k) { return /^https:\/\/[^\s"'<>]+$/i.test(s[k] || ''); });
        soc.innerHTML = links.map(function (k) {
          return '<a href="' + esc(s[k]) + '" target="_blank" rel="noopener" aria-label="Grow Nation on ' + SOCIAL[k][0] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + SOCIAL[k][1] + '</svg></a>';
        }).join('');
        soc.classList.toggle('hid', !links.length);
      }
      if (wa.length >= 8) {
        document.body.insertAdjacentHTML('beforeend',
          '<a class="wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.3z"/></svg><span>WhatsApp</span></a>');
      }
    });
  }

  // ---------- phone menu ----------
  function setupMenu() {
    var hdr = $('#site-header header'), btn = $('.menu-btn', hdr);
    if (!hdr || !btn) return;
    function set(open) {
      hdr.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    $('#main-nav').addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && hdr.classList.contains('open')) { set(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (hdr.classList.contains('open') && !hdr.contains(e.target)) set(false);
    });
    if (window.matchMedia) {
      var mq = matchMedia('(min-width:901px)');
      var onWide = function (e) { if (e.matches) set(false); };
      if (mq.addEventListener) mq.addEventListener('change', onWide); else if (mq.addListener) mq.addListener(onWide);
    }
    GN.closeMenu = function () { set(false); };
  }

  // ---------- in-page scrolling (offset for the sticky header) ----------
  function goTo(el, focusEl) {
    if (!el) return;
    var h = $('#site-header header');
    var gap = el.hasAttribute('data-sec') ? 0 : 12;
    var y = el.getBoundingClientRect().top + window.pageYOffset - (h ? h.offsetHeight : 0) - gap;
    window.scrollTo({ top: Math.max(0, y), behavior: RM ? 'auto' : 'smooth' });
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  function toContact() { goTo($('#contact'), $('#contact-h')); }

  // Links to "#something" or "/#something" on the same page scroll smoothly, below the sticky header.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.host !== location.host || a.pathname.replace(/index\.html$/, '') !== location.pathname.replace(/index\.html$/, '')) return;
    var id = decodeURIComponent(a.hash.slice(1));
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (GN.closeMenu) GN.closeMenu();
    if (history.replaceState) history.replaceState(null, '', id === 'home' ? location.pathname + location.search : '#' + id);
    if (id === 'contact') toContact();
    else if (id === 'home') window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    else goTo(target);
  });

  // While scrolling the home page, highlight the menu item of the section in view.
  function scrollSpy() {
    var secs = $$('[data-sec]').concat($('#contact') ? [$('#contact')] : []);
    if (!secs.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var h = $('#site-header header'), line = (h ? h.offsetHeight : 0) + window.innerHeight * 0.3, on = secs[0].id;
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) on = s.id; });
      // At the very bottom the footer may be too short to reach the line.
      if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 4) on = secs[secs.length - 1].id;
      $$('nav a[data-nav]').forEach(function (a) {
        if (a.getAttribute('data-nav') === on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // Scroll-in effect and card tilt (skipped when the visitor prefers less motion).
  function reveal(root) {
    if (RM || !window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    $$('.card,.step,.vbox,.vt,.quote,.chips span,.ab-card', root || document).forEach(function (el, i) {
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

  var GN = window.GN = {
    $: $, $$: $$, esc: esc, api: api, safe: safe, siteLink: siteLink, slug: slug, settings: settings,
    validEmail: validEmail, telHref: telHref, courses: courses, goTo: goTo, reveal: reveal, RM: RM
  };
  buildLayout();
  setupMenu();
  reveal();
  if (isHome()) scrollSpy();

  // Arriving with #contact, or from an old link with ?course=<id> (the course is ignored now): scroll to the footer
  // once the contact details have loaded.
  var qs = new URLSearchParams(location.search);
  if (location.hash === '#contact' || qs.has('course')) {
    settings.then(function () { setTimeout(toContact, 80); });
  } else if (isHome()) {
    // Arriving with /#training, /#about ... (or /?n=<certificate> from an old link): go to that section.
    var sid = location.hash ? decodeURIComponent(location.hash.slice(1)) : (qs.has('n') ? 'verification' : '');
    var sel = sid && sid !== 'home' && document.getElementById(sid);
    if (sel) { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; setTimeout(function () { goTo(sel); }, 80); }
  }
})();
