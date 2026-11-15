/** A flat illustration of a room, drawn for listings that have no photos yet. Everything is
 *  derived from the listing id, so a listing always gets the same picture, and the furniture
 *  follows the kind of space: a bed for rooms and studios, a sofa for whole units. */

function rng(seed: number) {
  let a = seed * 2654435761
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WALLS = ['#efe6d8', '#e2e8df', '#dde5ee', '#f0ddd0', '#e6dfea', '#f2e8cc', '#e9e4dc']
const FLOORS = ['#c49a6c', '#a87b52', '#d6b38a', '#8f6a4c', '#b98d63']
const FABRICS = ['#990000', '#2f4a6d', '#6f8a55', '#d99a2b', '#5b4b7a', '#c2644a', '#3f6f6a']
const RUGS = ['#f4efe6', '#d9c4a5', '#b7c4cf', '#e7c9b8', '#cfd8c4']
const ART = ['#990000', '#ffcc00', '#2f4a6d', '#e07a5f', '#6f8a55', '#f2cc8f']
const SKIES: [string, string][] = [
  ['#8ec9ee', '#e6f4fb'],
  ['#ffae6b', '#ffe3b3'],
  ['#6e79c9', '#f3a7a0'],
  ['#9fd8e8', '#fdf2d9'],
]

export function kindOf(title: string): 'room' | 'studio' | 'whole' {
  if (/studio/i.test(title)) return 'studio'
  if (/(whole|entire)\b|take over my \d-bed|\d-bed lease/i.test(title) && !/\broom\b/i.test(title)) return 'whole'
  return 'room'
}

export function RoomArt({ id, title, className = '' }: { id: number; title: string; className?: string }) {
  const r = rng(id + 7)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const kind = kindOf(title)
  const left = r() < 0.5
  const wall = pick(WALLS)
  const floor = pick(FLOORS)
  const fabric = pick(FABRICS)
  const rug = pick(RUGS)
  const [skyTop, skyBottom] = pick(SKIES)
  const palms = r() < 0.6
  const art1 = pick(ART)
  const art2 = pick(ART.filter((c) => c !== art1))
  const pendant = r() < 0.5
  r() // keeps the sequence stable
  // The plant stands on the window side, clear of the bed or sofa.
  const plantRight = !left
  const chair = pick(FABRICS.filter((c) => c !== fabric))
  const g = `ra${id}`

  // Window on one side, the bed or sofa (with art above it) on the other.
  const winX = left ? 46 : 244
  const artX = left ? 262 : 58
  const furnX = left ? 214 : 26
  const deskX = left ? 52 : 250

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="Illustration of the space (no photos uploaded yet)"
    >
      <defs>
        <linearGradient id={`${g}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id={`${g}l`} x1={left ? '0' : '1'} y1="0" x2={left ? '1' : '0'} y2="0.4">
          <stop offset="0" stopColor="#fff8e6" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#fff8e6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${g}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* wall and floor */}
      <rect width="400" height="216" fill={wall} />
      <rect y="216" width="400" height="84" fill={floor} />
      <rect y="216" width="400" height="18" fill={`url(#${g}f)`} />
      <rect y="211" width="400" height="5" fill="#000" opacity="0.08" />
      {[238, 260, 284].map((y) => (
        <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#000" strokeOpacity="0.08" />
      ))}
      {[60, 150, 250, 330].map((x, i) => (
        <line key={x} x1={x + (i % 2) * 30} x2={x + (i % 2) * 30} y1={i % 2 ? 238 : 260} y2={i % 2 ? 260 : 284} stroke="#000" strokeOpacity="0.08" />
      ))}

      {/* window */}
      <rect x={winX - 6} y="34" width="122" height="112" rx="4" fill="#fbf7ef" />
      <rect x={winX} y="40" width="110" height="100" fill={`url(#${g}s)`} />
      {skyTop === '#ffae6b' && <circle cx={winX + 78} cy="96" r="16" fill="#fff1c7" opacity="0.9" />}
      <path d={`M${winX} 140 L${winX} 118 L${winX + 22} 112 L${winX + 40} 120 L${winX + 62} 108 L${winX + 86} 116 L${winX + 110} 110 L${winX + 110} 140 Z`} fill="#000" opacity="0.18" />
      {palms && (
        <g fill="#2e3b2a" opacity="0.75">
          <path d={`M${winX + 30} 140 C${winX + 32} 118 ${winX + 30} 100 ${winX + 36} 78`} stroke="#2e3b2a" strokeWidth="3" fill="none" />
          {[-60, -25, 10, 45, 80, 150].map((a) => (
            <ellipse key={a} cx={winX + 36} cy="78" rx="15" ry="3.2" transform={`rotate(${a} ${winX + 36} 78) translate(12 0)`} />
          ))}
          <path d={`M${winX + 84} 140 C${winX + 83} 122 ${winX + 86} 110 ${winX + 82} 94`} stroke="#2e3b2a" strokeWidth="2.4" fill="none" />
          {[-50, -10, 30, 70, 160].map((a) => (
            <ellipse key={a} cx={winX + 82} cy="94" rx="11" ry="2.6" transform={`rotate(${a} ${winX + 82} 94) translate(9 0)`} />
          ))}
        </g>
      )}
      <line x1={winX + 55} x2={winX + 55} y1="40" y2="140" stroke="#fbf7ef" strokeWidth="4" />
      <line x1={winX} x2={winX + 110} y1="90" y2="90" stroke="#fbf7ef" strokeWidth="4" />
      <rect x={winX - 10} y="144" width="130" height="7" rx="2" fill="#f4eee2" />
      <rect x={winX - 10} y="150" width="130" height="3" fill="#000" opacity="0.08" />

      {/* wall art */}
      <rect x={artX} y="52" width="78" height="58" rx="2" fill="#2b2420" />
      <rect x={artX + 5} y="57" width="68" height="48" fill="#f7f1e6" />
      <circle cx={artX + 28} cy="78" r="13" fill={art1} />
      <rect x={artX + 40} y="70" width="24" height="26" fill={art2} opacity="0.9" />
      <rect x={artX + 14} y="92" width="40" height="4" fill="#2b2420" opacity="0.5" />

      {pendant && (
        <g>
          <line x1="200" x2="200" y1="0" y2="44" stroke="#2b2420" strokeWidth="1.5" />
          <path d="M184 58 Q200 38 216 58 Z" fill="#2b2420" />
          <ellipse cx="200" cy="59" rx="9" ry="2.4" fill="#ffe7a8" />
        </g>
      )}

      {/* rug */}
      <ellipse cx="200" cy="268" rx="120" ry="20" fill={rug} opacity="0.95" />
      <ellipse cx="200" cy="268" rx="104" ry="15" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="2" />

      {kind === 'whole' ? (
        // sofa and coffee table
        <g>
          <rect x={furnX + 6} y="164" width="148" height="40" rx="10" fill={fabric} />
          <rect x={furnX} y="186" width="160" height="40" rx="9" fill={fabric} />
          <rect x={furnX + 14} y="188" width="64" height="16" rx="6" fill="#fff" opacity="0.12" />
          <rect x={furnX + 82} y="188" width="64" height="16" rx="6" fill="#fff" opacity="0.12" />
          <rect x={furnX - 4} y="176" width="16" height="50" rx="7" fill={fabric} />
          <rect x={furnX + 148} y="176" width="16" height="50" rx="7" fill={fabric} />
          <rect x={furnX + 4} y="226" width="152" height="5" fill="#000" opacity="0.12" />
          <rect x={furnX + 24} y="174" width="26" height="20" rx="5" fill={art2} opacity="0.85" />
          <rect x="150" y="242" width="100" height="10" rx="3" fill="#7a5a3e" />
          <rect x="160" y="252" width="5" height="14" fill="#5a412d" />
          <rect x="235" y="252" width="5" height="14" fill="#5a412d" />
          <rect x="185" y="232" width="16" height="10" rx="2" fill="#f7f1e6" />
        </g>
      ) : (
        // bed
        <g>
          <rect x={furnX + 4} y="140" width="152" height="70" rx="8" fill="#6b4f3a" />
          <rect x={furnX} y="190" width="160" height="46" rx="6" fill="#f7f3ea" />
          <rect x={furnX} y="204" width="160" height="34" rx="6" fill={fabric} />
          <rect x={furnX} y="204" width="160" height="6" fill="#fff" opacity="0.15" />
          <rect x={furnX + 14} y="176" width="56" height="20" rx="8" fill="#ffffff" />
          <rect x={furnX + 88} y="176" width="56" height="20" rx="8" fill="#ffffff" />
          <rect x={furnX + 4} y="238" width="152" height="5" fill="#000" opacity="0.12" />
        </g>
      )}

      {/* desk under the window */}
      {kind !== 'whole' && (
        <g>
          <rect x={deskX} y="182" width="96" height="7" rx="2" fill="#7a5a3e" />
          <rect x={deskX + 6} y="189" width="5" height="44" fill="#5a412d" />
          <rect x={deskX + 85} y="189" width="5" height="44" fill="#5a412d" />
          <rect x={deskX + 22} y="168" width="30" height="14" rx="2" fill="#2b2b33" />
          <rect x={deskX + 16} y="180" width="42" height="3" rx="1" fill="#3b3b45" />
          <line x1={deskX + 76} x2={deskX + 76} y1="182" y2="160" stroke="#2b2420" strokeWidth="2" />
          <path d={`M${deskX + 66} 162 L${deskX + 86} 162 L${deskX + 80} 150 L${deskX + 72} 150 Z`} fill={art1} />
        </g>
      )}

      {/* armchair under the window in whole units */}
      {kind === 'whole' && (
        <g>
          <rect x={deskX + 22} y="176" width="58" height="34" rx="9" fill={chair} />
          <rect x={deskX + 16} y="194" width="70" height="30" rx="8" fill="#000" opacity="0.12" />
          <rect x={deskX + 18} y="192" width="66" height="30" rx="8" fill={chair} />
          <rect x={deskX + 18} y="192" width="66" height="8" rx="4" fill="#fff" opacity="0.14" />
          <rect x={deskX + 26} y="222" width="5" height="12" fill="#5a412d" />
          <rect x={deskX + 72} y="222" width="5" height="12" fill="#5a412d" />
        </g>
      )}

      {/* plant */}
      <g transform={`translate(${plantRight ? 356 : 18} 0)`}>
        <path d="M6 236 L30 236 L26 262 L10 262 Z" fill="#c8754a" />
        {[-40, -15, 10, 35, -65, 60].map((a, i) => (
          <ellipse key={a} cx="18" cy="226" rx="6" ry="20" fill={i % 2 ? '#4f7a4a' : '#3f6a3c'} transform={`rotate(${a} 18 236)`} />
        ))}
      </g>

      <rect width="400" height="300" fill={`url(#${g}l)`} />
    </svg>
  )
}
