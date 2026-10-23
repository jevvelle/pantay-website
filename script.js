/* ===== SPRING ENGINE (damping + response, interruptible, velocity-aware) ===== */
const SPRING = {
  default: { damping: 1, response: .4 },    // no overshoot
  bounce:  { damping: .8, response: .35 },  // only after a flick
  sheet:   { damping: .8, response: .3 }
};
const mq = matchMedia('(prefers-reduced-motion: reduce)');
class Spring {
  constructor(x, cb, eps = .01) { this.x = x; this.v = 0; this.t = x; this.cb = cb; this.eps = eps; this.raf = 0; }
  to(t, { v = this.v, damping = 1, response = .4 } = {}) {      // always starts from the live value
    cancelAnimationFrame(this.raf); this.t = t; this.v = v;
    if (mq.matches) { this.x = t; this.v = 0; this.cb(t); return; }
    const w = 2 * Math.PI / response, k = w * w, c = 2 * damping * w;
    let last = performance.now();
    const step = now => {
      const dt = Math.min((now - last) / 1e3, .032); last = now;
      const n = Math.ceil(dt / .004) || 1, h = dt / n;
      for (let i = 0; i < n; i++) { this.v += (k * (this.t - this.x) - c * this.v) * h; this.x += this.v * h; }
      this.cb(this.x);
      if (Math.abs(this.v) < this.eps && Math.abs(this.t - this.x) < this.eps) { this.x = this.t; this.v = 0; this.cb(this.x); }
      else this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  set(x) { cancelAnimationFrame(this.raf); this.x = x; this.v = 0; this.cb(x); }
}
const project = (v, d = .998) => (v / 1000) * d / (1 - d);          // momentum projection
const rubber = (o, dim, c = .55) => (o * dim * c) / (dim + c * Math.abs(o));
const $ = id => document.getElementById(id);

/* Header scroll edge */
const hdr = $('hdr');
addEventListener('scroll', () => hdr.classList.toggle('scrolled', scrollY > 8), { passive: true });

/* ===== MOBILE DRAWER ===== */
const dr = $('drawer'), scrim = $('scrim'), burger = $('burger');
const W = () => dr.offsetWidth; let isOpen = false;
const ds = new Spring(1e4, x => {
  dr.style.transform = `translateX(${x}px)`;
  scrim.style.opacity = Math.max(0, Math.min(1, 1 - x / W()));
}, .05);
const syncClosed = () => { if (!isOpen) ds.set(W() + 24); };
syncClosed(); addEventListener('resize', syncClosed);
function openDrawer(v = 0) {
  isOpen = true; dr.inert = false; scrim.classList.add('on'); burger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden'; ds.to(0, { ...SPRING.sheet, v }); setTimeout(() => $('close').focus(), 50);
}
function closeDrawer(v = 0) {
  isOpen = false; scrim.classList.remove('on'); burger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = ''; ds.to(W() + 24, { ...SPRING.default, response: .35, v });
  setTimeout(() => { if (!isOpen) dr.inert = true; }, 400); burger.focus({ preventScroll: true });
}
burger.onclick = () => openDrawer(); $('close').onclick = () => closeDrawer(); scrim.onclick = () => closeDrawer();
dr.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeDrawer()));
addEventListener('keydown', e => {
  if (!isOpen) return;
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'Tab') {                                              // focus trap
    const f = [...dr.querySelectorAll('a,button')], a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});
/* drag to dismiss: 1:1 tracking, rubber-band at the open edge, velocity handoff, projected landing */
let g = null;
dr.addEventListener('pointerdown', e => { if (isOpen) g = { sx: e.clientX, sy: e.clientY, on: false, base: ds.x, id: e.pointerId, h: [] }; });
dr.addEventListener('pointermove', e => {
  if (!g) return; const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
  if (!g.on) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g.on = true; g.sx = e.clientX; g.base = ds.x; ds.set(ds.x); dr.setPointerCapture(g.id); }
    else return;
  }
  let x = g.base + (e.clientX - g.sx); if (x < 0) x = -rubber(-x, W());
  ds.set(x); g.h.push({ x: e.clientX, t: e.timeStamp }); g.h = g.h.filter(p => e.timeStamp - p.t < 100);
});
const endDrag = () => {
  if (!g) return; const h = g.h, was = g.on; g = null; if (!was) return;
  const a = h[0], b = h[h.length - 1], v = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) * 1e3 : 0;
  (ds.x + project(v) > W() / 2) ? closeDrawer(v) : openDrawer(v);
};
dr.addEventListener('pointerup', endDrag); dr.addEventListener('pointercancel', endDrag);

/* ===== COOKIE SHEET ===== */
const ck = $('cookie'); let ckOpen = false;
const H = () => ck.offsetHeight + 80;
const cs = new Spring(1e4, y => {
  const p = Math.max(0, Math.min(1, 1 - y / H()));
  ck.style.transform = `translateY(${y}px) scale(${.96 + .04 * p})`; ck.style.opacity = p; ck.style.visibility = p < .01 ? 'hidden' : 'visible';
}, .05);
cs.set(H());
const KEY = 'pantay-consent';
const store = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const showCookie = prefs => { ckOpen = true; $('ckMain').hidden = !!prefs; $('ckPrefs').hidden = !prefs; cs.set(H()); cs.to(0, SPRING.default); };
const hideCookie = () => { ckOpen = false; cs.to(H(), { ...SPRING.default, response: .35 }); };
const decide = c => { store({ ...c, at: Date.now() }); hideCookie(); applyConsent(c); };
function applyConsent(c) { /* Load analytics / marketing / functional scripts here, only when c.<key> is true */ }
$('ckAll').onclick = () => decide({ analytics: true, marketing: true, functional: true });
$('ckRej').onclick = () => decide({ analytics: false, marketing: false, functional: false });
$('ckCus').onclick = () => { $('ckMain').hidden = true; $('ckPrefs').hidden = false; ck.querySelector('input:not([disabled])').focus(); };
$('ckBack').onclick = () => { $('ckPrefs').hidden = true; $('ckMain').hidden = false; $('ckCus').focus(); };
$('ckSave').onclick = () => { const c = {}; ck.querySelectorAll('[data-k]').forEach(i => c[i.dataset.k] = i.checked); decide(c); };
$('cookieReopen').onclick = () => {
  const c = load() || {}; ck.querySelectorAll('[data-k]').forEach(i => i.checked = !!c[i.dataset.k]);
  showCookie(true); setTimeout(() => ck.querySelector('input:not([disabled])').focus(), 60);
};
addEventListener('keydown', e => { if (e.key === 'Escape' && ckOpen && load()) hideCookie(); });
const saved = load(); if (saved) applyConsent(saved); else setTimeout(() => showCookie(false), 700);

/* ===== SPRING STAT COUNTERS (static under reduced motion) ===== */
const fmt = (p, n, s) => p + Math.round(n).toLocaleString('en-US') + s;
const counters = [...document.querySelectorAll('.stat')].map((el, i) => {
  const n = +el.dataset.n, p = el.dataset.pre || '', s = el.dataset.suf || '', sp = el.querySelector('.num span');
  return { el, n, i, done: false, sp: new Spring(n, x => sp.textContent = fmt(p, x, s), .3) };
});
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const c = counters.find(c => c.el === e.target); if (!c || c.done) return; c.done = true; io.unobserve(e.target);
  if (mq.matches) return; c.sp.set(0);
  setTimeout(() => c.sp.to(c.n, { damping: 1, response: .9 }), (c.i % 3) * 90);
}), { threshold: .4 });
counters.forEach(c => io.observe(c.el));

/* ===== TILE SPRING LIFT: hover rises, press compresses, release rebounds ===== */
document.querySelectorAll('.lift').forEach(el => {
  const rot = getComputedStyle(el).transform; el.style.setProperty('--base', rot === 'none' ? '' : rot);
  const s = new Spring(1, x => el.style.scale = x, .0005); let down = false;
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !down) s.to(1.03, SPRING.default); });
  el.addEventListener('pointerleave', () => { down = false; s.to(1, SPRING.default); });
  el.addEventListener('pointerdown', () => { down = true; s.to(.97, { damping: 1, response: .2 }); });
  el.addEventListener('pointerup', e => { down = false; s.to(e.pointerType === 'mouse' ? 1.03 : 1, SPRING.bounce); });
  el.addEventListener('pointercancel', () => { down = false; s.to(1, SPRING.default); });
});

/* ===== NEWSLETTER VALIDATION: on blur, specific messages, ARIA live result, honeypot ===== */
const f = $('news'), em = $('em'), cons = $('cons');
const vEmail = () => {
  const v = em.value.trim(), ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  em.setAttribute('aria-invalid', !ok);
  $('emerr').textContent = ok ? '' : (v ? 'Enter a valid email, for example name@example.com.' : 'Email address is required.');
  return ok;
};
em.addEventListener('blur', vEmail);
em.addEventListener('input', () => em.getAttribute('aria-invalid') === 'true' && vEmail());
f.addEventListener('submit', e => {
  e.preventDefault(); const a = vEmail(), b = cons.checked;
  $('conserr').textContent = b ? '' : 'Please confirm your consent to subscribe.';
  if (f.website.value) return;                                         // bot trap
  if (!a) { em.focus(); return; } if (!b) { cons.focus(); return; }
  $('newsmsg').textContent = 'Thank you for subscribing. (Prototype: not yet connected to a mailing list.)'; f.reset();
});

/* ===== HERO PHOTO CAROUSEL: crossfade, arrows, dots, swipe. Autoplay runs one loop, then stops; any click stops it ===== */
(() => {
  const sl = [...document.querySelectorAll('.slide')]; if (!sl.length) return;
  const dots = [...document.querySelectorAll('.hero-ctl .dot')], hero = document.querySelector('.hero-bg');
  let i = 0, t = null, sx = null;
  const show = n => { i = (n + sl.length) % sl.length; sl.forEach((s, k) => s.classList.toggle('on', k === i)); dots.forEach((d, k) => d.setAttribute('aria-current', k === i)); };
  const stop = () => { clearInterval(t); t = null; };
  const manual = n => { stop(); show(n); };
  if (!mq.matches) t = setInterval(() => { show(i + 1); if (i === 0) stop(); }, 6000);
  $('hnext').onclick = () => manual(i + 1);
  $('hprev').onclick = () => manual(i - 1);
  dots.forEach((d, k) => d.onclick = () => manual(k));
  hero.addEventListener('pointerdown', e => { sx = e.clientX; });
  hero.addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 60) manual(i + (e.clientX < sx ? 1 : -1)); sx = null; });
  hero.addEventListener('keydown', e => { if (e.target.closest('.hero-ctl')) { if (e.key === 'ArrowRight') manual(i + 1); if (e.key === 'ArrowLeft') manual(i - 1); } });
  show(0);
})();

/* ===== ASK PANTAY ASSISTANT: scripted answers, no backend. Edit the KB list to change answers. =====
   Reuses $, Spring, SPRING and mq from above. */
(() => {
  const EMAIL = '<a href="mailto:chika@pantay.org">chika@pantay.org</a>';
  const OUT = ' target="_blank" rel="noopener"';

  /* keys = words people might type; longer keys score higher */
  const KB = [
    { id: 'crisis', keys: ['suicide', 'kill myself', 'hurt myself', 'self-harm', 'self harm', 'being abused', 'in danger', 'not safe'],
      a: 'I’m sorry you’re going through this. I’m a simple assistant and can’t give crisis support. If you are in immediate danger, call 911. For mental health support in the Philippines, you can call the NCMH Crisis Hotline at 1553. You can also reach the PANTAY team at ' + EMAIL + '.' },
    { id: 'hi', keys: ['hello', 'hi', 'hey', 'kumusta', 'good morning', 'good afternoon'],
      a: 'Hi! I can answer questions about PANTAY, our programs, our impact, and how to get involved.' },
    { id: 'about', keys: ['what is pantay', 'who are you', 'who is pantay', 'about', 'organization', 'organisation', 'founded', 'established', 'history', '2016', 'mission', 'vision', 'values'],
      a: 'PANTAY was established in 2016 and became SEC-registered in 2022. It is a multi-awarded organization of young LGBTIQ+ individuals and allies advocating for gender equality, human rights, and inclusive democracy in the Philippines. Read more on the <a href="about.html">About page</a>.' },
    { id: 'impact', keys: ['impact', 'numbers', 'how many', 'results', 'reach', 'achievements', 'funding', 'funds', 'stats'],
      a: 'In 10 years, PANTAY has:<ul><li>Directly engaged 2,000+ young people</li><li>Worked with 50+ schools and universities</li><li>Trained 40 LGBTIQ+ elected officials through the POWER Fellows Network</li><li>Mobilized 356 volunteers and youth advocates</li><li>Mobilized PHP 70M+ in funding and support since 2022</li><li>Mobilized 100+ community organizations and supported 80+ through subgrants</li><li>Supported 20+ local governments</li><li>Engaged 20+ million people through digital campaigns</li></ul>See the <a href="impact.html">Impact page</a>.' },
    { id: 'programs', keys: ['program', 'programme', 'pillar', 'what do you do', 'what we do', 'campaign', 'advocacy', 'policy', 'sogie', 'equality for all', 'organizing', 'democracy'],
      a: 'PANTAY works on three pillars:<ul><li>SOGIESC national policy advocacy and local campaigns, including the Equality For All Campaign</li><li>Community organizing on education, economic, and health projects</li><li>Inclusive democracy, and queer political participation and empowerment</li></ul>See <a href="what-we-do.html">What We Do</a>.' },
    { id: 'geis', keys: ['geis', 'gender equality index', 'school', 'schools', 'student', 'rainbow report card', 'sucat', 'inclusive education'],
      a: 'GEIS is the Gender Equality Index in Schools, an initiative by PANTAY, Pride Philippines, and the Commission on Human Rights to craft an index for SOGIESC inclusion in Philippine academic institutions. With Sucat Senior High School, Project GEIS has strengthened the student handbook, reporting and referral mechanisms, gender-responsive facilities, and student participation. <a href="geis.html">Learn about GEIS</a>.' },
    { id: 'power', keys: ['power', 'fellows', 'elected', 'officials', 'politic', 'governance'],
      a: 'POWER! stands for Progressive Officials Working for Equality and Rights. It is the Philippines’ first, and Asia’s only, national network of local LGBTIQ+ elected officials, advancing gender-responsive legislation. The POWER Fellows Network has trained 40 officials on inclusive governance. <a href="power.html">Learn about POWER!</a>' },
    { id: 'volunteer', keys: ['volunteer', 'join', 'sumali', 'member', 'membership', 'apply', 'application', 'network'],
      a: 'You can join the PANTAY Network as an individual or as an organization. Apply here: <a href="https://tinyurl.com/PANTAYNetwork2627"' + OUT + '>tinyurl.com/PANTAYNetwork2627</a>. More details are on <a href="get-involved.html">Get Involved</a>.' },
    { id: 'donate', keys: ['donate', 'donation', 'give', 'support', 'partner', 'partnership', 'collaborate', 'sponsor'],
      a: 'You can donate or partner with us through <a href="get-involved.html">Get Involved</a>. For partnerships you can also email ' + EMAIL + '.' },
    { id: 'contact', keys: ['contact', 'email', 'phone', 'call', 'number', 'reach you', 'facebook', 'instagram', 'twitter', 'linkedin', 'social'],
      a: 'Email ' + EMAIL + ' or call <a href="tel:+63285594338">(02) 8559 4338</a>. Find us on <a href="https://www.facebook.com/PANTAYPilipinas"' + OUT + '>Facebook</a>, <a href="https://www.instagram.com/pantaytayo/"' + OUT + '>Instagram</a>, <a href="https://x.com/PANTAYtayo"' + OUT + '>X</a>, and <a href="https://www.linkedin.com/company/pantay-inc"' + OUT + '>LinkedIn</a>.' },
    { id: 'news', keys: ['news', 'media', 'press', 'article', 'featured', 'mention'],
      a: 'Recent media mentions:<ul><li><a href="https://www.gmanetwork.com/news/topstories/nation/949041/pantay-ink-partnership-to-advance-gender-equality-in-schools/story/"' + OUT + '>CHR, PANTAY ink partnership to advance gender equality in schools</a> (June 11, 2025)</li><li><a href="https://www.abs-cbn.com/news/nation/2025/12/22/youth-orgs-welcome-mrt-3-free-ride-for-lgbtqi-members-on-dec-22-1402"' + OUT + '>Youth orgs welcome MRT-3 free ride for LGBTQIA+ passengers</a> (Dec 22, 2025)</li><li><a href="https://tribune.net.ph/2026/02/14/free-condoms"' + OUT + '>Free Condoms</a> (Feb 14, 2026)</li></ul>' },
    { id: 'insights', keys: ['insight', 'empower', 'better funding', 'seedlings', 'forests', 'philanthropy', 'funder'],
      a: 'Our Executive Director Reden Raz co-wrote “From Seedlings to Forests: Rethinking Support for Youth-Led Organisations in Asia” (26 August 2026) with EMpower and Better Funding. <a href="https://wingswebmembers.org/from-seedlings-to-forests-rethinking-support-for-youth-led-organisations-in-asia/"' + OUT + '>Read it here</a>.' },
    { id: 'resources', keys: ['resource', 'research', 'werq', 'knowledge', 'tools', 'toolkit', 'publication', 'download', 'iec'],
      a: 'Our <a href="resources.html">Resources page</a> has Knowledge Products, WERQ Research, and Project GEIS Tools.' },
    { id: 'team', keys: ['team', 'people', 'leader', 'executive director', 'reden', 'convener', 'board', 'trustees', 'committee'],
      a: 'Reden Raz is the Executive Director of PANTAY. Meet the Management Committee, Executive Committee, and Board of Trustees on <a href="about.html#people">People of PANTAY</a>.' }
  ];
  const CHIPS = ['What is PANTAY?', 'Our impact', 'Programs', 'Volunteer', 'Donate or partner', 'Contact'];
  const FALLBACK = 'I don’t have an answer for that yet. Try one of the topics below, or email ' + EMAIL + ' and the team will reply.';
  const WELCOME = 'Ask about PANTAY, our programs, our impact, or how to get involved.';

  function find(q) {
    q = q.toLowerCase(); let best = null, top = 0;
    KB.forEach(e => {
      let s = 0;
      e.keys.forEach(k => {
        const hit = k.length <= 3 ? new RegExp('(^|\\W)' + k + '(\\W|$)').test(q) : q.includes(k);
        if (hit) s += k.length;
      });
      if (e.id === 'crisis' && s > 0) s += 1000;
      if (s > top) { top = s; best = e; }
    });
    return best;
  }

  const btn = $('apBtn'), panel = $('apPanel'), log = $('apLog'), chips = $('apChips'), form = $('apForm'), inp = $('apIn');
  if (!btn || !panel) return;
  let open = false, busy = false;

  /* panel open/close: interruptible spring that scales out of the launcher corner (same pattern as the cookie sheet) */
  const sp = new Spring(0, p => {
    panel.style.opacity = Math.min(1, p * 1.6);
    panel.style.transform = `translateY(${(1 - p) * 14}px) scale(${.88 + .12 * p})`;
    panel.style.visibility = p < .01 ? 'hidden' : 'visible';
  }, .001);
  sp.set(0);

  function add(cls, html, plain) {
    const d = document.createElement('div'); d.className = 'ap-msg ' + cls;
    if (plain) d.textContent = html; else d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true; add('me', q, true); inp.value = '';
    const t = add('bot typing', '<i></i><i></i><i></i>');
    const hit = find(q);
    setTimeout(() => { t.remove(); add('bot', hit ? hit.a : FALLBACK); busy = false; }, mq.matches ? 150 : 650);
  }
  function setOpen(v) {
    open = v; btn.setAttribute('aria-expanded', v);
    btn.setAttribute('aria-label', v ? 'Close Ask PANTAY chat' : 'Open Ask PANTAY chat');
    if (v) { sp.to(1, SPRING.default); setTimeout(() => inp.focus({ preventScroll: true }), 150); }
    else { sp.to(0, { ...SPRING.default, response: .3 }); btn.focus({ preventScroll: true }); }
  }
  btn.addEventListener('click', () => setOpen(!open));
  $('apClose').addEventListener('click', () => setOpen(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(inp.value); });

  add('bot', WELCOME);
  CHIPS.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ap-chip'; b.textContent = c;
    b.addEventListener('click', () => ask(c)); chips.appendChild(b);
  });

  /* If logo.png is missing, show a simple chat icon instead */
  document.querySelectorAll('.ap-logo').forEach(img => {
    const fb = img.nextElementSibling, bad = () => { img.hidden = true; if (fb) fb.hidden = false; };
    img.addEventListener('error', bad);
    if (img.complete && img.naturalWidth === 0) bad();
  });
})();