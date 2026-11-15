'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { scrollPageTo } from '@/components/SmoothScroll'
import { Beat, beatTop } from './Beat'

/*
  The product, running on sample data.
  1. A clip (time-based, not scroll-scrubbed): a search types itself, each phrase marks itself
     up as a filter, a line sweeps while it "generates", then the ranked ledger builds in.
  2. After the clip, scroll drives the walkthrough: matches (drag the budget and everything
     re-ranks), the top building's evidence, a roommate comparison, then a real search box.
  Scrolling down into the section stops at the stage, however hard the scroll, so a fling cannot
  skip the clip. After a short look, the next scroll down skips the rest ("Skip intro" and Escape
  work too), so the page never feels stuck. Landing past the section without
  scrolling through it (reload, link) shows the end state instead of pulling the page back.
*/

type Place = { name: string; rent: number; beds: number; walk: number; quiet: number; avail: string }

// Sample data, not real listings.
const SAMPLE: Place[] = [
  { name: 'The Ellendale', rent: 1380, beds: 2, walk: 8, quiet: 0.45, avail: 'Aug 1' },
  { name: 'Figueroa Court', rent: 1240, beds: 2, walk: 14, quiet: 0.8, avail: 'Aug 15' },
  { name: 'Menlo Lofts', rent: 1690, beds: 2, walk: 5, quiet: 0.85, avail: 'Aug 1' },
  { name: 'West 30th Duplex', rent: 1120, beds: 2, walk: 19, quiet: 0.7, avail: 'Sep 1' },
  { name: 'Hoover Gardens', rent: 1450, beds: 1, walk: 10, quiet: 0.9, avail: 'Aug 1' },
  { name: 'Adams House', rent: 980, beds: 2, walk: 24, quiet: 0.55, avail: 'Jul 20' },
]
const PREF = { beds: 2, walk: 15, month: 'Aug' }

const FINDINGS = [
  { n: '9', of: '14', t: 'Late-night noise on weekends', m: '6 verified residents · Aug 2025 to Apr 2026', flag: true },
  { n: '11', of: '11', t: 'Short walk to campus is accurate', m: '5 verified residents · Sep 2025 to Apr 2026' },
  { n: '5', of: '11', t: 'Repairs closed within three days', m: '4 verified residents · 2025 to 2026' },
  { n: '6', of: '8', t: 'AC failed during the July heat', m: '6 verified residents · Summer 2025', flag: true },
]

const COMPARE = [
  { k: 'Sleep', you: 'By midnight', them: 'By 1am', v: 'Close enough' },
  { k: 'Cleaning', you: 'Weekly', them: 'Weekly', v: 'Same' },
  { k: 'Guests', you: 'Sometimes', them: 'Rarely', v: 'Talk about this', gap: true },
  { k: 'Smoking', you: 'No', them: 'No', v: 'Same' },
]

const SAY: { t: string; tag?: string }[] = [
  { t: 'Two bedroom', tag: '2 bedrooms' },
  { t: ' ' },
  { t: 'under $1,500', tag: 'budget $1,500' },
  { t: ', ' },
  { t: 'walkable to campus', tag: '≤ 15 min walk' },
  { t: ', ' },
  { t: 'quiet enough to study', tag: 'quiet, from reviews' },
  { t: ', moving in ' },
  { t: 'August', tag: 'Aug move-in' },
  { t: '.' },
]
const SAY_TEXT = SAY.map((s) => s.t).join('')

const TABS = [
  { id: 'describe', label: 'Describe', at: -1 },
  { id: 'matches', label: 'Matches', at: 0.02 },
  { id: 'building', label: 'Building', at: 0.59 },
  { id: 'roommate', label: 'Roommate', at: 0.72 },
  { id: 'start', label: 'Start', at: 1 },
]

// Scroll ranges per pane once the clip is done. The describe pane only exists inside the clip.
const RANGES: ([number, number] | null)[] = [null, [-1, 0.42], [0.42, 0.63], [0.63, 0.85], [0.85, 1.01]]
const LD_VH = 340 // the section's height (.ld in globals.css)
// Where each pane is fully composed: the clip, building profile, roommate fit, describe.
const BEATS = [0, 0.6, 0.76, 0.97]
const HOLD = 0.12 // landing beyond this without scrolling through the section skips the clip
const MIN_WATCH = 1500 // ms of clip everyone sees before a new scroll may skip the rest
const GESTURE_GAP = 250 // ms without wheel events that ends a wheel gesture (and its momentum)
// Keys that scroll the page down; held back during the first MIN_WATCH ms of the clip.
const DOWN_KEYS = new Set([' ', 'PageDown', 'ArrowDown', 'End'])

const usd = (n: number) => '$' + n.toLocaleString('en-US')
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

/** Scores one place and writes the reason as a sentence: what works, then "but" what doesn't. */
function score(l: Place, budget: number) {
  const good: string[] = []
  const bad: string[] = []
  let s = 0
  const d = budget - l.rent
  if (d >= 0) {
    s += 35
    good.push(d < 40 ? 'right at your budget' : `${usd(d)} under budget`)
  } else {
    s += 35 - Math.min(35, -d / 10)
    bad.push(`${usd(-d)} over budget`)
  }
  if (l.walk <= PREF.walk) {
    s += 25
    good.push(`${l.walk} min walk`)
  } else {
    s += Math.max(0, 25 - (l.walk - PREF.walk) * 2.5)
    bad.push(`${l.walk} min walk`)
  }
  if (l.beds === PREF.beds) s += 15
  else bad.push(`only ${l.beds} bedroom`)
  s += 20 * l.quiet
  if (l.quiet >= 0.7) good.push('residents call it quiet')
  else bad.push('noise comes up in reviews')
  if (l.avail.startsWith(PREF.month)) s += 5
  else bad.push(`free ${l.avail}`)
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  let why = good.length ? cap(good.join(', ')) : ''
  if (bad.length) why += (why ? ', but ' : '') + `<em>${good.length ? bad.join(', ') : cap(bad.join(', '))}</em>`
  return { s: Math.round(clamp(s, 0, 100)), why: why + '.' }
}

// Per-character typing times with a human rhythm: jitter, and a pause after commas.
const CH: number[] = (() => {
  const out: number[] = []
  let t = 500
  let i = 0
  for (const c of SAY_TEXT) {
    out.push(t)
    t += 18 + ((i * 7919) % 22) + (c === ',' ? 140 : c === ' ' ? 10 : 0)
    i++
  }
  out.push(t)
  return out
})()
const TYPED = CH[CH.length - 1]
const T = { mark: TYPED + 200, gen: TYPED + 1100, swap: TYPED + 2100, rows: TYPED + 2300, end: TYPED + 3200 }

export function LiveDemo() {
  const router = useRouter()
  const root = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  const [isStatic, setStatic] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setStatic(reduce)
    const $ = <E extends Element = HTMLElement>(s: string) => el.querySelector(s) as unknown as E
    const $$ = <E extends Element = HTMLElement>(s: string) => [...el.querySelectorAll(s)] as unknown as E[]

    const panes = $$('.ld-pane')
    const tabs = $$<HTMLButtonElement>('.ld-tabs button')
    const sweep = $('.ld-sweep')
    const statusEl = $('.ld-status-text')
    const rowsEl = $('.ld-rows')
    const rowEls = new Map($$('.ld-row').map((r) => [r.dataset.name!, r]))
    const budgetIn = $<HTMLInputElement>('#ld-budget')
    const budgetOut = $('#ld-budget-out')
    const topName = { textContent: SAMPLE[1].name }
    const phrases = $$('.ld-ph')
    const typed = $$('[data-say]')
    const finds = $$('.ld-find')
    const qa = $('.ld-qa')
    const cmpRows = $$('.ld-cmp tbody tr')
    const fitNum = $('#ld-fit')
    const stage = $('.ld-stage')

    const setTab = (t: HTMLElement, on: boolean) => {
      t.classList.toggle('is-on', on)
      if (on) t.setAttribute('aria-current', 'step')
      else t.removeAttribute('aria-current')
    }

    let statusHtml = ''
    const status = (h: string) => {
      if (h !== statusHtml) {
        statusHtml = h
        statusEl.innerHTML = h
      }
    }

    // Ledger: re-ranked with transform only.
    let budget = 1500
    let touched = false
    let rankOf = new Map<string, number>()
    const matchesPane = $('#ld-matches')
    // Rows share whatever height the pane has left, so all six fit on short screens too.
    const rowH = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches
      const avail = (matchesPane.clientHeight - rowsEl.offsetTop - 16) / SAMPLE.length
      return Math.floor(clamp(avail, mobile ? 50 : 40, mobile ? 62 : 66))
    }
    function rank() {
      const h = rowH()
      rowsEl.style.height = SAMPLE.length * h + 'px'
      const scored = SAMPLE.map((l) => ({ l, ...score(l, budget) })).sort((a, b) => b.s - a.s)
      rankOf = new Map(scored.map((x, i) => [x.l.name, i]))
      scored.forEach((x, i) => {
        const r = rowEls.get(x.l.name)!
        r.style.setProperty('--rh', h + 'px')
        r.style.transform = `translateY(${i * h}px)`
        r.classList.toggle('is-first', i === 0)
        r.querySelector('.ld-rank')!.textContent = String(i + 1)
        r.querySelector('.ld-score')!.textContent = String(x.s)
        r.querySelector('.ld-why')!.innerHTML = x.why
      })
      topName.textContent = scored[0].l.name
    }
    const setBudget = (b: number) => {
      budget = b
      budgetIn.value = String(b)
      budgetOut.textContent = usd(b)
      rank()
    }
    const onBudget = () => {
      touched = true
      setBudget(+budgetIn.value)
      status(`Top match <b>${topName.textContent}</b>, at ${usd(budget)}`)
    }
    budgetIn.addEventListener('input', onBudget)

    // Typing: fills each phrase's text node up to n characters.
    let lastN = -1
    function typeTo(n: number) {
      if (n === lastN) return
      lastN = n
      let left = n
      SAY.forEach((s, i) => {
        const k = Math.max(0, Math.min(s.t.length, left))
        left -= k
        typed[i].textContent = s.t.slice(0, k)
      })
    }

    /* ---------- The clip ---------- */
    let started = false
    let done = false
    let raf = 0
    let t0 = 0
    function frame(ms: number) {
      let n = 0
      while (n < CH.length - 1 && CH[n] <= ms) n++
      typeTo(n)
      phrases.forEach((ph, i) => {
        const v = clamp((ms - T.mark - i * 150) / 240)
        ph.style.setProperty('--hl', v * 100 + '%')
        const tag = ph.querySelector<HTMLElement>('.ld-tag')!
        tag.style.opacity = String(v)
        tag.style.transform = `translateY(${(1 - v) * -4}px)`
      })
      const g = clamp((ms - T.gen) / (T.swap - T.gen))
      sweep.style.transform = `scaleX(${1 - Math.pow(1 - g, 3)})`
      sweep.style.opacity = String(1 - clamp((ms - T.swap) / 300))
      if (ms < TYPED) status('Reading your description')
      else if (ms < T.gen) status('Understood <b>5 requirements</b>')
      else if (ms < T.swap) status(g < 0.5 ? 'Checking <b>6 listings</b> near USC' : 'Reading <b>39 resident reviews</b>')
      const out = clamp((ms - T.swap) / 360)
      const inn = clamp((ms - T.swap - 120) / 400)
      panes.forEach((p, i) => {
        p.style.opacity = String(i === 0 ? 1 - out : i === 1 ? inn : 0)
        p.style.transform = i === 0 ? `translateY(${-out * 24}px)` : i === 1 ? `translateY(${(1 - inn) * 14}px)` : ''
        p.classList.toggle('is-on', i === (ms < T.swap ? 0 : 1))
      })
      rowEls.forEach((r, name) => {
        r.style.opacity = String(clamp((ms - T.rows - (rankOf.get(name) ?? 0) * 100) / 280))
      })
      tabs.forEach((t, i) => setTab(t, i === (ms < T.swap ? 0 : 1)))
    }
    function finish() {
      cancelAnimationFrame(raf)
      started = true
      frame(T.end)
      done = true
      rowEls.forEach((r) => (r.style.opacity = ''))
      status(`Top match <b>${topName.textContent}</b>, at ${usd(budget)}`)
      render(cur)
    }
    function play() {
      cancelAnimationFrame(raf)
      started = true
      done = false
      lastN = -1
      t0 = performance.now()
      const step = (now: number) => {
        const ms = now - t0
        frame(ms)
        if (ms < T.end) raf = requestAnimationFrame(step)
        else finish()
      }
      raf = requestAnimationFrame(step)
    }
    /* ---------- Holding the page while the clip plays ---------- */
    // The stage is sticky, so a page held at the section's top looks exactly like a docked stage.
    const playing = () => started && !done
    const held = () => playing() && el.getBoundingClientRect().top <= 1
    const holdTop = () => window.scrollY + el.getBoundingClientRect().top

    // The scroll that brings the visitor here stops at the clip. After a short look, the next
    // deliberate scroll down (a new wheel gesture, a new swipe, a key) skips the rest and moves on.
    const canSkip = (now: number) => now - t0 > MIN_WATCH

    const onKey = (e: KeyboardEvent) => {
      if (playing() && e.key === 'Escape') finish()
      const t = e.target as HTMLElement | null
      if (held() && DOWN_KEYS.has(e.key) && !t?.closest?.('input, textarea, select, button, [contenteditable]')) {
        if (canSkip(e.timeStamp)) finish()
        else e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    // Capture phase, so a swallowed wheel never reaches Lenis. Wheel events less than GESTURE_GAP
    // apart (including trackpad momentum) belong to one gesture.
    let lastWheel = -Infinity
    const onWheel = (e: WheelEvent) => {
      const fresh = e.timeStamp - lastWheel > GESTURE_GAP
      lastWheel = e.timeStamp
      if (!held() || e.deltaY <= 0) return
      if (fresh && canSkip(e.timeStamp)) return finish()
      e.preventDefault()
      e.stopPropagation()
    }
    let touchY = 0
    let touchSkips = false
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0
      touchSkips = held() && canSkip(e.timeStamp)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!held() || (e.touches[0]?.clientY ?? touchY) >= touchY) return
      if (touchSkips) finish()
      else e.preventDefault()
    }

    /* ---------- After the clip, scroll drives the walkthrough ---------- */
    function progress() {
      const r = el!.getBoundingClientRect()
      return -r.top / (r.height - stage.offsetHeight)
    }
    function render(p: number) {
      if (!done) return
      const active = RANGES.findIndex((r) => r && p >= r[0] && p < r[1])
      panes.forEach((pane, i) => {
        const r = RANGES[i]
        if (!r || i !== active) {
          pane.style.opacity = '0'
          pane.classList.remove('is-on')
          return
        }
        const [a, b] = r
        const vin = i === 1 ? 1 : seg(p, a + 0.002, a + 0.022)
        const vout = i === panes.length - 1 ? 0 : seg(p, b - 0.02, b)
        pane.style.opacity = String(vin * (1 - vout))
        pane.style.transform = `translateY(${(1 - vin) * 14 - vout * 14}px)`
        pane.classList.add('is-on')
      })
      tabs.forEach((t, i) => setTab(t, i === active))
      // Until the visitor touches it, scroll sweeps the budget down and back.
      if (!touched && active === 1) {
        const t = seg(p, 0.14, 0.38)
        const b = Math.round((1500 - Math.sin(t * Math.PI) * 420) / 10) * 10
        if (b !== budget) setBudget(b)
      }
      if (active === 1) status(`Top match <b>${topName.textContent}</b>, at ${usd(budget)}`)
      finds.forEach((f, i) => {
        const v = seg(p, 0.44 + i * 0.022, 0.465 + i * 0.022)
        f.style.opacity = String(v)
        f.style.transform = `translateY(${(1 - v) * 8}px)`
      })
      qa.style.opacity = String(seg(p, 0.55, 0.58))
      if (active === 2) status('Building profile: <b>Figueroa Court</b>, 14 reviews from 6 verified residents')
      cmpRows.forEach((r, i) => (r.style.opacity = String(seg(p, 0.645 + i * 0.016, 0.66 + i * 0.016))))
      fitNum.textContent = String(Math.round(seg(p, 0.64, 0.71) * 86))
      if (active === 3) status('Roommate fit: <b>86</b>, one thing to talk about')
      if (active === 4) status('Waiting for your description')
    }

    let target = 0
    let cur = 0
    let ticking = false
    function tick() {
      cur += (target - cur) * 0.16
      if (Math.abs(target - cur) < 0.0002) cur = target
      render(cur)
      if (cur !== target) requestAnimationFrame(tick)
      else ticking = false
    }
    let seenAbove = false
    function onScroll() {
      const top = el!.getBoundingClientRect().top
      const p = progress()
      target = clamp(p, -1, 1.01)
      if (!started) {
        // Start the clip as the stage arrives. Arriving by scroll always plays it, even after a
        // fling that jumps past in one frame; landing past it without scrolling through skips it.
        if (top >= window.innerHeight * 0.3) seenAbove = true
        else if (seenAbove || p <= HOLD) play()
        else finish()
      }
      // Overshot while the clip plays (fling, scrollbar drag, keyboard): pull back to the stage.
      if (playing() && top < -1) {
        scrollPageTo(holdTop(), false)
        cur = target = 0
      }
      if (!ticking) {
        ticking = true
        requestAnimationFrame(tick)
      }
    }
    const onResize = () => {
      rank()
      render(cur)
    }

    const scrollToAt = (at: number, smooth = !reduce) => {
      const top = window.scrollY + el.getBoundingClientRect().top + at * (el.offsetHeight - stage.offsetHeight) + (at ? 2 : 0)
      scrollPageTo(top, smooth)
    }
    const tabHandlers = tabs.map((t, i) => {
      const h = () => {
        const at = TABS[i].at
        if (at < 0) {
          scrollToAt(0, false) // jump, so passing through later panes does not end the clip
          cur = target = 0
          play()
          return
        }
        if (!done) finish()
        scrollToAt(at)
      }
      t.addEventListener('click', h)
      return h
    })
    const replayBtn = $('.ld-replay')
    const skipBtn = $('.ld-skip')
    const onReplay = () => {
      scrollToAt(0, false) // jump, so passing through later panes does not end the clip
      cur = target = 0
      play()
    }
    replayBtn.addEventListener('click', onReplay)
    skipBtn.addEventListener('click', finish)

    rank()
    if (reduce) {
      typeTo(SAY_TEXT.length)
      phrases.forEach((ph) => ph.style.setProperty('--hl', '100%'))
      el.querySelectorAll<HTMLElement>('.ld-tag').forEach((t) => (t.style.opacity = '1'))
      done = started = true
      status(`Top match <b>${topName.textContent}</b>, at ${usd(budget)}`)
      fitNum.textContent = '86'
    } else {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onResize)
      window.addEventListener('wheel', onWheel, { capture: true, passive: false })
      window.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove, { passive: false })
      onScroll()
    }

    return () => {
      cancelAnimationFrame(raf)
      budgetIn.removeEventListener('input', onBudget)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      tabs.forEach((t, i) => t.removeEventListener('click', tabHandlers[i]))
      replayBtn.removeEventListener('click', onReplay)
      skipBtn.removeEventListener('click', finish)
    }
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length >= 3) router.push(`/match?q=${encodeURIComponent(q)}`)
  }

  return (
    <section ref={root} className={`ld ${isStatic ? 'ld-static' : ''}`} aria-label="HOMIE, running on sample data">
      {!isStatic && BEATS.map((p) => <Beat key={p} top={beatTop(p, LD_VH)} />)}
      <div className="ld-stage">
        <div className="shell ld-app">
          <header className="ld-top">
            <nav className="ld-tabs" aria-label="Walkthrough">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-controls={`ld-${t.id}`}>
                  {t.label}
                </button>
              ))}
            </nav>
            <span className="ld-demo">Sample data, scored in your browser</span>
          </header>

          <div className="ld-panes">
            <div className="ld-sweep" aria-hidden />

            <div className="ld-pane is-on" id="ld-describe">
              <h2 className="ld-kicker">Student housing near USC, explained.</h2>
              <p className="ld-say" aria-label={SAY_TEXT}>
                {SAY.map((s, i) =>
                  s.tag ? (
                    <span key={i} className="ld-ph" aria-hidden>
                      <span data-say />
                      <span className="ld-tag">{s.tag}</span>
                    </span>
                  ) : (
                    <span key={i} data-say aria-hidden />
                  ),
                )}
                <span className="ld-caret" aria-hidden />
              </p>
              <p className="ld-under">
                Write it the way you&apos;d text a friend. HOMIE reads it, ranks the listings, and tells you why each one
                is where it is.
              </p>
              <button className="ld-skip" type="button">
                Skip intro
              </button>
            </div>

            <div className="ld-pane" id="ld-matches">
              <p className="ld-query">
                You asked for <b>two bedrooms under $1,500, walkable, quiet, from August.</b>{' '}
                <button className="ld-replay" type="button">
                  Replay
                </button>
              </p>
              <div className="ld-mhead">
                <h3 className="ld-h">Six places, ranked. Every score says why.</h3>
                <div>
                  <div className="ld-budget">
                    <label htmlFor="ld-budget">Budget</label>
                    <div className="ld-range">
                      <input id="ld-budget" type="range" min={900} max={2200} step={10} defaultValue={1500} />
                    </div>
                    <output id="ld-budget-out" htmlFor="ld-budget">
                      $1,500
                    </output>
                  </div>
                  <p className="ld-hint">Drag it. The ranking and the reasons recompute.</p>
                </div>
              </div>
              <div className="ld-ledger">
                <div className="ld-cols" aria-hidden>
                  <span>Rank</span>
                  <span>Place</span>
                  <span>Why</span>
                  <span>Rent</span>
                  <span>Fit</span>
                </div>
                <div className="ld-rows">
                  {SAMPLE.map((l) => (
                    <div key={l.name} className="ld-row" data-name={l.name}>
                      <span className="ld-rank" />
                      <span className="ld-name">{l.name}</span>
                      <span className="ld-why" />
                      <span className="ld-rent">{usd(l.rent)}</span>
                      <span className="ld-score" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ld-pane" id="ld-building">
              <p className="ld-kicker">What residents reported</p>
              <h3 className="ld-h">
                Figueroa Court, by the numbers.
              </h3>
              <div className="ld-bwrap">
                <div className="ld-finds">
                  {FINDINGS.map((f) => (
                    <div key={f.t} className={`ld-find ${f.flag ? 'is-flag' : ''}`}>
                      <div className="ld-n">
                        {f.n}
                        <small> of {f.of}</small>
                      </div>
                      <div>
                        <div className="ld-t">{f.t}</div>
                        <div className="ld-m">{f.m}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ld-note">
                  <p className="ld-q">Is it quiet enough to study at night?</p>
                  <p className="ld-qa">
                    Weeknights, mostly yes. Noise comes up on weekends, and more often from street-side units than
                    courtyard ones.
                    <span>From 14 reviews by 6 verified residents, Aug 2025 to Apr 2026</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="ld-pane" id="ld-roommate">
              <p className="ld-kicker">Then the person you&apos;d share it with</p>
              <h3 className="ld-h">You and Maya, Viterbi &apos;27.</h3>
              <div className="ld-pair">
                <table className="ld-cmp">
                  <thead>
                    <tr>
                      <th />
                      <th>You</th>
                      <th>Maya</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((r) => (
                      <tr key={r.k}>
                        <th>{r.k}</th>
                        <td>{r.you}</td>
                        <td>{r.them}</td>
                        <td className={`ld-v ${r.gap ? 'is-gap' : ''}`}>{r.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ld-fit">
                  <div className="ld-big">
                    <span id="ld-fit">0</span>
                    <sup>/100</sup>
                  </div>
                  <p>One real difference, and it&apos;s named so you can sort it out before move-in.</p>
                </div>
              </div>
            </div>

            <div className="ld-pane ld-start" id="ld-start">
              <h3 className="ld-h ld-h-xl">Now describe yours.</h3>
              <form onSubmit={submit}>
                <label htmlFor="ld-q" className="ld-kicker">
                  What are you looking for?
                </label>
                <textarea
                  id="ld-q"
                  rows={2}
                  maxLength={1000}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
                  }}
                  placeholder="A room under $1,200 near Viterbi, with someone tidy"
                />
                <div className="ld-actions">
                  <button type="submit" className="btn btn-gold px-7 py-4 text-base" disabled={query.trim().length < 3}>
                    Find my place
                  </button>
                  <span className="ld-fine">Real listings, read by the AI search. Sign in with your USC email to save them.</span>
                </div>
              </form>
            </div>
          </div>

          <footer className="ld-status">
            <span className="ld-status-text">Ready</span>
            <span className="ld-status-r">Sample listings near USC, not real offers</span>
          </footer>
        </div>
      </div>
    </section>
  )
}
