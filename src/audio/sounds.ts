/**
 * Synthesized UI sounds (no assets): phone ring, radio quittung, pager gong.
 * AudioContext is created on the first user gesture (autoplay policy).
 * Volume mixer arrives in M10 — until then a single master gain.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let ringInterval: ReturnType<typeof setInterval> | null = null

const volumes = { master: 0.5, ring: 0.7, funk: 0.5, gong: 0.6 }

export function setVolume(channel: keyof typeof volumes, v: number) {
  volumes[channel] = Math.min(1, Math.max(0, v))
  if (channel === 'master' && master) master.gain.value = volumes.master
}

export function getVolume(channel: keyof typeof volumes): number {
  return volumes[channel]
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof AudioContext === 'undefined') return null
  try {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = volumes.master
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

// unlock on first gesture
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = ensureCtx()
    if (c?.state === 'suspended') void c.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(freq: number, startIn: number, duration: number, gainValue: number) {
  const c = ensureCtx()
  if (!c || !master || c.state !== 'running') return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = c.currentTime + startIn
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainValue, t0 + 0.02)
  gain.gain.setValueAtTime(gainValue, t0 + duration - 0.04)
  gain.gain.linearRampToValueAtTime(0, t0 + duration)
  osc.connect(gain)
  gain.connect(master)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

/** Classic dual-tone phone ring burst. */
function ringBurst() {
  tone(440, 0, 0.4, 0.25 * volumes.ring)
  tone(480, 0, 0.4, 0.25 * volumes.ring)
  tone(440, 0.5, 0.4, 0.25 * volumes.ring)
  tone(480, 0.5, 0.4, 0.25 * volumes.ring)
}

export function startRinging() {
  if (ringInterval) return
  ringBurst()
  ringInterval = setInterval(ringBurst, 2500)
}

export function stopRinging() {
  if (ringInterval) {
    clearInterval(ringInterval)
    ringInterval = null
  }
}

/** Radio acknowledgement click (M7 Funk-Quittungstöne). */
export function funkQuittung() {
  tone(1200, 0, 0.07, 0.2 * volumes.funk)
  tone(900, 0.09, 0.07, 0.18 * volumes.funk)
}

/** Pager gong on alarm dispatch. */
export function pagerGong() {
  tone(660, 0, 0.25, 0.22 * volumes.gong)
  tone(520, 0.22, 0.35, 0.2 * volumes.gong)
}
