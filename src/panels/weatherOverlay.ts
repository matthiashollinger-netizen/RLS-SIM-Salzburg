import { useGameStore } from '../state/gameStore.ts'

/**
 * Canvas precipitation overlay for the Lagekarte (atmosphere pass).
 * weather === 'schlecht' → diagonal rain streaks, or slow sine-drifting snow
 * in winter. Pure UI eye-candy: the rAF loop only runs while precipitation is
 * active AND the tab is visible — otherwise it fully stops and the canvas is
 * cleared. Under prefers-reduced-motion the animation is skipped entirely and
 * a static subtle fog tint is shown instead.
 *
 * Visual-only code: performance.now()/Math.random are fine here (not engine).
 */

type Mode = 'rain' | 'snow'

interface Particle {
  x: number
  y: number
  /** rain: streak length px */
  len: number
  /** snow: flake radius px */
  r: number
  /** fall speed px/s */
  v: number
  /** snow: sine drift phase */
  phase: number
  /** snow: sine drift amplitude px */
  amp: number
}

const PARTICLE_COUNT = 140
const RAIN_SLANT = 0.32 // horizontal drift per vertical px (diagonal streaks)
const MAX_FRAME_DT = 0.1 // s — avoid teleporting particles after a stall

export function attachWeatherOverlay(container: HTMLElement): () => void {
  const canvas = document.createElement('canvas')
  canvas.className = 'map-weather-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  let raf = 0
  let running = false
  let mode: Mode = 'rain'
  let lastTs = 0
  let particles: Particle[] = []
  // concrete particle color read from a design token at runtime
  let color = '#a8b3c5'

  const resize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
  }

  const spawn = (m: Mode): Particle => {
    const w = Math.max(1, canvas.width)
    const h = Math.max(1, canvas.height)
    return m === 'rain'
      ? {
          x: Math.random() * w,
          y: Math.random() * h,
          len: 10 + Math.random() * 8,
          r: 0,
          v: 540 + Math.random() * 360,
          phase: 0,
          amp: 0,
        }
      : {
          x: Math.random() * w,
          y: Math.random() * h,
          len: 0,
          r: 1 + Math.random() * 1.6,
          v: 25 + Math.random() * 30,
          phase: Math.random() * Math.PI * 2,
          amp: 8 + Math.random() * 14,
        }
  }

  const initParticles = (m: Mode) => {
    particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawn(m))
  }

  const frame = (ts: number) => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (!ctx || canvas.width === 0 || canvas.height === 0) return
    const dt = Math.min(MAX_FRAME_DT, Math.max(0.001, (ts - lastTs) / 1000))
    lastTs = ts
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    if (mode === 'rain') {
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const p of particles) {
        p.y += p.v * dt
        p.x += p.v * RAIN_SLANT * dt
        if (p.y - p.len > h) {
          p.y = -p.len
          p.x = Math.random() * w
        }
        if (p.x - p.len * RAIN_SLANT > w) p.x -= w + p.len * RAIN_SLANT
        ctx.moveTo(p.x - p.len * RAIN_SLANT, p.y - p.len)
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    } else {
      ctx.globalAlpha = 0.7
      for (const p of particles) {
        p.y += p.v * dt
        if (p.y - p.r > h) {
          p.y = -p.r
          p.x = Math.random() * w
        }
        const x = p.x + Math.sin(ts / 1250 + p.phase) * p.amp
        ctx.beginPath()
        ctx.arc(((x % w) + w) % w, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  const start = (m: Mode) => {
    resize()
    color = getComputedStyle(container).getPropertyValue('--text-secondary').trim() || color
    if (mode !== m || particles.length === 0) {
      mode = m
      initParticles(m)
    }
    if (!running) {
      running = true
      lastTs = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  const stop = () => {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }

  const evaluate = () => {
    const g = useGameStore.getState()
    const active = g.weather === 'schlecht'
    // reduced motion: no particle animation — static fog tint instead
    canvas.classList.toggle('weather-fog', active && reduced.matches)
    if (!active || reduced.matches || document.visibilityState !== 'visible') {
      stop()
      return
    }
    start(g.season === 'winter' ? 'snow' : 'rain')
  }

  const unsub = useGameStore.subscribe((s, prev) => {
    if (s.weather !== prev.weather || s.season !== prev.season) evaluate()
  })
  const onVisibility = () => evaluate()
  document.addEventListener('visibilitychange', onVisibility)
  reduced.addEventListener('change', evaluate)
  const ro = new ResizeObserver(() => resize())
  ro.observe(container)
  evaluate()

  return () => {
    stop()
    unsub()
    document.removeEventListener('visibilitychange', onVisibility)
    reduced.removeEventListener('change', evaluate)
    ro.disconnect()
    canvas.remove()
  }
}
