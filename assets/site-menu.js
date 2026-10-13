/* Site menu, shared by every page.
   Each page puts one <button data-menu-toggle class="sm-toggle">Menu</button> in its top-right corner
   and loads this file; the panel, scrim and preview are built here. The links are ordinary anchors,
   so each page's own scene-cut transition picks them up. */
(function () {
  'use strict';

  const PAGES = [
    { href: '/', label: 'Home', sub: 'Ace Burney' },
    { href: '/work', label: 'Work', sub: 'Selected work, built and shipped', preview: '/assets/work/partition/floor-1200.webp' },
    { href: '/about', label: 'Ascencion', sub: 'Product, systems, story', preview: '/assets/portrait.jpg' },
    { href: '/start', label: 'Start a Project', sub: 'A short guided brief →' },
  ];
  const SOCIAL = [
    ['Instagram', 'https://www.instagram.com/asxenxion/'],
    ['X', 'https://x.com/asxenxion'],
    ['LinkedIn', 'https://www.linkedin.com/in/aceburney/'],
    ['Vimeo', 'https://vimeo.com/aceburney'],
  ];
  const LABEL = 'MENU';
  const CUE = 'EXPLORE';           // what the button scrambles to, periodically
  const CUE_EVERY = 5200, CUE_HOLD = 1800;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function scramble(el, target, dur) {
    const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#·/-';
    clearInterval(el._smT);
    if (reduce) { el.textContent = target; return; }
    const frames = Math.max(8, Math.round((dur || 380) / 34));
    const q = Array.from(target, (to) => { const st = Math.floor(Math.random() * (frames / 3)); return { to, st, en: st + Math.floor(frames * (0.4 + Math.random() * 0.5)), ch: '' }; });
    let f = 0;
    el._smT = setInterval(() => {
      let out = '', done = 0;
      for (const x of q) {
        if (f >= x.en) { done++; out += x.to; }
        else if (f >= x.st) { if (!x.ch || Math.random() < 0.35) x.ch = pool[(Math.random() * pool.length) | 0]; out += x.ch; }
        else out += ' ';
      }
      el.textContent = out; f++;
      if (done >= q.length) { el.textContent = target; clearInterval(el._smT); }
    }, 34);
  }

  const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  // Exact page only: on a case study (/work/partition) the Work link stays live, as the way back to the list
  const isHere = (href) => (href === '/' ? here === '/' || here === '/index' : here === href || here === href + '/index');

  function build(host) {
    const scrim = document.createElement('div');
    scrim.className = 'sm-scrim';
    scrim.setAttribute('aria-hidden', 'true');

    const panel = document.createElement('nav');
    panel.className = 'sm-panel';
    panel.id = 'site-menu';
    panel.setAttribute('aria-label', 'Site menu');
    panel.setAttribute('aria-hidden', 'true');
    const rows = PAGES.map((p, i) => `
        <li><a href="${p.href}" class="sm-row"${p.preview ? ` data-preview="${p.preview}"` : ''}${isHere(p.href) ? ' aria-current="page" aria-disabled="true" tabindex="-1"' : ''}>
          <span class="sm-n">0${i + 1}</span><span class="sm-label" data-label="${p.label}">${p.label}</span><span class="sm-sub">${p.sub}</span>
        </a></li>`).join('');
    const social = SOCIAL.map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`).join('');
    panel.innerHTML = `
      <div class="sm-inner">
        <div class="sm-head"><span>Menu</span><button type="button" class="sm-close" aria-label="Close the menu">Close <span aria-hidden="true">×</span></button></div>
        <ol class="sm-list">${rows}</ol>
        <div class="sm-foot">
          <a href="https://omery.studio" target="_blank" rel="noopener">Omery ↗</a>
          <span class="sm-social">${social}</span>
        </div>
      </div>`;

    const peek = document.createElement('div');
    peek.className = 'sm-peek';
    peek.setAttribute('aria-hidden', 'true');

    host.append(scrim, panel, peek);
    return { scrim, panel, peek };
  }

  function init() {
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!toggle) return;
    const host = document.querySelector('[data-root]') || document.body;
    const { scrim, panel, peek } = build(host);
    const closeBtn = panel.querySelector('.sm-close');
    const rows = Array.from(panel.querySelectorAll('.sm-row'));
    const liveRows = rows.filter((r) => !r.hasAttribute('aria-current'));   // the current page's row is greyed out and skipped
    panel.querySelectorAll('.sm-row[aria-current]').forEach((r) => r.addEventListener('click', (e) => e.preventDefault()));
    let isOpen = false, hovering = false, lastFocus = null, cueBack = 0;
    const phone = matchMedia('(max-width: 640px)');

    // Phones: Close sits exactly where Menu is, so the same thumb tap opens and closes the menu
    function placeClose() {
      if (!phone.matches) { closeBtn.style.top = closeBtn.style.right = ''; panel.style.removeProperty('--sm-top'); return; }
      const r = toggle.getBoundingClientRect();
      const mid = Math.round(r.top + r.height / 2);
      panel.style.setProperty('--sm-top', mid + 'px');   // header centre line = the button's
      closeBtn.style.top = mid + 'px';
      closeBtn.style.right = Math.round(innerWidth - r.right) + 'px';
    }

    // The page behind stays still while the menu is open (iOS needs the body pinned in place)
    let lockedY = 0;
    function lockScroll(lock) {
      const b = document.body;
      if (lock) {
        lockedY = scrollY;
        Object.assign(b.style, { position: 'fixed', top: -lockedY + 'px', left: '0', right: '0', width: '100%' });
      } else if (b.style.position === 'fixed') {
        Object.assign(b.style, { position: '', top: '', left: '', right: '', width: '' });
        scrollTo(0, lockedY);
      }
    }

    toggle.textContent = LABEL;
    toggle.setAttribute('aria-controls', 'site-menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open the menu');

    // Phones: the menu drops from the top and the page is pushed down beneath it, shrinking back like a card.
    // The menu lives outside the page while this happens, so it doesn't get pushed along with it.
    const html = document.documentElement;
    const CRUNCH_MS = 500;
    let settleT = 0;
    function placeMenu() {
      const target = phone.matches ? document.body : host;
      if (panel.parentNode !== target) target.append(scrim, panel);
    }
    function crunch(on) {
      if (on) {
        html.style.setProperty('--sm-origin', lockedY + 'px');     // the top of the screen, in page coordinates
        html.style.setProperty('--sm-push', panel.offsetHeight + 'px');
        html.classList.add('sm-anim');
        void html.offsetWidth;                                     // start from the resting state
        html.classList.add('sm-crunch');
      } else {
        html.classList.remove('sm-crunch');
      }
    }

    function setOpen(open) {
      isOpen = open;
      clearTimeout(cueBack);
      clearTimeout(settleT);
      toggle.classList.remove('sm-cue');
      if (toggle.textContent !== LABEL) scramble(toggle, LABEL, 260);
      placeMenu();
      if (open) placeClose();
      // clear any half-finished swipe (when closing, a frame later, so it carries on from where the finger let go)
      scrim.style.opacity = ''; html.classList.remove('sm-drag');
      if (open) panel.style.transform = ''; else requestAnimationFrame(() => { panel.style.transform = ''; });
      panel.classList.toggle('open', open);
      scrim.classList.toggle('open', open);
      html.classList.toggle('sm-open', open);
      if (phone.matches) {
        if (open) { lockScroll(true); crunch(true); }
        else {
          crunch(false);
          // let the page finish sliding back before releasing the scroll lock
          settleT = setTimeout(() => { lockScroll(false); html.classList.remove('sm-anim'); }, reduce ? 0 : CRUNCH_MS);
        }
      } else {
        lockScroll(open);
      }
      if (open && phone.matches && navigator.vibrate) navigator.vibrate(8);   // Android only; iOS ignores it
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu');
      if (open) {
        lastFocus = document.activeElement;
        rows.forEach((r, i) => { const l = r.querySelector('.sm-label'); setTimeout(() => scramble(l, l.dataset.label.toUpperCase(), 360), 240 + i * 80); });
        setTimeout(() => liveRows[0] && liveRows[0].focus({ preventScroll: true }), reduce ? 0 : 420);
      } else {
        peek.classList.remove('on');
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener('click', () => setOpen(!isOpen));
    closeBtn.addEventListener('click', () => setOpen(false));
    scrim.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'Tab') {   // keep focus inside the menu while it is open
        const items = [toggle].concat(Array.from(panel.querySelectorAll('button, a:not([aria-current])')));
        const i = items.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
        e.preventDefault(); items[next].focus();
      }
    });
    // back/forward cache: never come back with the menu open
    addEventListener('pageshow', (e) => { if (e.persisted && isOpen) setOpen(false); });
    addEventListener('resize', () => { if (isOpen) placeClose(); });

    // Phones: tapping a link snaps the page back at once, so the page transition plays full screen
    rows.forEach((r) => r.addEventListener('click', () => { if (phone.matches && !r.hasAttribute('aria-current')) html.classList.remove('sm-anim', 'sm-crunch'); }));

    // Phones: swipe the menu up to close. It follows the finger (the page rises with it), then closes or springs back.
    let startY = 0, startX = 0, startT = 0, travel = 0, dragging = null;
    panel.addEventListener('touchstart', (e) => {
      if (!isOpen || !phone.matches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; startT = performance.now(); travel = 0; dragging = null;
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      if (!isOpen || !phone.matches || dragging === false) return;
      const mx = e.touches[0].clientX - startX, my = e.touches[0].clientY - startY;
      if (dragging === null) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        dragging = my < 0 && Math.abs(my) > Math.abs(mx);   // only an upward, mostly-vertical swipe
        if (!dragging) return;
        panel.classList.add('sm-dragging');
        html.classList.add('sm-drag');
      }
      travel = Math.max(0, -my);
      panel.style.transform = 'translateY(' + (-travel) + 'px)';
      html.style.setProperty('--sm-push', Math.max(0, panel.offsetHeight - travel) + 'px');
    }, { passive: true });
    panel.addEventListener('touchend', () => {
      if (!dragging) { dragging = null; return; }
      panel.classList.remove('sm-dragging');
      html.classList.remove('sm-drag');
      const fast = travel / (performance.now() - startT) > 0.5;   // a quick flick closes even if short
      dragging = null;
      if (travel > panel.offsetHeight * 0.25 || (fast && travel > 40)) setOpen(false);
      else { panel.style.transform = ''; html.style.setProperty('--sm-push', panel.offsetHeight + 'px'); }
    });

    // Menu -> Explore -> Menu, every few seconds, while nobody is using it
    toggle.addEventListener('mouseenter', () => { hovering = true; clearTimeout(cueBack); toggle.classList.remove('sm-cue'); if (toggle.textContent !== LABEL) scramble(toggle, LABEL, 260); });
    toggle.addEventListener('mouseleave', () => { hovering = false; });
    if (!reduce) {
      setInterval(() => {
        if (isOpen || hovering || document.hidden) return;
        toggle.classList.add('sm-cue');
        scramble(toggle, CUE);
        cueBack = setTimeout(() => { toggle.classList.remove('sm-cue'); if (!isOpen && !hovering) scramble(toggle, LABEL); }, CUE_HOLD);
      }, CUE_EVERY);
    }

    // preview beside the panel, level with the cursor
    if (finePointer) {
      const pos = { x: -400, y: -400 }, tgt = { x: -400, y: -400 };
      rows.forEach((r) => {
        const src = r.getAttribute('data-preview');
        r.addEventListener('mouseenter', () => { if (!src) { peek.classList.remove('on'); return; } peek.style.backgroundImage = 'url("' + src + '")'; peek.classList.add('on'); });
        r.addEventListener('mouseleave', () => peek.classList.remove('on'));
      });
      addEventListener('mousemove', (e) => { tgt.x = panel.getBoundingClientRect().left - 180; tgt.y = e.clientY; });
      const loop = () => {
        if (peek.classList.contains('on')) { pos.x += (tgt.x - pos.x) * 0.14; pos.y += (tgt.y - pos.y) * 0.14; peek.style.left = pos.x.toFixed(1) + 'px'; peek.style.top = pos.y.toFixed(1) + 'px'; }
        else { pos.x = tgt.x; pos.y = tgt.y; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  // shared footer: the Omery label scrambles in place on hover (whichever label is showing)
  function initFooter() {
    const omery = document.querySelector('.site-foot-omery');
    if (!omery) return;
    omery.addEventListener('mouseenter', () => {
      omery.querySelectorAll('.sf-full, .sf-short').forEach((s) => { if (s.offsetParent !== null) scramble(s, s.textContent.trim(), 260); });
    });
  }

  const boot = () => { init(); initFooter(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
