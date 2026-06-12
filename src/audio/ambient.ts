/**
 * Ambient dispatch-room bed: a looping lowpassed-noise room tone plus a
 * sparse scheduler for distant props (muffled desk phone, keyboard clusters,
 * far-away radio blips). Everything routes through the 'ambient' mixer
 * channel in sounds.ts, so the settings mixer and TTS ducking apply.
 *
 * UI-side audio: wall-clock timers and Math.random are allowed HERE
 * (deterministic seeded RNG is only required inside src/engine).
 */

import { getAudioContext, getChannelNode, noiseBuffer, noiseHit, tone } from './sounds.ts'

const ENABLED_STORAGE_KEY = 'rls-ambient-enabled'
const BED_GAIN = 0.02
const BED_LOWPASS_HZ = 350
/** prop scheduler jitter: 8–30 s between distant props */
const PROP_MIN_MS = 8000
const PROP_JITTER_MS = 22000

let desired = false // startAmbient() called and not yet stopped
let enabled = true // user toggle (persisted, default ON)
let bedSource: AudioBufferSourceNode | null = null
let bedGain: GainNode | null = null
let propTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let visibilityHooked = false

try {
  if (typeof localStorage !== 'undefined') {
    enabled = localStorage.getItem(ENABLED_STORAGE_KEY) !== '0'
  }
} catch {
  /* default ON */
}

export function isAmbientEnabled(): boolean {
  return enabled
}

/** Settings toggle: stops/starts the bed live and persists the choice. */
export function setAmbientEnabled(v: boolean) {
  enabled = v
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, v ? '1' : '0')
  } catch {
    /* storage may be unavailable */
  }
  if (v) tryStart()
  else teardown()
}

/** Idempotent — safe to call on every GamePage mount. */
export function startAmbient() {
  desired = true
  tryStart()
}

export function stopAmbient() {
  desired = false
  teardown()
}

function tryStart() {
  if (!desired || !enabled || bedSource) return
  const c = getAudioContext()
  const out = getChannelNode('ambient')
  const buf = noiseBuffer()
  if (!c || !out || !buf || c.state !== 'running') {
    // autoplay policy: the context resumes on the first gesture
    // (see sounds.ts unlock) — poll until it is running
    if (!retryTimer && typeof AudioContext !== 'undefined') {
      retryTimer = setTimeout(() => {
        retryTimer = null
        tryStart()
      }, 1000)
    }
    return
  }
  // room tone: looping white noise through a low lowpass, faded in gently
  bedSource = c.createBufferSource()
  bedSource.buffer = buf
  bedSource.loop = true
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = BED_LOWPASS_HZ
  bedGain = c.createGain()
  bedGain.gain.setValueAtTime(0, c.currentTime)
  bedGain.gain.linearRampToValueAtTime(BED_GAIN, c.currentTime + 2)
  bedSource.connect(lp)
  lp.connect(bedGain)
  bedGain.connect(out)
  bedSource.start()
  if (!visibilityHooked && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
    visibilityHooked = true
  }
  scheduleProp()
}

function teardown() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (propTimer) {
    clearTimeout(propTimer)
    propTimer = null
  }
  if (visibilityHooked) {
    document.removeEventListener('visibilitychange', onVisibility)
    visibilityHooked = false
  }
  if (bedSource) {
    const src = bedSource
    const c = getAudioContext()
    if (c && bedGain) {
      const t = c.currentTime
      bedGain.gain.cancelScheduledValues(t)
      bedGain.gain.setValueAtTime(bedGain.gain.value, t)
      bedGain.gain.linearRampToValueAtTime(0, t + 0.3)
    }
    setTimeout(() => {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      src.disconnect()
    }, 350)
    bedSource = null
    bedGain = null
  }
}

/** pause the prop scheduler while the tab is hidden (phones still ring) */
function onVisibility() {
  if (document.hidden) {
    if (propTimer) {
      clearTimeout(propTimer)
      propTimer = null
    }
  } else if (bedSource && !propTimer) {
    scheduleProp()
  }
}

function scheduleProp() {
  if (propTimer) clearTimeout(propTimer)
  propTimer = setTimeout(
    () => {
      propTimer = null
      if (!bedSource) return
      if (!document.hidden) playRandomProp()
      scheduleProp()
    },
    PROP_MIN_MS + Math.random() * PROP_JITTER_MS,
  )
}

function playRandomProp() {
  const pick = Math.random()
  if (pick < 0.4) muffledPhone()
  else if (pick < 0.75) keyboardCluster()
  else radioBlip()
}

/** a colleague's desk phone: ring dual-tone, highpassed thin and very quiet */
function muffledPhone() {
  const thin = { type: 'highpass' as const, freq: 1100 }
  for (const at of [0, 0.45]) {
    tone(440, at, 0.3, 0.016, 'ambient', { filter: thin })
    tone(480, at, 0.3, 0.016, 'ambient', { filter: thin })
  }
}

/** someone typing nearby: 4–8 tiny noise clicks with jittered spacing */
function keyboardCluster() {
  const count = 4 + Math.floor(Math.random() * 5)
  let at = 0
  for (let i = 0; i < count; i++) {
    at += 0.06 + Math.random() * 0.14
    noiseHit(at, 0.008, 0.008 + Math.random() * 0.006, 'ambient', {
      freq: 3200 + Math.random() * 1800,
      q: 1.5,
    })
  }
}

/** far-away radio traffic: short squelch + faint blip */
function radioBlip() {
  noiseHit(0, 0.05, 0.012, 'ambient', { freq: 1700, q: 1.2, decay: 'exp' })
  tone(1150, 0.05, 0.06, 0.01, 'ambient', { decay: 'exp' })
}
