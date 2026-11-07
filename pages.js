/* ===== INNER PAGES: story filter + partner form. Loads after script.js ===== */
(() => {
  const chips = [...document.querySelectorAll('.filter [data-f]')];
  if (chips.length) {
    const groups = [...document.querySelectorAll('[data-cat]')];
    const apply = f => {
      groups.forEach(g => g.hidden = f !== 'all' && g.dataset.cat !== f);
      chips.forEach(c => c.setAttribute('aria-pressed', c.dataset.f === f));
    };
    chips.forEach(c => c.addEventListener('click', () => apply(c.dataset.f)));
    const h = location.hash.slice(1);
    apply(['impact', 'insights', 'news'].includes(h) ? h : 'all');
  }

  const pf = document.getElementById('pf');
  if (pf) {
    const g = id => document.getElementById(id);
    const rules = [
      ['pf-first', v => !!v, 'First name is required.'],
      ['pf-last', v => !!v, 'Last name is required.'],
      ['pf-email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Enter a valid email, for example name@example.com.'],
      ['pf-msg', v => !!v, 'Please write a message.']
    ];
    const check = ([id, ok, msg]) => {
      const el = g(id), good = ok(el.value.trim());
      el.setAttribute('aria-invalid', !good); g(id + 'e').textContent = good ? '' : msg; return good;
    };
    rules.forEach(r => { g(r[0]).addEventListener('blur', () => check(r)); g(r[0]).addEventListener('input', () => g(r[0]).getAttribute('aria-invalid') === 'true' && check(r)); });
    pf.addEventListener('submit', e => {
      e.preventDefault();
      const bad = rules.filter(r => !check(r)); if (bad.length) { g(bad[0][0]).focus(); return; }
      const name = g('pf-first').value.trim() + ' ' + g('pf-last').value.trim();
      const body = g('pf-msg').value.trim() + '\n\n' + name + '\n' + g('pf-email').value.trim();
      location.href = 'mailto:chika@pantay.org?subject=' + encodeURIComponent('Partnership inquiry from ' + name) + '&body=' + encodeURIComponent(body);
      g('pf-msgout').textContent = 'Your email app should open with the message ready to send to chika@pantay.org.';
    });
  }
})();