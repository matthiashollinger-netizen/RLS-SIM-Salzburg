import { create } from 'zustand'
import { useGameStore } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useCallStore } from './callStore.ts'
import { vehicleSim } from './simulation.ts'

/**
 * Live KPI sampling for the Lagebild window (AAA pass): every 30 sim-seconds
 * one sample of open incidents, rolling Hilfsfrist quota, fleet engagement
 * and call-queue length is pushed into a fixed-size ring buffer.
 *
 * Sampling piggybacks on the game clock via a module-level subscription —
 * no own timer, no React involvement. Consumers (LagebildPanel) subscribe to
 * the buffer, which changes at most once per 30 sim-seconds (≤ 1 Hz real
 * time even at 4× speed), keeping re-renders off the 250 ms tick path.
 */

export interface KpiSample {
  /** sim-clock timestamp (seconds) */
  t: number
  /** Aufträge not yet abgeschlossen (Übungen excluded) */
  offeneEinsaetze: number
  /** rolling quota over closed Aufträge with a Hilfsfrist deadline; null = none yet */
  hilfsfristQuote: number | null
  /** engaged units / on-duty units, 0..1 (GAME_DATA §10: statuses 1–5 = engaged) */
  flottenauslastung: number
  /** ringing calls waiting for the calltaker */
  queueLen: number
}

const SAMPLE_INTERVAL_SEC = 30
const MAX_SAMPLES = 240 // ≈ 2 h of history

interface KpiState {
  samples: KpiSample[]
}

export const useKpiStore = create<KpiState>(() => ({ samples: [] }))

/** Mission statuses — unit counts as engaged (GAME_DATA §10 lifecycle 1–5). */
const ENGAGED_STATUSES: ReadonlySet<string> = new Set(['1', '2', '3', '4', '5'])

/** Compute the current KPI values (also used by the panel for live numbers). */
export function computeKpiSample(simSec: number): KpiSample {
  let offene = 0
  let hfTotal = 0
  let hfMet = 0
  for (const a of Object.values(useDispatchStore.getState().auftraege)) {
    if (a.uebung) continue
    if (a.state !== 'abgeschlossen') {
      offene++
    } else if (a.hilfsfristDeadline !== undefined) {
      hfTotal++
      if (a.firstArrivalSec !== undefined && a.firstArrivalSec <= a.hilfsfristDeadline) hfMet++
    }
  }

  let onDuty = 0
  let engaged = 0
  for (const rt of vehicleSim.all()) {
    if (rt.status === 'AUS') continue
    onDuty++
    if (ENGAGED_STATUSES.has(rt.status)) engaged++
  }

  return {
    t: simSec,
    offeneEinsaetze: offene,
    hilfsfristQuote: hfTotal > 0 ? hfMet / hfTotal : null,
    flottenauslastung: onDuty > 0 ? engaged / onDuty : 0,
    queueLen: useCallStore.getState().queue.length,
  }
}

let samplingStarted = false
let nextBoundary: number | null = null

/** Drop all samples (call on shift start/reset — stale history would mislead). */
export function resetKpi(): void {
  nextBoundary = null
  useKpiStore.setState({ samples: [] })
}

/**
 * Activate sampling (idempotent). Subscribes to the game clock and pushes a
 * sample whenever simSec crosses the next 30-s boundary. A clock jump
 * backwards (new shift) clears the buffer automatically.
 */
export function startKpiSampling(): void {
  if (samplingStarted) return
  samplingStarted = true
  useGameStore.subscribe((s, prev) => {
    if (s.simSec === prev.simSec) return
    const samples = useKpiStore.getState().samples
    const last = samples[samples.length - 1]
    if (last !== undefined && s.simSec < last.t) resetKpi()
    if (nextBoundary === null) {
      nextBoundary =
        Math.floor(s.simSec / SAMPLE_INTERVAL_SEC) * SAMPLE_INTERVAL_SEC + SAMPLE_INTERVAL_SEC
      return
    }
    if (s.simSec < nextBoundary) return
    nextBoundary =
      Math.floor(s.simSec / SAMPLE_INTERVAL_SEC) * SAMPLE_INTERVAL_SEC + SAMPLE_INTERVAL_SEC
    const sample = computeKpiSample(s.simSec)
    useKpiStore.setState((st) => ({
      samples:
        st.samples.length >= MAX_SAMPLES
          ? [...st.samples.slice(st.samples.length - MAX_SAMPLES + 1), sample]
          : [...st.samples, sample],
    }))
  })
}
