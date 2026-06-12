import { useEffect, useMemo, useState } from 'react'
import { useKpiStore, computeKpiSample } from '../state/kpiStore.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useCallStore } from '../state/callStore.ts'
import { alarmtext, type Auftrag } from '../engine/auftrag.ts'
import { formatCountdown } from '../lib/format.ts'
import './lagebild-panel.css'

/**
 * Live-Lagebild (AAA pass): big KPI numbers with sparklines from the
 * kpiStore ring buffer, an active-Sonderlage banner and the three most
 * urgent open Aufträge (closest to Hilfsfrist breach).
 *
 * Render discipline: the component subscribes to the KPI buffer (one change
 * per 30 sim-seconds), a string fingerprint of the open-incident set and the
 * call-queue length — never to the raw sim clock.
 */

// ---- Sonderlage banner (store lands in a concurrent workstream) -----------

interface SonderlageBanner {
  name: string
  tickerText: string
  endsAt: number | null
}

interface StoreLike {
  getState: () => unknown
  subscribe: (fn: () => void) => () => void
}

function extractSonderlage(state: unknown): SonderlageBanner | null {
  const active = (
    state as {
      active?: { def?: { name?: unknown; tickerText?: unknown }; endsAt?: unknown } | null
    } | null
  )?.active
  if (!active) return null
  return {
    name: typeof active.def?.name === 'string' ? active.def.name : 'Sonderlage',
    tickerText: typeof active.def?.tickerText === 'string' ? active.def.tickerText : '',
    endsAt: typeof active.endsAt === 'number' ? active.endsAt : null,
  }
}

/** Defensive dynamic import: the panel works with or without the store. */
function useSonderlage(): SonderlageBanner | null {
  const [banner, setBanner] = useState<SonderlageBanner | null>(null)
  useEffect(() => {
    let unsub: (() => void) | undefined
    let disposed = false
    void import('../state/sonderlageStore.ts')
      .then((mod) => {
        if (disposed) return
        const store = (mod as unknown as { useSonderlageStore?: StoreLike }).useSonderlageStore
        if (!store?.getState || !store.subscribe) return
        const read = () => {
          const next = extractSonderlage(store.getState())
          setBanner((cur) =>
            cur?.name === next?.name && cur?.endsAt === next?.endsAt ? cur : next,
          )
        }
        read()
        unsub = store.subscribe(read)
      })
      .catch(() => {
        /* Sonderlage feature not present — banner stays hidden */
      })
    return () => {
      disposed = true
      unsub?.()
    }
  }, [])
  return banner
}

// ---- Sparkline (inline SVG, no chart lib) ----------------------------------

function Sparkline({
  values,
  className,
  domainMax,
}: {
  values: (number | null)[]
  className: string
  /** fixed upper bound (e.g. 1 for quotas); omit for auto-scale */
  domainMax?: number
}) {
  const pts = values.filter((v): v is number => v !== null)
  if (pts.length < 2) {
    return <svg className="lagebild-spark" viewBox="0 0 120 28" aria-hidden="true" />
  }
  const max = domainMax ?? Math.max(1, ...pts)
  const stepX = 120 / (pts.length - 1)
  const points = pts
    .map((v, i) => `${(i * stepX).toFixed(1)},${(26 - (v / max) * 24).toFixed(1)}`)
    .join(' ')
  return (
    <svg
      className="lagebild-spark"
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline className={className} points={points} />
    </svg>
  )
}

// ---- Panel ------------------------------------------------------------------

export function LagebildPanel() {
  const samples = useKpiStore((s) => s.samples)
  const queueLen = useCallStore((s) => s.queue.length)
  // fingerprint of the open-incident set: re-render only when incidents
  // open/close or a first unit arrives — event-driven, never per sim tick
  const openFingerprint = useDispatchStore((s) =>
    s.order
      .map((id) => s.auftraege[id])
      .filter((a): a is Auftrag => !!a && a.state !== 'abgeschlossen' && !a.uebung)
      .map((a) => `${a.id}:${a.firstArrivalSec !== undefined ? 1 : 0}`)
      .join(','),
  )
  const selectedId = useDispatchStore((s) => s.selectedId)
  const select = useDispatchStore((s) => s.select)
  const sonderlage = useSonderlage()

  // 1 Hz local tick so the countdown texts (Hilfsfrist, Sonderlage-Restzeit)
  // stay live — the panel is small, and this avoids any simSec subscription
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // non-reactive clock read — refreshed by the 1 Hz tick re-renders
  const simSec = useGameStore.getState().simSec
  const now = computeKpiSample(simSec)

  const urgent = useMemo(() => {
    if (openFingerprint === '') return []
    const auftraege = useDispatchStore.getState().auftraege
    const open = openFingerprint
      .split(',')
      .map((part) => auftraege[part.split(':')[0] ?? ''])
      .filter((a): a is Auftrag => !!a)
    // most urgent first: pending Hilfsfrist deadlines (no unit on scene yet),
    // sorted by deadline; then the remaining open ones by age
    const pending = open
      .filter((a) => a.hilfsfristDeadline !== undefined && a.firstArrivalSec === undefined)
      .sort((a, b) => (a.hilfsfristDeadline ?? 0) - (b.hilfsfristDeadline ?? 0))
    const others = open
      .filter((a) => a.hilfsfristDeadline === undefined || a.firstArrivalSec !== undefined)
      .sort((a, b) => a.createdAt - b.createdAt)
    return [...pending, ...others].slice(0, 3)
  }, [openFingerprint])

  const tiles = [
    {
      label: 'Offene Einsätze',
      value: String(now.offeneEinsaetze),
      spark: samples.map((s) => s.offeneEinsaetze),
      cls: 'spark-offene',
      max: undefined as number | undefined,
    },
    {
      label: 'Hilfsfrist-Quote',
      value: now.hilfsfristQuote === null ? '—' : `${Math.round(now.hilfsfristQuote * 100)} %`,
      spark: samples.map((s) => s.hilfsfristQuote),
      cls: 'spark-hilfsfrist',
      max: 1 as number | undefined,
    },
    {
      label: 'Flotte im Einsatz',
      value: `${Math.round(now.flottenauslastung * 100)} %`,
      spark: samples.map((s) => s.flottenauslastung),
      cls: 'spark-flotte',
      max: 1 as number | undefined,
    },
    {
      label: 'Anrufe in Warteschlange',
      value: String(queueLen),
      spark: samples.map((s) => s.queueLen),
      cls: 'spark-queue',
      max: undefined as number | undefined,
    },
  ]

  return (
    <div className="lagebild-panel" data-testid="lagebild-panel">
      {sonderlage && (
        <div className="lagebild-sonderlage" role="alert">
          <span className="lagebild-sonderlage-dot" aria-hidden="true" />
          <div className="lagebild-sonderlage-text">
            <strong>SONDERLAGE: {sonderlage.name}</strong>
            {sonderlage.tickerText && <p>{sonderlage.tickerText}</p>}
          </div>
          {sonderlage.endsAt !== null && (
            <span className="lagebild-sonderlage-rest">
              noch {formatCountdown(Math.max(0, sonderlage.endsAt - simSec))}
            </span>
          )}
        </div>
      )}

      <div className="lagebild-grid">
        {tiles.map((t) => (
          <div className="lagebild-tile" key={t.label}>
            <span className="lagebild-value">{t.value}</span>
            <span className="lagebild-label">{t.label}</span>
            <Sparkline values={t.spark} className={t.cls} domainMax={t.max} />
          </div>
        ))}
      </div>

      <div className="lagebild-urgent">
        <h3>Dringendste Einsätze</h3>
        {urgent.length === 0 ? (
          <p className="lagebild-urgent-empty">Keine offenen Einsätze.</p>
        ) : (
          <ul>
            {urgent.map((a) => {
              const rest =
                a.hilfsfristDeadline !== undefined ? a.hilfsfristDeadline - simSec : null
              const restCls =
                rest === null
                  ? ''
                  : rest < 0
                    ? ' is-overdue'
                    : rest < 180
                      ? ' is-critical'
                      : ''
              return (
                <li key={a.id}>
                  <button
                    className={`lagebild-urgent-row${selectedId === a.id ? ' is-selected' : ''}`}
                    onClick={() => select(a.id)}
                    title={`${a.id} in der Einsatzliste auswählen`}
                  >
                    <span className="lagebild-urgent-id">{a.id}</span>
                    <span className="lagebild-urgent-text">{alarmtext(a)}</span>
                    <span className={`lagebild-urgent-rest${restCls}`}>
                      {rest === null ? '—' : formatCountdown(rest)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
