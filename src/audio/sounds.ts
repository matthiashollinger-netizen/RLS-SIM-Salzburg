/**
 * Synthesized dispatch-center soundscape — pure WebAudio, no assets.
 *
 * Mixer topology: per-channel GainNodes (ring/funk/gong/ui/ambient) → master
 * → destination. The AudioContext is created lazily and resumed on the first
 * user gesture (autoplay policy). Channel volumes persist to localStorage and
 * ramp live so running sounds react immediately.
 *
 * The looping ambient room bed lives in ambient.ts and is re-exported here so
 * consumers import everything from '../audio/sounds.ts'.
 */

export type SoundChannel = 'master' | 'ring' | 'funk' | 'gong' | 'ui' | 'ambient'

const SUB_CHANNELS = ['ring', 'funk', 'gong', 'ui', 'ambient'] as const
const VOLUME_STORAGE_KEY = 'rls-audio-volumes'

/** channels attenuated while TTS speaks (duck/unduck) */
const DUCKED_CHANNELS: ReadonlySet<SoundChannel> = new Set(['ambient', 'ring', 'funk'])
const DUCK_FACTOR = 0.3

let ctx: AudioContext | null = null
let master: GainNode | null = null
const channelNodes = new Map<SoundChannel, GainNode>()
let ringInterval: ReturnType<typeof setInterval> | null = null
let duckLevel = 0

const volumes: Record<SoundChannel, number> = {
  master: 0.5,
  ring: 0.7,
  funk: 0.5,
  gong: 0.6,
  ui: 0.5,
  ambient: 0.5,
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// load persisted volumes on init (malformed/absent data → defaults)
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOLUME_STORAGE_KEY) : null
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const ch of Object.keys(volumes) as SoundChannel[]) {
      const v = parsed[ch]
      if (typeof v === 'number' && Number.isFinite(v)) volumes[ch] = clamp01(v)
    }
  }
} catch {
  /* storage unavailable or corrupt — keep defaults */
}

function persistVolumes() {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(volumes))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** user volume × duck attenuation = actual GainNode target */
function effectiveVolume(channel: SoundChannel): number {
  const ducked = duckLevel > 0 && DUCKED_CHANNELS.has(channel)
  return volumes[channel] * (ducked ? DUCK_FACTOR : 1)
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof AudioContext === 'undefined') return null
  try {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = effectiveVolume('master')
    master.connect(ctx.destination)
    for (const ch of SUB_CHANNELS) {
      const g = ctx.createGain()
      g.gain.value = effectiveVolume(ch)
      g.connect(master)
      channelNodes.set(ch, g)
    }
  } catch {
    ctx = null
  }
  return ctx
}

function nodeFor(channel: SoundChannel): GainNode | null {
  ensureCtx()
  return channel === 'master' ? master : (channelNodes.get(channel) ?? null)
}

/** smooth ~50ms gain ramp so running sounds react to the mixer immediately */
function rampChannel(channel: SoundChannel, seconds = 0.05) {
  const node = nodeFor(channel)
  if (!ctx || !node) return
  const t = ctx.currentTime
  node.gain.cancelScheduledValues(t)
  node.gain.setValueAtTime(node.gain.value, t)
  node.gain.linearRampToValueAtTime(effectiveVolume(channel), t + seconds)
}

export function setVolume(channel: SoundChannel, v: number) {
  volumes[channel] = clamp01(v)
  persistVolumes()
  rampChannel(channel)
}

export function getVolume(channel: SoundChannel): number {
  return volumes[channel]
}

/**
 * Duck ambient/ring/funk to ~30 % (used while TTS speaks). Counter-based so
 * overlapping duck/unduck pairs cannot get stuck.
 */
export function duck() {
  duckLevel += 1
  if (duckLevel === 1) for (const ch of DUCKED_CHANNELS) rampChannel(ch, 0.15)
}

export function unduck() {
  duckLevel = Math.max(0, duckLevel - 1)
  if (duckLevel === 0) for (const ch of DUCKED_CHANNELS) rampChannel(ch, 0.25)
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

/** Running AudioContext for ambient.ts (null when WebAudio is unavailable). */
export function getAudioContext(): AudioContext | null {
  return ensureCtx()
}

/** Channel bus node for ambient.ts (null until the context exists). */
export function getChannelNode(channel: SoundChannel): GainNode | null {
  return nodeFor(channel)
}

/** cached 2 s white-noise buffer shared by all noise-based cues */
let cachedNoise: AudioBuffer | null = null

export function noiseBuffer(): AudioBuffer | null {
  const c = ensureCtx()
  if (!c) return null
  if (!cachedNoise) {
    const length = c.sampleRate * 2
    cachedNoise = c.createBuffer(1, length, c.sampleRate)
    const data = cachedNoise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return cachedNoise
}

interface EnvelopeOpts {
  /** 'lin' = attack/sustain/release (legacy beeps), 'exp' = percussive decay */
  decay?: 'lin' | 'exp'
  /** attack time in seconds (default 5 ms) */
  attack?: number
}

/** attack + linear-sustain or exponential-decay envelope on a gain param */
function applyEnvelope(
  param: AudioParam,
  t0: number,
  duration: number,
  peak: number,
  { decay = 'lin', attack = 0.005 }: EnvelopeOpts,
) {
  param.setValueAtTime(0, t0)
  param.linearRampToValueAtTime(peak, t0 + attack)
  if (decay === 'exp') {
    // exponential ramps cannot reach 0 — land near silence, then snap to 0
    param.exponentialRampToValueAtTime(Math.max(0.0008, peak * 0.002), t0 + duration)
    param.linearRampToValueAtTime(0, t0 + duration + 0.01)
  } else {
    param.setValueAtTime(peak, t0 + Math.max(attack, duration - 0.04))
    param.linearRampToValueAtTime(0, t0 + duration)
  }
}

export interface ToneOpts extends EnvelopeOpts {
  type?: OscillatorType
  /** optional biquad between oscillator and envelope (e.g. lowpass warmth) */
  filter?: { type: BiquadFilterType; freq: number; q?: number }
}

/** Schedule a single oscillator tone on a mixer channel. */
export function tone(
  freq: number,
  startIn: number,
  duration: number,
  peak: number,
  channel: SoundChannel = 'ui',
  opts: ToneOpts = {},
) {
  const c = ensureCtx()
  const out = nodeFor(channel)
  if (!c || !out || c.state !== 'running') return
  const osc = c.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.value = freq
  const gain = c.createGain()
  const t0 = c.currentTime + startIn
  applyEnvelope(gain.gain, t0, duration, peak, opts)
  let head: AudioNode = osc
  if (opts.filter) {
    const biq = c.createBiquadFilter()
    biq.type = opts.filter.type
    biq.frequency.value = opts.filter.freq
    biq.Q.value = opts.filter.q ?? 1
    head.connect(biq)
    head = biq
  }
  head.connect(gain)
  gain.connect(out)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

export interface NoiseOpts extends EnvelopeOpts {
  /** biquad applied to the noise (default bandpass) */
  type?: BiquadFilterType
  freq?: number
  q?: number
}

/** Schedule a filtered white-noise hit (clicks, squelch, room swells). */
export function noiseHit(
  startIn: number,
  duration: number,
  peak: number,
  channel: SoundChannel,
  opts: NoiseOpts = {},
) {
  const c = ensureCtx()
  const out = nodeFor(channel)
  const buf = noiseBuffer()
  if (!c || !out || !buf || c.state !== 'running') return
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const biq = c.createBiquadFilter()
  biq.type = opts.type ?? 'bandpass'
  biq.frequency.value = opts.freq ?? 2000
  biq.Q.value = opts.q ?? 1
  const gain = c.createGain()
  const t0 = c.currentTime + startIn
  applyEnvelope(gain.gain, t0, duration, peak, opts)
  src.connect(biq)
  biq.connect(gain)
  gain.connect(out)
  src.start(t0)
  src.stop(t0 + duration + 0.05)
}

/** Classic dual-tone phone ring burst, lowpassed for a little warmth. */
function ringBurst() {
  const warmth = { type: 'lowpass' as const, freq: 1600 }
  for (const at of [0, 0.5]) {
    tone(440, at, 0.4, 0.22, 'ring', { filter: warmth })
    tone(480, at, 0.4, 0.22, 'ring', { filter: warmth })
  }
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

/** Radio acknowledgement: squelch click + double blip (M7 Funk-Quittungstöne). */
export function funkQuittung() {
  noiseHit(0, 0.02, 0.18, 'funk', { freq: 1900, q: 1.2, decay: 'exp' })
  tone(1250, 0.025, 0.07, 0.16, 'funk', { decay: 'exp' })
  tone(950, 0.105, 0.08, 0.13, 'funk', { decay: 'exp' })
}

/** PTT key click — frame before an outgoing transmission (~5 ms). */
export function pttClick() {
  noiseHit(0, 0.005, 0.15, 'funk', { freq: 2500, q: 0.7, attack: 0.001 })
}

/** Squelch tail — ~80 ms noise fade after a transmission ends. */
export function squelchTail(startIn = 0) {
  noiseHit(startIn, 0.08, 0.12, 'funk', { freq: 2100, q: 1.4, decay: 'exp' })
}

/** Pager/alarm gong; the tone set scales with mission urgency. */
export function alarmGong(kind: 'routine' | 'sosi' | 'manv' = 'routine') {
  if (kind === 'sosi') {
    // three-note urgent variant: faster, brighter
    tone(784, 0, 0.18, 0.2, 'gong', { decay: 'exp' })
    tone(932, 0.14, 0.18, 0.2, 'gong', { decay: 'exp' })
    tone(1109, 0.28, 0.26, 0.2, 'gong', { decay: 'exp' })
  } else if (kind === 'manv') {
    // longer four-note sequence for mass-casualty alarms
    tone(660, 0, 0.3, 0.22, 'gong', { decay: 'exp' })
    tone(660, 0.34, 0.3, 0.22, 'gong', { decay: 'exp' })
    tone(880, 0.68, 0.3, 0.22, 'gong', { decay: 'exp' })
    tone(880, 1.02, 0.5, 0.22, 'gong', { decay: 'exp' })
  } else {
    // classic two-note pager gong
    tone(660, 0, 0.25, 0.22, 'gong')
    tone(520, 0.22, 0.35, 0.2, 'gong')
  }
}

/** Pager gong on alarm dispatch — kept as alias for existing callers. */
export function pagerGong() {
  alarmGong('routine')
}

/** Very quiet interface click (~10 ms, 2 kHz). */
export function uiTick() {
  noiseHit(0, 0.01, 0.05, 'ui', { freq: 2000, q: 2, decay: 'exp' })
}

/** Urgent double chime when a Hilfsfrist is about to lapse (GAME_DATA §11). */
export function hilfsfristAlert() {
  for (const at of [0, 0.26]) {
    tone(988, at, 0.12, 0.2, 'gong', { type: 'triangle', decay: 'exp' })
    tone(1319, at + 0.03, 0.18, 0.16, 'gong', { type: 'triangle', decay: 'exp' })
  }
}

/** Subtle two-note chime when a new Auftrag lands in the dispatch queue. */
export function neuerAuftragChime() {
  tone(660, 0, 0.1, 0.1, 'ui', { decay: 'exp' })
  tone(880, 0.11, 0.18, 0.1, 'ui', { decay: 'exp' })
}

/** Rising major arpeggio (C5–E5–G5–C6) for unlocked achievements. */
export function achievementFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => {
    tone(f, i * 0.13, 0.5, 0.15, 'ui', { type: 'triangle', decay: 'exp' })
  })
}

/** Short resolved cadence (V → I) when the shift report opens. */
export function reportSting() {
  for (const f of [392, 493.88, 587.33]) tone(f, 0, 0.28, 0.08, 'ui', { decay: 'exp' })
  for (const f of [523.25, 659.25, 783.99]) tone(f, 0.3, 0.6, 0.09, 'ui', { decay: 'exp' })
}

/** Representative cue per channel for the settings-mixer preview buttons. */
export function previewChannel(channel: SoundChannel) {
  switch (channel) {
    case 'ring':
      ringBurst()
      break
    case 'funk':
      pttClick()
      funkQuittung()
      squelchTail(0.2)
      break
    case 'gong':
      alarmGong('routine')
      break
    case 'ui':
      neuerAuftragChime()
      break
    case 'ambient':
      // audible room-tone swell (the live bed itself is far quieter)
      noiseHit(0, 1.2, 0.25, 'ambient', { type: 'lowpass', freq: 380, attack: 0.3, decay: 'exp' })
      break
    case 'master':
      achievementFanfare()
      break
  }
}

// ambient room bed (see ambient.ts) — re-exported per the audio API contract
export { startAmbient, stopAmbient, setAmbientEnabled, isAmbientEnabled } from './ambient.ts'
