// Creative process on a case study (styles: /assets/process.css).
// Scrolling through the section slides the stages across; the numbered row scrolls straight to a
// stage, and Skip scrolls past the section. Nothing here stops the page scrolling normally.
(() => {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const still = matchMedia('(max-width: 860px), (prefers-reduced-motion: reduce)')

  function scramble(el) {
    const target = el.dataset.word || (el.dataset.word = el.textContent)
    const start = performance.now(), dur = 380
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const keep = Math.floor(t * target.length)
      el.textContent = target.slice(0, keep) + [...target.slice(keep)].map(() => CHARS[(Math.random() * 26) | 0]).join('')
      if (t < 1) requestAnimationFrame(tick)
      else el.textContent = target
    }
    requestAnimationFrame(tick)
  }

  function init(proc) {
    const track = proc.querySelector('.proc-track')
    const stages = [...proc.querySelectorAll('.proc-stage')]
    const tabs = [...proc.querySelectorAll('.proc-tab')]
    const row = proc.querySelector('.proc-tabs')
    const skip = proc.querySelector('.proc-skip')
    const last = stages.length - 1
    let travel = 0, active = -1, queued = false
    row?.style.setProperty('--n', stages.length)

    const top = () => proc.getBoundingClientRect().top + scrollY
    const span = () => proc.offsetHeight - innerHeight

    function measure() {
      if (still.matches) { proc.style.height = ''; track.style.transform = ''; return }
      travel = Math.max(0, track.scrollWidth - innerWidth)
      proc.style.height = `${innerHeight + travel}px`
      update()
    }

    function setActive(i) {
      if (i === active) return
      active = i
      stages.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('past', k < i) })
      tabs.forEach((t, k) => (k === i ? t.setAttribute('aria-current', 'step') : t.removeAttribute('aria-current')))
      const verb = stages[i]?.querySelector('.proc-verb')
      if (verb) scramble(verb)
    }

    function update() {
      queued = false
      if (still.matches) return
      const s = span()
      const p = s > 0 ? Math.min(1, Math.max(0, (scrollY - top()) / s)) : 0
      track.style.transform = `translate3d(${-p * travel}px,0,0)`
      row?.style.setProperty('--p', p)
      setActive(Math.round(p * last))
    }

    tabs.forEach((t, k) => t.addEventListener('click', () => scrollTo({ top: top() + span() * (k / last), behavior: 'smooth' })))
    skip?.addEventListener('click', () => {
      scrollTo({ top: top() + proc.offsetHeight, behavior: 'smooth' })
      const after = proc.nextElementSibling
      if (after) { after.setAttribute('tabindex', '-1'); after.focus({ preventScroll: true }) }
    })

    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update) } }, { passive: true })
    addEventListener('resize', measure)
    still.addEventListener('change', measure)
    document.fonts?.ready.then(measure)
    measure()
    if (still.matches) stages.forEach((s) => s.classList.add('on'))
  }

  const start = () => document.querySelectorAll('[data-process]').forEach(init)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
