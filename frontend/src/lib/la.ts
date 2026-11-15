/* Los Angeles time: drives day/night lighting and gameday mode. */

const TZ = 'America/Los_Angeles'

export type LANow = { hour: number; minute: number; month: number; weekday: number; date: string }

/** The current wall-clock time in Los Angeles, whatever the visitor's own time zone. */
export function laNow(at = new Date()): LANow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      minute: 'numeric',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return {
    hour: Number(parts.hour) + Number(parts.minute) / 60,
    minute: Number(parts.minute),
    month: Number(parts.month),
    weekday,
    date: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
  }
}

// Approximate sunrise and sunset in LA, local clock time, by month (DST included).
const SUN: [number, number][] = [
  [6.95, 17.2], [6.7, 17.65], [6.6, 19.0], [6.5, 19.4], [5.95, 19.8], [5.7, 20.1],
  [5.85, 20.1], [6.2, 19.7], [6.6, 19.1], [7.0, 18.4], [6.4, 16.9], [6.8, 16.8],
]

export type Phase = 'night' | 'dawn' | 'day' | 'golden' | 'dusk'

export const PHASE_LABEL: Record<Phase, string> = {
  night: 'night',
  dawn: 'sunrise',
  day: 'daytime',
  golden: 'golden hour',
  dusk: 'dusk',
}

export function laPhase(now = laNow()): Phase {
  const [rise, set] = SUN[now.month - 1]
  const h = now.hour
  if (h < rise - 0.5 || h >= set + 0.75) return 'night'
  if (h < rise + 0.75) return 'dawn'
  if (h >= set) return 'dusk'
  if (h >= set - 1.1) return 'golden'
  return 'day'
}

/** Lighting for a 3D scene at a phase. Colors are hex numbers for three.js. */
export type Sky = { sun: number; sunIntensity: number; ambient: number; ambientIntensity: number; ember: number; glow: number; sparks: number }
export const SKY: Record<Phase, Sky> = {
  day: { sun: 0xfff1d6, sunIntensity: 2.8, ambient: 0xffffff, ambientIntensity: 0.75, ember: 0xff6a3d, glow: 25, sparks: 0.45 },
  golden: { sun: 0xffb347, sunIntensity: 3.2, ambient: 0xffd9a8, ambientIntensity: 0.55, ember: 0xff3d1a, glow: 70, sparks: 0.9 },
  dusk: { sun: 0xff6b5e, sunIntensity: 1.6, ambient: 0x8a6aa8, ambientIntensity: 0.45, ember: 0xff2a1a, glow: 85, sparks: 1 },
  dawn: { sun: 0xffc9a0, sunIntensity: 1.8, ambient: 0xbfa6c9, ambientIntensity: 0.5, ember: 0xff5a2a, glow: 45, sparks: 0.7 },
  night: { sun: 0x6f86ff, sunIntensity: 0.7, ambient: 0x4a4f8a, ambientIntensity: 0.4, ember: 0xff2a1a, glow: 110, sparks: 1 },
}

export function laTimeLabel(now = laNow()) {
  const h = Math.floor(now.hour)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(now.minute).padStart(2, '0')} ${suffix}`
}

/* ---------- Gameday ---------- */

/** College football Saturdays: September through the first week of December, LA time.
 *  `?gameday=1` previews it (and `?gameday=0` turns the preview off) for this tab. */
export function isGameday(now = laNow()): boolean {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('gameday')
    try {
      if (q === '1') sessionStorage.setItem('homie-gameday', '1')
      if (q === '0') sessionStorage.removeItem('homie-gameday')
      if (sessionStorage.getItem('homie-gameday') === '1') return true
    } catch {
      if (q === '1') return true
    }
  }
  const [, m, d] = now.date.split('-').map(Number)
  const season = (m >= 9 && m <= 11) || (m === 12 && d <= 7)
  return season && now.weekday === 6
}
