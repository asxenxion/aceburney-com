// A case study's thinking as a map in space (styles: /assets/thoughtmap.css).
// The source is a plain list in the page: one core idea, then stages, each with the small thoughts
// around it. Scrolling drives one timeline: the map builds itself out of dust, a camera flies through
// the core and each stage in turn, every stage plays out as you land on it (notes type in, dropped
// ideas fall away, rules lock), and at the end everything pulls back into the line in the middle.
// The overview can be dragged to look around. Clicking a stage scrolls to it, so scroll and click
// always agree. Reduced motion and no-script get the plain list.
(() => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const LOWER = 'abcdefghijklmnopqrstuvwxyz'
  const still = matchMedia('(prefers-reduced-motion: reduce)')
  const narrow = matchMedia('(max-width: 860px)')
  const fine = matchMedia('(hover: hover) and (pointer: fine)')
  const KIND = { ask: 'Asked', tried: 'Tried', cut: 'Dropped', rule: 'Rule', made: 'Made' }
  const TALLY = [['ask', 'Asked'], ['tried', 'Tried'], ['cut', 'Dropped'], ['rule', 'Rules']]
  const PERSPECTIVE = 1100
  const SEG = 0.85 // screens of scroll per camera move

  const smooth = (t) => t * t * (3 - 2 * t)
  const lerp = (a, b, t) => a + (b - a) * t
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) })

  // letters settle one by one into place; spaces and punctuation hold still so the shape reads early
  function scramble(el, dur) {
    const target = el.dataset.word ?? (el.dataset.word = el.textContent)
    const len = target.length
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (dur || 380))
      const keep = Math.floor(t * len)
      let out = target.slice(0, keep)
      for (let i = keep; i < len; i++) {
        const c = target[i]
        out += /[a-z]/.test(c) ? LOWER[(Math.random() * 26) | 0] : /[A-Z]/.test(c) ? CHARS[(Math.random() * 26) | 0] : c
      }
      el.textContent = out
      if (t < 1) requestAnimationFrame(tick)
      else el.textContent = target
    }
    requestAnimationFrame(tick)
  }

  // a 1px line from a to b: a flat ribbon turned to point along the segment, with an inner stroke
  // that can be drawn on from its start
  function line(a, b, cls) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
    const len = Math.hypot(dx, dy, dz) || 1
    const el = document.createElement('i')
    el.className = cls
    el.style.width = `${len.toFixed(1)}px`
    el.style.transform = `translate3d(${a.x}px,${a.y}px,${a.z}px) rotateZ(${Math.atan2(dy, dx)}rad) rotateY(${Math.asin(-dz / len)}rad)`
    el.append(document.createElement('b'))
    return el
  }

  // seeded so the map lands the same way every visit
  function rng(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  }

  function init(map) {
    const source = map.querySelector('.tmap-source')
    const pin = map.querySelector('.tmap-pin')
    const view = map.querySelector('.tmap-view')
    const world = map.querySelector('.tmap-world')
    const tabsRow = map.querySelector('.tmap-tabs')
    const skip = map.querySelector('.tmap-skip')
    const cap = {
      n: map.querySelector('.tmap-cap-n'), when: map.querySelector('.tmap-cap-when'),
      verb: map.querySelector('.tmap-cap-verb'), what: map.querySelector('.tmap-cap-what'),
    }
    const coreItem = source.querySelector('.tmap-core')
    const stageItems = [...source.querySelectorAll('.tmap-stage')]
    const coreWord = coreItem.querySelector('h3').textContent.trim()

    // what holds still over the map: the running tally and the drag hint
    const tally = document.createElement('div')
    tally.className = 'tmap-tally'
    tally.setAttribute('aria-hidden', 'true')
    tally.innerHTML = TALLY.map(([k, label]) => `<span data-k="${k}"><b>00</b>${label}</span>`).join('')
    const hint = document.createElement('div')
    hint.className = 'tmap-drag'
    hint.setAttribute('aria-hidden', 'true')
    hint.innerHTML = '<i></i>Drag to look around'
    const cue = document.createElement('div')
    cue.className = 'tmap-cue'
    cue.setAttribute('aria-hidden', 'true')
    cue.innerHTML = `<i></i>${map.dataset.cue || 'Scroll to grow the map'}`
    pin.append(tally, hint, cue)

    let nodes = [], dust = [], stops = [], tabs = [], stageThoughts = [], trunks = []
    let core = null, coreNode = null
    let cam = null, inView = false, running = false, queued = false
    let active = -1, arrived = -1, last = { a: -1, c: -1 }
    const played = new Set()
    const lean = { x: 0, y: 0, tx: 0, ty: 0 }
    // the map builds itself on a timer the first time the section comes into view, and while it is
    // seen whole it keeps turning slowly on its own, so it reads as a map before anyone scrolls
    const intro = { a: 0, start: 0 }
    const idle = { t: 0, last: 0 }
    const orbit = { x: 0, y: 0, tx: 0, ty: 0, drag: null }
    const pointer = { x: 0, y: 0, on: false, t: 0 }

    const at = (n, p) => { n.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,${p.z.toFixed(1)}px) translate(-50%,-50%)` }
    const placeDust = (s, p) => { s.el.style.transform = `translate3d(${(p.x + s.ox).toFixed(1)}px,${(p.y + s.oy).toFixed(1)}px,${p.z.toFixed(0)}px)` }

    function node(cls, html, p, stage, extra) {
      const el = document.createElement(extra?.button ? 'button' : 'div')
      if (extra?.button) el.type = 'button'
      el.className = `tmap-node ${cls}`
      el.innerHTML = `<div class="tmap-in">${html}</div>`
      const n = { el, home: p, cur: p, stage, dim: 1, ...extra }
      at(n, p)
      nodes.push(n)
      return n
    }

    function build() {
      world.textContent = ''
      tabsRow.textContent = ''
      nodes = []; dust = []; stageThoughts = []
      active = -1; arrived = -1; last = { a: -1, c: -1 }
      played.clear()
      const k = narrow.matches ? 0.62 : 1
      const R = { x: 980 * k, y: 600 * k }
      const frag = document.createDocumentFragment()
      const rand = rng(7), tilt = rng(31)

      // dust: drifts on its own (CSS), swirls in as the map builds, parts around the cursor,
      // and is pulled into the middle at the end
      for (let i = 0; i < (narrow.matches ? 60 : 150); i++) {
        const el = document.createElement('i')
        el.className = `tmap-dust${i % 7 === 0 ? ' is-bright' : ''}`
        const home = { x: (rand() - 0.5) * 4200 * k, y: (rand() - 0.5) * 2600 * k, z: (rand() - 0.5) * 2400 }
        // where it starts: further out and turned partway round, so building reads as a swirl
        const ang = (0.5 + rand() * 0.8) * (i % 2 ? 1 : -1), far = 1.25 + rand() * 0.6
        const from = { x: (home.x * Math.cos(ang) - home.z * Math.sin(ang)) * far, y: home.y * far, z: (home.x * Math.sin(ang) + home.z * Math.cos(ang)) * far }
        el.style.setProperty('--dx', `${((rand() - 0.5) * 60).toFixed(0)}px`)
        el.style.setProperty('--dy', `${((rand() - 0.5) * 40).toFixed(0)}px`)
        el.style.animationDuration = `${(14 + rand() * 18).toFixed(1)}s`
        el.style.animationDelay = `${(-rand() * 30).toFixed(1)}s`
        const s = { el, home, from, cur: home, ox: 0, oy: 0, vx: 0, vy: 0 }
        placeDust(s, home)
        dust.push(s)
        frag.append(el)
      }

      core = { x: 0, y: 0, z: 0 }
      coreNode = node('tmap-node-core', `<span class="tmap-k">The idea</span><b>${coreItem.querySelector('h3').innerHTML}</b>`, core, -1, { appear: 0 })
      frag.append(coreNode.el)

      const threads = {}
      stageItems.forEach((item, i) => {
        const a = -Math.PI / 2 + (i / stageItems.length) * Math.PI * 2
        const hubP = { x: Math.cos(a) * R.x, y: Math.sin(a) * R.y, z: Math.sin(i * 1.9) * 380 * k }
        const verb = item.querySelector('h3').textContent.trim()
        const n = String(i + 1).padStart(2, '0')

        // a spark runs out along each trunk in turn, round the ring, while the map is seen whole
        const trunk = line(core, hubP, 'tmap-line tmap-line-trunk')
        trunk.style.setProperty('--d', `${(i * 0.6).toFixed(1)}s`)
        trunk.append(document.createElement('s'))
        trunks[i] = trunk
        frag.append(trunk)
        const hub = node('tmap-node-hub', `<span class="tmap-k">${n} &middot; ${item.dataset.when || ''}</span><b>${verb}</b>`, hubP, i, { button: true, appear: 0.42 + i * 0.035 })
        hub.el.setAttribute('aria-label', `${verb}, stage ${i + 1}. Go to stage`)
        hub.el.style.setProperty('--d', `${(i * 0.6).toFixed(1)}s`)
        hub.el.style.setProperty('--tilt', `${((i % 2 ? 1 : -1) * (0.8 + tilt() * 1.2)).toFixed(2)}deg`)
        hub.el.addEventListener('click', () => go(stageStop(i)))
        frag.append(hub.el)

        const thoughts = [...item.querySelectorAll('li')]
        const mine = []
        thoughts.forEach((t, j) => {
          // the thoughts fan outward, away from the core, so each stage reads as its own cluster
          const u = thoughts.length > 1 ? j / (thoughts.length - 1) - 0.5 : 0
          const b = a + u * 2.5
          const r = (330 + (j % 2) * 150) * k
          const p = { x: hubP.x + Math.cos(b) * r * 1.35, y: hubP.y + Math.sin(b) * r * 0.85, z: hubP.z + ((j % 3) - 1) * 110 * k }
          frag.append(line(hubP, p, 'tmap-line tmap-line-branch'))
          const kind = t.dataset.kind || 'made'
          const th = node(`tmap-node-thought is-${kind}`, `<span class="tmap-k">${KIND[kind] || kind}</span><span class="tmap-t">${t.textContent.trim()}</span>`, p, i, { kind, appear: 0.6 + i * 0.03 + j * 0.008 })
          // each note rests a little crooked, like the memo on the page, and squares up when its stage is on
          th.el.style.setProperty('--tilt', `${((j % 2 ? 1 : -1) * (1.2 + tilt() * 2.4)).toFixed(2)}deg`)
          frag.append(th.el)
          mine.push(th)
          if (t.dataset.thread) {
            th.el.dataset.thread = t.dataset.thread
            ;(threads[t.dataset.thread] ||= []).push(th)
          }
        })
        stageThoughts.push(mine)

        const tab = document.createElement('button')
        tab.type = 'button'
        tab.className = 'tmap-tab'
        tab.innerHTML = `<span class="tmap-tab-n">${n}</span><span class="tmap-tab-v">${verb}</span><span class="sr-only"> (go to stage)</span>`
        tab.addEventListener('click', () => go(stageStop(i)))
        tabsRow.append(tab)
      })
      tabs = [...tabsRow.children]
      tabsRow.style.setProperty('--n', stageItems.length)

      // threads: the same idea turning up in more than one stage, joined across the map;
      // hovering one lights the whole thread and says how often the idea came back
      Object.entries(threads).forEach(([name, list]) => {
        const stagesIn = new Set(list.map((x) => x.stage)).size
        const label = map.dataset[`thread${name[0].toUpperCase()}${name.slice(1)}`] || 'This idea'
        for (let i = 1; i < list.length; i++) {
          const l = line(list[i - 1].home, list[i].home, 'tmap-line tmap-line-thread')
          l.dataset.thread = name
          frag.append(l)
        }
        list.forEach(({ el }) => {
          const echo = document.createElement('span')
          echo.className = 'tmap-echo'
          echo.textContent = `${label} · comes back in ${stagesIn} stages`
          el.firstChild.append(echo)
          el.addEventListener('pointerenter', () => lightThread(name))
          el.addEventListener('pointerleave', () => lightThread(null))
        })
      })
      world.append(frag)

      // camera stops: the map building, the whole map, the core, each stage, the whole map from
      // another side, then the finale back at the core
      if (isDeck()) {
        const box = view.getBoundingClientRect()
        const fit = Math.min(box.width / 1600, box.height / 1100) // the ring and stage names fill the box; the outer notes may run off its edges
        const whole = { p: core, d: PERSPECTIVE / fit - PERSPECTIVE, yaw: -10, pitch: 12, kind: 'open' }
        stops = [whole, whole]
        return
      }
      const far = 2700
      stops = [
        { p: core, d: far, yaw: -14, pitch: 14, kind: 'open' },
        { p: core, d: narrow.matches ? 700 : 120, yaw: 0, pitch: 0, kind: 'core' },
        ...stageItems.map((item, i) => {
          const h = nodes.find((x) => x.stage === i).home
          if (narrow.matches) return { p: { x: h.x, y: h.y - 20, z: h.z }, d: 120, yaw: 0, pitch: 0, kind: 'stage', i }
          // stand a little out from the hub so its thoughts are in frame, leaning toward them
          return { p: { x: h.x * 1.22, y: h.y * 1.22, z: h.z }, d: 430, yaw: clamp(h.x / R.x, -1, 1) * 9, pitch: clamp(-h.y / R.y, -1, 1) * 7, kind: 'stage', i }
        }),
        { p: core, d: far + 300, yaw: 18, pitch: 22, kind: 'close' },
        { p: core, d: narrow.matches ? 1300 : 900, yaw: 0, pitch: 0, kind: 'finale' },
      ]
    }

    const stageStop = (i) => i + 2
    const top = () => map.getBoundingClientRect().top + scrollY
    const span = () => map.offsetHeight - innerHeight
    const segs = () => stops.length - 1
    const isOverview = (s) => s.kind === 'open' || s.kind === 'close'

    function measure() {
      const flat = still.matches
      map.classList.toggle('is-flat', flat)
      map.classList.toggle('is-deep', !narrow.matches)
      map.classList.toggle('is-deck', narrow.matches && !flat)
      if (flat) { map.style.height = ''; removeDeck(); return }
      build()
      cam = null
      if (isDeck()) {
        map.style.height = ''
        buildDeck()
        setActive(0)
        sel = -1
        select(0)
      } else {
        removeDeck()
        map.style.height = `${innerHeight * (1 + segs() * SEG)}px`
        setActive(Math.round(target()))
      }
      queue()
    }

    // ----- phones: the map is too small to read there, so the stages are a deck of cards you swipe through -----
    const isDeck = () => map.classList.contains('is-deck')
    let deckEl = null, track = null, cards = [], sel = -1
    const seen = new Set()
    const pad = (n) => String(n).padStart(2, '0')
    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 1)

    const eyebrow = map.querySelector('.tmap-head .eyebrow')
    const eyebrowMap = eyebrow?.innerHTML
    function removeDeck() {
      if (eyebrow) eyebrow.innerHTML = eyebrowMap
      if (!deckEl) return
      deckEl.remove(); deckEl = null; track = null; cards = []
      pin.append(tally)
    }

    function buildDeck() {
      removeDeck()
      seen.clear()
      deckEl = document.createElement('div')
      deckEl.className = 'tmap-deckwrap'
      deckEl.setAttribute('aria-hidden', 'true') // the list above carries the same words for screen readers
      const total = stageItems.length + 2
      deckEl.innerHTML = `<div class="tmap-deckbar"><span class="tmap-deck-n">01 / ${pad(total)}</span><i class="tmap-deck-line"></i><span class="tmap-swipe">Swipe <b>&rarr;</b></span></div><div class="tmap-deck"></div>`
      track = deckEl.querySelector('.tmap-deck')
      // a still slot does the snapping; the card inside it is what turns (snapping to a turned box drifts)
      const card = (cls, html) => {
        const slot = document.createElement('div')
        slot.className = 'tmap-slot'
        const el = document.createElement('article')
        el.className = `tmap-card ${cls}`
        el.innerHTML = html
        slot.append(el)
        track.append(slot)
        return slot
      }
      // each card is a memo, like the brief on the case studies: a header over a heavy rule, a title, then the rows
      // the whole journey in one line, for the last card
      const summary = () => {
        const n = {}
        source.querySelectorAll('.tmap-stage li').forEach((li) => { n[li.dataset.kind] = (n[li.dataset.kind] || 0) + 1 })
        return TALLY.map(([kk, label]) => `<b>${pad(n[kk] || 0)}</b> ${label}`).join('<i>&middot;</i>')
      }
      const head = (l, r) => `<div class="tmap-card-head"><span>${l}</span><span>${r}</span></div>`
      card('is-core', `${head('The idea', `00 / ${pad(total - 2)}`)}<h3 class="tmap-card-v">${coreWord}</h3><span class="tmap-card-mark" aria-hidden="true">00<em>.</em></span><p>${coreItem.querySelector('p')?.innerHTML || ''}</p>`)
      stageItems.forEach((item, i) => {
        const notes = [...item.querySelectorAll('li')].map((li) => {
          const kind = li.dataset.kind || 'made'
          return `<li class="is-${kind}"><span class="tmap-card-kind">${KIND[kind] || kind}</span><span class="tmap-card-t">${li.textContent.trim()}</span></li>`
        }).join('')
        card('is-stage', `${head(`Stage ${pad(i + 1)}`, item.dataset.when || '')}<h3 class="tmap-card-v">${item.querySelector('h3').textContent.trim()}<em>.</em></h3><p>${item.querySelector(':scope > p')?.innerHTML || ''}</p><ul>${notes}</ul>`)
      })
      card('is-finale', `${head(map.dataset.deckEnd || 'Where it ends', 'The test')}<h3 class="tmap-card-v">${coreWord}</h3><span class="tmap-card-mark" aria-hidden="true">End<em>.</em></span><span class="tmap-card-sum">${summary()}</span><p>${map.dataset.deckFinaleLine || map.dataset.finaleLine || ''}</p>`)
      cards = [...track.children]
      deckEl.prepend(tally)
      // every card the same size: the tallest one sets it (short cards lay their words out to fill it)
      requestAnimationFrame(() => {
        const tallest = Math.max(...cards.map((c) => c.firstChild.scrollHeight))
        deckEl.style.setProperty('--card-h', `${tallest}px`)
        spin()
      })
      pin.append(deckEl)
      if (eyebrow && map.dataset.deckEyebrow) eyebrow.innerHTML = map.dataset.deckEyebrow
      let qd = false
      track.addEventListener('scroll', () => {
        if (qd) return
        qd = true
        requestAnimationFrame(() => { qd = false; spin(); select(clamp(Math.round(track.scrollLeft / step()), 0, cards.length - 1)) })
      }, { passive: true })
      cards.forEach((c, k) => c.addEventListener('click', () => { if (k !== sel) track.scrollTo({ left: step() * k, behavior: 'smooth' }) }))
    }

    // the carousel: each card turns away and sinks back the further it sits from the middle,
    // so the deck reads as a ring of cards coming round as you swipe
    function spin() {
      if (!track) return
      const mid = track.scrollLeft + track.clientWidth / 2, st = step()
      cards.forEach((c) => {
        const d = clamp((c.offsetLeft + c.offsetWidth / 2 - mid) / st, -3, 3)
        const a = Math.abs(d)
        const el = c.firstChild
        el.style.transform = `translateX(${(-d * 18).toFixed(1)}%) translateZ(${(-a * 180).toFixed(0)}px) rotateY(${(-d * 42).toFixed(1)}deg)`
        el.style.opacity = (1 - Math.min(a, 2) * 0.4).toFixed(2)
        c.style.zIndex = String(10 - Math.round(a * 3))
      })
    }

    // a card coming to rest lights its stage on the map, sends a spark out to it, and plays the stage
    function select(k) {
      if (k === sel || !cards.length) return
      sel = k
      const last = cards.length - 1
      const i = k >= 1 && k < last ? k - 1 : -1 // stage index, if this card is a stage
      cards.forEach((c, n) => c.firstChild.classList.toggle('on', n === k))
      deckEl.querySelector('.tmap-deck-n').textContent = `${pad(k + 1)} / ${pad(cards.length)}`
      deckEl.style.setProperty('--p', (k / last).toFixed(3))
      deckEl.classList.toggle('moved', k > 0)
      nodes.forEach((n) => {
        const on = k === last || (i >= 0 ? n.stage === i : n.stage === -1)
        n.el.classList.toggle('on', on)
        n.dim = on || k === last ? 1 : i >= 0 && n.stage === -1 ? 0.5 : 0.42
      })
      trunks.forEach((t, n) => t.classList.toggle('sel', n === i))
      map.classList.toggle('is-gathered', k === last)
      setTally(i >= 0 ? i : k === last ? stageItems.length : -1)
      if (cam?.pose) render()
      if (i >= 0) setTimeout(() => { if (sel === k) playCard(k) }, 280)
    }

    // on a phone the swipe is motion enough: no typing, just the dropped ideas struck through
    // and faded, and the rules locking. What was cut stays cut.
    function playCard(k) {
      const first = !seen.has(k)
      seen.add(k)
      cards[k].querySelectorAll('li').forEach((li, j) => {
        setTimeout(() => {
          if (sel !== k) return
          if (li.classList.contains('is-cut') && first) {
            setTimeout(() => li.classList.add('is-struck'), 600)
            setTimeout(() => li.classList.add('is-gone'), 1300)
          }
          if (li.classList.contains('is-rule')) {
            li.classList.remove('is-locked'); void li.offsetWidth
            setTimeout(() => li.classList.add('is-locked'), 550)
          }
        }, j * 130)
      })
    }

    // the scroll position as a point on the timeline: 0 is the map building, segs() is the finale
    function target() {
      if (isDeck()) return 0 // on a phone the cards drive the map, not the page scroll
      const s = span()
      return s > 0 ? clamp((scrollY - top()) / s, 0, 1) * segs() : 0
    }

    // the camera for a point on the timeline: it holds at each stop, then flies to the next, pulling
    // back mid-flight between stages so you see where you came from and where you're going
    function pose(p) {
      const i = Math.min(Math.floor(p), segs() - 1)
      const f = smooth(clamp((p - i - 0.2) / 0.6, 0, 1))
      const A = stops[i], B = stops[i + 1]
      const lift = A.kind === 'stage' && B.kind === 'stage' ? Math.sin(f * Math.PI) * (narrow.matches ? 900 : 520) : 0
      const w = lerp(isOverview(A) ? 1 : 0, isOverview(B) ? 1 : 0, f) // how much of this is an overview, for dragging
      return {
        ...mix(A.p, B.p, f), d: lerp(A.d, B.d, f) + lift,
        yaw: lerp(A.yaw, B.yaw, f) + lean.x * 2.4 + (orbit.x + Math.sin(idle.t / 5200) * 16) * w,
        pitch: lerp(A.pitch, B.pitch, f) + lean.y * 1.8 + (orbit.y + Math.sin(idle.t / 7300) * 5) * w, w,
      }
    }

    // build-in and finale: a is how built the map is, c how far it has pulled into the core
    function layout(p) {
      const a = intro.a
      const c = smooth(clamp((p - (segs() - 1) - 0.15) / 0.7, 0, 1))
      if (Math.abs(a - last.a) < 0.002 && Math.abs(c - last.c) < 0.002) return
      last = { a, c }
      // lines draw on from the middle out: trunks, then branches, then the threads between stages
      world.style.setProperty('--draw-trunk', (clamp((a - 0.32) / 0.25, 0, 1) * (1 - c)).toFixed(3))
      world.style.setProperty('--draw-branch', (clamp((a - 0.55) / 0.3, 0, 1) * (1 - c)).toFixed(3))
      world.style.setProperty('--draw-thread', (clamp((a - 0.85) / 0.15, 0, 1) * (1 - c)).toFixed(3))
      for (const n of nodes) {
        n.el.classList.toggle('is-in', a >= n.appear)
        if (n === coreNode) continue
        if (c > 0 || n.cur !== n.home) {
          n.cur = c > 0 ? mix(n.home, core, c ** 1.4) : n.home
          at(n, n.cur)
        }
      }
      coreNode.el.style.setProperty('--grow', (1 + c * 0.55).toFixed(3))
      if (!isDeck()) map.classList.toggle('is-gathered', c > 0.9)
      const da = smooth(a)
      for (const s of dust) {
        s.cur = c > 0 ? mix(s.home, { x: s.home.x * 0.3, y: s.home.y * 0.3, z: s.home.z * 0.3 }, c) : da < 1 ? mix(s.from, s.home, da) : s.home
        placeDust(s, s.cur)
      }
    }

    function lightThread(name) {
      map.classList.toggle('has-thread', !!name)
      world.querySelectorAll('[data-thread]').forEach((el) => el.classList.toggle('lit', el.dataset.thread === name))
      // the lit notes come forward even when they belong to another stage
      nodes.forEach((n) => { n.lit = !!name && n.el.dataset.thread === name })
      if (cam?.pose) render()
    }

    // the dust nearest the cursor is pushed aside in screen space, then springs back
    function stir(c) {
      if (!pointer.on && !dust.some((s) => s.ox || s.oy)) return false
      const ry = (c.yaw * Math.PI) / 180, rp = (-c.pitch * Math.PI) / 180
      const cy = Math.cos(ry), sy = Math.sin(ry), cp = Math.cos(rp), sp = Math.sin(rp)
      const mx = pointer.x - innerWidth / 2, my = pointer.y - innerHeight * 0.46
      let moving = false
      for (const s of dust) {
        const base = s.cur
        if (pointer.on) {
          const px = base.x + s.ox - c.x, py = base.y + s.oy - c.y, pz = base.z - c.z
          const x1 = px * cy + pz * sy, z1 = -px * sy + pz * cy
          const depth = py * sp + z1 * cp - c.d
          if (depth < PERSPECTIVE * 0.8) {
            const k = PERSPECTIVE / (PERSPECTIVE - depth)
            const dx = x1 * k - mx, dy = (py * cp - z1 * sp) * k - my
            const dist = Math.hypot(dx, dy)
            if (dist < 150 && dist > 0.1) {
              const f = ((1 - dist / 150) ** 2 * 3.2) / k
              s.vx += (dx / dist) * f; s.vy += (dy / dist) * f
            }
          }
        }
        s.vx += -s.ox * 0.04; s.vy += -s.oy * 0.04
        s.vx *= 0.86; s.vy *= 0.86
        if (Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.ox) + Math.abs(s.oy) < 0.08) {
          if (s.ox || s.oy) { s.ox = s.oy = s.vx = s.vy = 0; placeDust(s, base) }
          continue
        }
        s.ox += s.vx; s.oy += s.vy
        placeDust(s, base)
        moving = true
      }
      return moving
    }

    function render() {
      const c = cam.pose
      world.style.transform = `translateZ(${(-c.d).toFixed(1)}px) rotateX(${(-c.pitch).toFixed(2)}deg) rotateY(${c.yaw.toFixed(2)}deg) translate3d(${(-c.x).toFixed(1)}px,${(-c.y).toFixed(1)}px,${(-c.z).toFixed(1)}px)`
      // nodes fade with distance, and hide before they would pass through the camera
      const ry = (c.yaw * Math.PI) / 180, rp = (-c.pitch * Math.PI) / 180
      const cy = Math.cos(ry), sy = Math.sin(ry), cp = Math.cos(rp), sp = Math.sin(rp)
      const near = PERSPECTIVE * 0.55
      for (const n of nodes) {
        const q = n.cur
        const px = q.x - c.x, py = q.y - c.y, pz = q.z - c.z
        const z1 = -px * sy + pz * cy
        const depth = py * sp + z1 * cp - c.d
        const behind = -(depth + c.d)
        let o = (n.lit ? 1 : n.dim) * (depth > near ? 0 : clamp(1 - Math.max(0, behind - 300) / 2200, 0.2, 1) * clamp((near - depth) / 260, 0, 1))
        if (n !== coreNode) o *= 1 - last.c
        const v = o.toFixed(2)
        if (n.o !== v) { n.o = v; n.el.style.opacity = v; n.el.style.visibility = o < 0.02 ? 'hidden' : '' }
      }
    }

    function setTally(upTo) {
      const counts = {}
      stageThoughts.slice(0, upTo + 1).flat().forEach((t) => { counts[t.kind] = (counts[t.kind] || 0) + 1 })
      tally.querySelectorAll('[data-k]').forEach((el) => {
        const v = String(counts[el.dataset.k] || 0).padStart(2, '0')
        const b = el.firstChild
        if (b.textContent === v) return
        b.textContent = v
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump')
      })
    }

    function setActive(stop) {
      if (stop === active) return
      active = stop
      const s = stops[stop]
      const i = s.kind === 'stage' ? s.i : -2
      map.dataset.at = s.kind
      nodes.forEach((n) => {
        const on = s.kind === 'core' || s.kind === 'finale' ? n.stage === -1 : n.stage === i
        n.el.classList.toggle('on', on)
        // at a stage, the rest of the map steps back so the stage you're on reads first
        n.dim = s.kind === 'stage' && !on ? (narrow.matches ? 0.08 : n.stage === -1 ? 0.16 : 0.32) : s.kind === 'core' && !on && narrow.matches ? 0.14 : 1
      })
      tabs.forEach((t, k) => (k === i ? t.setAttribute('aria-current', 'step') : t.removeAttribute('aria-current')))
      setTally(s.kind === 'stage' ? i : s.kind === 'close' || s.kind === 'finale' ? stageItems.length : -1)
      let n = '', when = '', verb = '', what = ''
      if (s.kind === 'stage') {
        const item = stageItems[i]
        n = String(i + 1).padStart(2, '0'); when = item.dataset.when || ''
        verb = item.querySelector('h3').textContent.trim(); what = item.querySelector(':scope > p')?.innerHTML || ''
      } else if (s.kind === 'core') {
        n = 'The idea'; verb = coreWord; what = coreItem.querySelector('p')?.innerHTML || ''
      } else if (s.kind === 'close') {
        n = 'The whole map'; verb = map.dataset.close || 'The whole thought'; what = map.dataset.closeLine || ''
      } else if (s.kind === 'finale') {
        n = 'End'; verb = coreWord; what = map.dataset.finaleLine || ''
      } else if (s.kind === 'build') {
        n = 'The process'; verb = map.dataset.start || 'It started with one line.'; what = map.dataset.startLine || ''
      } else {
        n = 'Scroll'; verb = map.dataset.open || 'How the thinking went'; what = map.dataset.openLine || ''
      }
      cap.n.textContent = n; cap.when.textContent = when; cap.what.innerHTML = what
      delete cap.verb.dataset.word
      cap.verb.textContent = verb; scramble(cap.verb)
    }

    // landing on a stage plays it out: notes type in one after another, dropped ideas are struck
    // through and fall away, rules lock into place. What was cut stays cut on the way back.
    function arrive(i) {
      const first = !played.has(i)
      played.add(i)
      stageThoughts[i].forEach((t, j) => {
        const el = t.el
        setTimeout(() => {
          if (arrived !== i) return
          const text = el.querySelector('.tmap-t')
          const len = (text.dataset.word ?? text.textContent).length
          scramble(text, Math.min(1100, 420 + len * 6))
          el.classList.add('is-typed')
          if (t.kind === 'cut' && first) {
            setTimeout(() => el.classList.add('is-struck'), 700)
            setTimeout(() => el.classList.add('is-fallen'), 1500)
          }
          if (t.kind === 'rule') {
            el.classList.remove('is-locked'); void el.offsetWidth
            setTimeout(() => el.classList.add('is-locked'), 650)
          }
        }, j * 150)
      })
    }

    function frame() {
      if (!inView || still.matches) { running = false; return }
      const t = target()
      if (!cam) cam = { p: t, v: 0 }
      let moving = false
      const now = performance.now()
      if (!intro.start && map.getBoundingClientRect().top < innerHeight * 0.6) intro.start = now
      if (intro.start && intro.a < 1) { intro.a = clamp((now - intro.start) / 2800, 0, 1); moving = true }
      const dp = (t - cam.p) * 0.075
      if (Math.abs(t - cam.p) > 0.0005) { cam.p += dp; moving = true } else cam.p = t
      for (const o of [lean, orbit]) {
        const ex = o.tx - o.x, ey = o.ty - o.y
        if (Math.abs(ex) + Math.abs(ey) > 0.01) { o.x += ex * 0.08; o.y += ey * 0.08; moving = true } else { o.x = o.tx; o.y = o.ty }
      }
      // the speed of the flight, for the dust to streak by
      const v = clamp(Math.abs(dp) * 9, 0, 1)
      if (Math.abs(v - cam.v) > 0.02) { cam.v = v; world.style.setProperty('--streak', v.toFixed(2)) }
      if (!orbit.drag && idle.last) idle.t += Math.min(64, now - idle.last)
      idle.last = now
      cam.pose = pose(cam.p)
      if (cam.pose.w > 0.02) moving = true
      // overviews can be dragged; elsewhere the drag eases back to nothing
      map.classList.toggle('can-drag', cam.pose.w > 0.6 && fine.matches)
      if (cam.pose.w < 0.05 && !orbit.drag) { orbit.tx = 0; orbit.ty = 0 }

      const stop = Math.round(cam.p)
      setActive(stop)
      const s = stops[stop]
      const landed = Math.abs(cam.p - stop) < 0.14 && s.kind === 'stage' ? s.i : -1
      if (landed !== arrived) { arrived = landed; if (landed >= 0) arrive(landed) }
      // the focus pull only while landed: blur is costly, so flights run without it
      map.classList.toggle('is-landed', landed >= 0 && Math.abs(cam.p - stop) < 0.04)

      tabsRow.style.setProperty('--p', clamp((cam.p - 2) / (stageItems.length - 1), 0, 1).toFixed(3))
      layout(cam.p)
      render()
      if (stir(cam.pose)) moving = true
      if (moving) requestAnimationFrame(frame)
      else {
        running = false
        idle.last = 0
        if (cam.v) { cam.v = 0; world.style.setProperty('--streak', 0) }
      }
    }

    function queue() {
      // on a phone there is no map to animate, only the deck of cards
      if (running || !inView || still.matches || !stops.length || isDeck()) return
      running = true
      requestAnimationFrame(frame)
    }

    function go(stop) {
      // on a phone, a stage on the map brings its card round instead
      if (isDeck()) { track?.scrollTo({ left: step() * (stop - 1), behavior: 'smooth' }); return }
      scrollTo({ top: top() + span() * (stop / segs()), behavior: 'smooth' })
    }

    skip?.addEventListener('click', () => {
      scrollTo({ top: top() + map.offsetHeight, behavior: still.matches ? 'auto' : 'smooth' })
      const after = map.nextElementSibling
      if (after) { after.setAttribute('tabindex', '-1'); after.focus({ preventScroll: true }) }
    })

    function onMove(e) {
      if (!fine.matches) return
      lean.tx = (e.clientX / innerWidth - 0.5) * 2
      lean.ty = (e.clientY / innerHeight - 0.5) * -2
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true
      clearTimeout(pointer.t)
      pointer.t = setTimeout(() => { pointer.on = false }, 120) // a resting cursor lets the dust settle
      if (orbit.drag) {
        orbit.tx = clamp(orbit.drag.x + (e.clientX - orbit.drag.cx) * 0.18, -70, 70)
        orbit.ty = clamp(orbit.drag.y - (e.clientY - orbit.drag.cy) * 0.12, -30, 30)
      }
      queue()
    }
    pin.addEventListener('pointermove', onMove)
    pin.addEventListener('pointerleave', () => { lean.tx = 0; lean.ty = 0; pointer.on = false; queue() })
    // grab the map on an overview and turn it
    view.addEventListener('pointerdown', (e) => {
      if (!map.classList.contains('can-drag') || e.button !== 0 || e.target.closest('button')) return
      orbit.drag = { cx: e.clientX, cy: e.clientY, x: orbit.tx, y: orbit.ty }
      view.setPointerCapture(e.pointerId)
      map.classList.add('is-dragging')
      e.preventDefault()
    })
    const release = () => { orbit.drag = null; map.classList.remove('is-dragging') }
    view.addEventListener('pointerup', release)
    view.addEventListener('pointercancel', release)

    new IntersectionObserver(([e]) => { inView = e.isIntersecting; queue() }, { rootMargin: '200px 0px' }).observe(map)
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; queue() }) } }, { passive: true })
    let rt
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 150) })
    still.addEventListener('change', measure)
    narrow.addEventListener('change', measure)
    view.style.perspective = `${PERSPECTIVE}px`
    map.classList.add('is-live')
    document.fonts?.ready.then(measure)
    measure()
  }

  const start = () => document.querySelectorAll('[data-thoughtmap]').forEach(init)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
