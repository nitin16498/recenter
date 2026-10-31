import { getSettings } from './settings.js'

// Celebrations (REC-30, design/task-steps.html). Plays on forward moves only:
// a step done, a card moving forward, a task done. Style and duration come
// from Settings. Particles live in one fixed layer above everything and never
// block clicks; nothing plays for prefers-reduced-motion.
//
//   celebrate(rect, tier, { around })
//     tier:   'step' < 'move' < 'done' (more pieces, further, bigger)
//     around: burst out of the whole outline of `rect` (board cards) instead
//             of from its centre (buttons)

// Fixed confetti palette: reads on both themes, so it isn't theme tokens.
const COLORS = ['#378add', '#f2a93b', '#e8735a', '#4fb286', '#9b7be0', '#f4c542']
const ACCENT = COLORS[0]

const TIERS = {
  step: { n: 22, dist: [40, 78], size: 1, words: ['Nice!', 'Yes!', 'One down', 'Keep going', 'Done!', 'Good move'] },
  move: { n: 30, dist: [48, 92], size: 1.1, words: ['On the move', 'Here we go', 'Started!', 'Momentum'] },
  done: { n: 46, dist: [70, 130], size: 1.25, words: ['Task done!', 'Crushed it', "That's a wrap", 'Nailed it'] },
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

let layer = null
function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div')
    layer.className = 'fx-layer'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)
  }
  return layer
}

function el(className, css) {
  const node = document.createElement('span')
  node.className = className
  if (css) node.style.cssText = css
  fxLayer().appendChild(node)
  return node
}

const durationMs = () => getSettings().fxSeconds * 1000
const fallPx = () => 50 + 60 * (durationMs() / 1000) // longer bursts fall further

export function celebrate(rect, tier = 'step', { around = false } = {}) {
  const { fxStyle } = getSettings()
  if (fxStyle === 'off' || !rect || reducedMotion()) return
  const T = TIERS[tier] ?? TIERS.step
  if (around) return aroundRect(rect, T, fxStyle)
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  if (fxStyle === 'confetti') confetti(cx, cy, T, 0, Math.PI * 2)
  if (fxStyle === 'sparks') sparks(cx, cy, T, rect)
  if (fxStyle === 'popper') {
    confetti(cx, cy, T, -Math.PI * 0.85, -Math.PI * 0.15, true)
    cheer(cx, rect.top, T)
  }
}

// A card that moved forward gets a quick bump and glow.
export function bump(node) {
  if (!node || getSettings().fxStyle === 'off' || reducedMotion()) return
  node.animate(
    [
      { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
      { transform: 'scale(1.035)', boxShadow: '0 0 0 4px var(--accent-bg)', offset: 0.4 },
      { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
    ],
    { duration: 380, easing: EASE },
  )
}

function particle(x, y, k = 1) {
  const shape = Math.random()
  const w = (shape < 0.4 ? rand(6, 8) : rand(4, 5)) * k
  const h = shape < 0.4 ? w : rand(9, 12) * k
  return el(
    'fx',
    `width:${w}px;height:${h}px;background:${pick(COLORS)};border-radius:${shape < 0.25 ? '50%' : '1px'};left:${x}px;top:${y}px`,
  )
}

// Shoot out to (dx, dy), then fall under gravity with a little sway.
function fallFrames(dx, dy, spin, { s0 = 0.4, o0 = 1 } = {}) {
  const fall = fallPx() * rand(0.8, 1.2)
  const sway = rand(-16, 16)
  const at = (x, y) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  return [
    { offset: 0, transform: `translate(-50%, -50%) scale(${s0})`, opacity: o0, easing: 'cubic-bezier(.15, .75, .35, 1)' },
    { offset: 0.2, transform: `${at(dx, dy)} rotate(${spin * 0.25}deg) scale(1)`, opacity: 1, easing: 'cubic-bezier(.4, 0, .8, .6)' },
    { offset: 0.55, transform: `${at(dx * 1.06 + sway, dy + fall * 0.35)} rotate(${spin * 0.6}deg) scale(1)`, opacity: 1, easing: 'linear' },
    { offset: 0.82, transform: `${at(dx * 1.1 - sway * 0.4, dy + fall * 0.72)} rotate(${spin * 0.85}deg) scale(.95)`, opacity: 0.9, easing: 'linear' },
    { offset: 1, transform: `${at(dx * 1.12, dy + fall)} rotate(${spin}deg) scale(.85)`, opacity: 0 },
  ]
}

function run(node, frames, options) {
  node.animate(frames, options).finished.then(
    () => node.remove(),
    () => node.remove(),
  )
}

// Burst out between angles a0..a1, then fall.
function confetti(cx, cy, T, a0, a1, cone = false) {
  for (let i = 0; i < T.n; i++) {
    const a = a0 + (a1 - a0) * ((i + Math.random() * 0.8) / T.n)
    const d = rand(...T.dist) * (cone ? 1.15 : 1)
    run(particle(cx, cy, T.size), fallFrames(Math.cos(a) * d, Math.sin(a) * d, rand(-420, 420)), {
      duration: durationMs() * rand(0.88, 1.12),
    })
  }
}

// A streak that flies outward, then droops and falls. Gravity is applied in
// screen space, before the rotation.
function spark(x, y, a, d, T, r0 = 0) {
  const len = rand(13, 20) * T.size
  const node = el(
    'fx',
    `width:${len}px;height:3.5px;border-radius:2px;background:${pick(COLORS)};left:${x}px;top:${y}px;transform-origin:0 50%`,
  )
  const deg = (a * 180) / Math.PI
  const fall = fallPx() * 0.7 * rand(0.8, 1.2)
  const f = (drop, r, sx) => `translateY(${drop}px) translateY(-50%) rotate(${deg}deg) translateX(${r}px) scaleX(${sx})`
  run(
    node,
    [
      { offset: 0, transform: f(0, r0, 0.3), opacity: 1, easing: 'cubic-bezier(.2, .8, .3, 1)' },
      { offset: 0.3, transform: f(0, d, 1), opacity: 1, easing: 'cubic-bezier(.4, 0, .8, .6)' },
      { offset: 0.75, transform: f(fall * 0.55, d * 1.15, 0.7), opacity: 0.85, easing: 'linear' },
      { offset: 1, transform: f(fall, d * 1.22, 0.3), opacity: 0 },
    ],
    { duration: durationMs() * rand(0.85, 1.1), delay: rand(0, 60), fill: 'backwards' },
  )
}

function sparks(cx, cy, T, rect) {
  const size = Math.max(rect.height, 24)
  run(
    el('fx', `width:${size}px;height:${size}px;left:${cx}px;top:${cy}px;border-radius:50%;border:2px solid ${ACCENT}`),
    [
      { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0.7 },
      { transform: 'translate(-50%, -50%) scale(2.2)', opacity: 0 },
    ],
    { duration: 600, easing: EASE },
  )
  const n = Math.round(T.n * 0.75)
  for (let i = 0; i < n; i++) {
    spark(cx, cy, (i / n) * Math.PI * 2 + rand(-0.14, 0.14), rand(...T.dist) * 0.85, T, size * 0.45)
  }
}

function cheer(cx, top, T, big = false) {
  const node = el(`fx-word${big ? ' big' : ''}`, `left:${cx}px;top:${top}px`)
  node.textContent = pick(T.words)
  run(
    node,
    [
      { transform: 'translate(-50%, -60%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%, -140%) scale(1.06)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -170%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -210%) scale(.96)', opacity: 0 },
    ],
    { duration: Math.max(1100, durationMs() * 0.9), easing: EASE },
  )
}

// A random point on the outline plus the outward direction there. Popper
// favours the top edge so its confetti goes up.
function edgePoint(r, upward) {
  const w = r.width
  const h = r.height
  const sides = upward
    ? [['top', w * 1.6], ['left', h], ['right', h], ['bottom', w * 0.3]]
    : [['top', w], ['bottom', w], ['left', h], ['right', h]]
  let roll = Math.random() * sides.reduce((sum, [, len]) => sum + len, 0)
  let side = sides[0][0]
  for (const [name, len] of sides) {
    if ((roll -= len) <= 0) {
      side = name
      break
    }
  }
  const t = Math.random()
  const j = rand(-0.45, 0.45)
  if (side === 'top') return { x: r.left + t * w, y: r.top, a: -Math.PI / 2 + j + (t - 0.5) * 0.9 }
  if (side === 'bottom') return { x: r.left + t * w, y: r.bottom, a: Math.PI / 2 + j - (t - 0.5) * 0.9 }
  if (side === 'left') return { x: r.left, y: r.top + t * h, a: Math.PI + j - (t - 0.5) * 0.7 }
  return { x: r.right, y: r.top + t * h, a: j + (t - 0.5) * 0.7 }
}

function aroundRect(r, T, style) {
  // The card's outline flashes and expands outward once.
  run(
    el('fx', `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:10px;border:2px solid ${ACCENT}`),
    [
      { transform: 'scale(1)', opacity: 0.8 },
      { transform: `scale(${1 + 24 / r.width}, ${1 + 24 / r.height})`, opacity: 0 },
    ],
    { duration: 520, easing: EASE },
  )
  const count = Math.round(T.n * 1.25)
  for (let i = 0; i < count; i++) {
    const { x, y, a } = edgePoint(r, style === 'popper')
    const d = rand(...T.dist) * 0.62
    if (style === 'sparks') {
      spark(x, y, a, d, T)
      continue
    }
    run(
      particle(x, y, T.size * 1.15),
      fallFrames(Math.cos(a) * d, Math.sin(a) * d, rand(-460, 460), { s0: 0.3, o0: 0 }),
      { duration: durationMs() * rand(0.88, 1.12), delay: rand(0, 90), fill: 'backwards' },
    )
  }
  if (style === 'popper') cheer(r.left + r.width / 2, r.top, T, true)
}
