/* Site menu, shared by every page.
   Each page puts one <button data-menu-toggle class="sm-toggle">Menu</button> in its top-right corner
   and loads this file; the panel, scrim and preview are built here. The links are ordinary anchors,
   so each page's own scene-cut transition picks them up. */
(function () {
  'use strict';

  const PAGES = [
    { href: '/', label: 'Home', sub: 'Ace Burney' },
    // Work previews every project as a shuffling deck: list them here, separated by |
    { href: '/work', label: 'Work', sub: 'Selected work, built and shipped', preview: '/assets/work/partition/floor-1200.webp|/assets/work/omery/hero-1200.webp' },
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
    // The page's custom cursor must live outside the page: the menu slides and dims the page, which would
    // otherwise carry the cursor with it and draw it underneath the menu.
    const cursorEl = document.querySelector('[data-cursor]');
    if (cursorEl && cursorEl.parentNode !== document.body) document.body.appendChild(cursorEl);
    const { scrim, panel, peek } = build(host);
    const closeBtn = panel.querySelector('.sm-close');
    const rows = Array.from(panel.querySelectorAll('.sm-row'));
    const liveRows = rows.filter((r) => !r.hasAttribute('aria-current'));   // the current page's row is greyed out and skipped
    panel.querySelectorAll('.sm-row[aria-current]').forEach((r) => r.addEventListener('click', (e) => e.preventDefault()));
    let isOpen = false, hovering = false, lastFocus = null, cueBack = 0;
    const phone = matchMedia('(max-width: 640px)');

    // Close sits exactly where Menu is, so the same tap or click opens and closes the menu
    function placeClose() {
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

    // Opening the menu pushes the page out of its way: down beneath it on phones, left of the side panel
    // on desktop. The menu lives outside the page while this happens, so it doesn't get pushed along with it.
    const html = document.documentElement;
    const CRUNCH_MS = 640;
    let settleT = 0;
    function placeMenu() {
      if (panel.parentNode !== document.body) document.body.append(scrim, panel);
    }
    // Desktop: while the page narrows or widens, keep its sizes following its own width (--vw) and keep what you
    // were reading in the same place on screen, so the page re-lays itself out around you.
    let flowT = 0, anchor = null, anchorTop = 0;
    function pickAnchor() {
      anchor = null;
      const pe = scrim.style.pointerEvents; scrim.style.pointerEvents = 'none';   // look through the scrim to the page
      try { findAnchor(); } finally { scrim.style.pointerEvents = pe; }
    }
    function findAnchor() {
      const x = Math.min(innerWidth * 0.3, 400), ys = [0.35, 0.5, 0.2, 0.65];
      for (const f of ys) {
        let el = document.elementFromPoint(x, innerHeight * f);
        while (el && el !== document.body && el.offsetHeight > innerHeight * 0.6) el = el.firstElementChild;
        if (el && el !== document.body && host.contains(el)) { anchor = el; anchorTop = el.getBoundingClientRect().top; return; }
      }
    }
    function reflow(ms) {
      cancelAnimationFrame(flowT);
      const end = performance.now() + ms;
      const b = document.body;
      const step = () => {
        html.style.setProperty('--vw', (host.clientWidth / 100) + 'px');
        if (anchor && b.style.position === 'fixed') {
          const d = anchor.getBoundingClientRect().top - anchorTop;
          if (Math.abs(d) > 0.5) b.style.top = ((parseFloat(b.style.top) || 0) - d) + 'px';
        }
        if (performance.now() < end) flowT = requestAnimationFrame(step);
        else if (!isOpen) html.style.removeProperty('--vw');
      };
      step();
    }

    function crunch(on) {
      if (on) {
        html.style.setProperty('--sm-origin', lockedY + 'px');     // the top of the screen, in page coordinates
        html.style.setProperty('--sm-push', panel.offsetHeight + 'px');   // phones: down by the menu's height
        html.style.setProperty('--sm-shift', panel.offsetWidth + 'px');   // desktop: left by the panel's width
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
      if (open) { if (!phone.matches) pickAnchor(); lockScroll(true); crunch(true); if (!phone.matches) reflow(reduce ? 0 : 760); }
      else {
        crunch(false);
        if (!phone.matches) reflow(reduce ? 0 : 760);
        // let the page finish sliding back before releasing the scroll lock
        settleT = setTimeout(() => { lockScroll(false); html.classList.remove('sm-anim'); }, reduce ? 0 : CRUNCH_MS);
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

    // Following a link: the menu closes first (the page slides back into place), then the click goes on to the
    // page, which plays its own transition to the next page. Cmd/Ctrl/Shift-clicks open a new tab as usual.
    rows.forEach((r) => r.addEventListener('click', (e) => {
      if (r.hasAttribute('aria-current')) return;
      if (r.dataset.smGo) { delete r.dataset.smGo; return; }   // the replayed click: let the page handle it
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setTimeout(() => { r.dataset.smGo = '1'; r.click(); }, reduce ? 0 : (phone.matches ? 520 : 660));
    }));

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

    // preview beside the panel, level with the cursor. A row with several images (Work) shows them as a deck
    // that shuffles: the front card slides off and tucks in at the back.
    let deckT = 0;
    function hidePeek() { clearInterval(deckT); peek.classList.remove('on'); }
    function showPeek(src) {
      clearInterval(deckT);
      const list = src.split('|');
      peek.textContent = '';
      peek.classList.toggle('deck', list.length > 1);
      peek.style.backgroundImage = list.length > 1 ? 'none' : 'url("' + list[0] + '")';
      if (list.length > 1) {
        let order = list.map((u) => { const c = document.createElement('i'); c.className = 'sm-card'; c.style.backgroundImage = 'url("' + u + '")'; peek.appendChild(c); return c; });
        const lay = () => order.forEach((c, i) => {
          c.style.zIndex = String(order.length - i);
          c.style.transform = i === 0 ? 'none' : 'translate(' + (i * 18) + 'px,' + (-i * 14) + 'px) rotate(' + (i % 2 ? 5 : -4) + 'deg) scale(' + (1 - i * 0.05) + ')';
          c.style.filter = i === 0 ? 'none' : 'brightness(0.55)';
        });
        lay();
        if (!reduce) deckT = setInterval(() => {
          const front = order[0];
          front.style.transform = 'translate(-46%, 8%) rotate(-12deg)';
          setTimeout(() => { order = order.slice(1).concat(front); lay(); }, 280);
        }, 1500);
      }
      peek.classList.add('on');
    }
    if (finePointer) {
      const pos = { x: -400, y: -400 }, tgt = { x: -400, y: -400 };
      rows.forEach((r) => {
        const src = r.getAttribute('data-preview');
        r.addEventListener('mouseenter', () => { if (!src) { hidePeek(); return; } showPeek(src); });
        r.addEventListener('mouseleave', hidePeek);
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
