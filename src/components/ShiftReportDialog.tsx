import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShiftStore } from '../state/shiftStore.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { alarmtext, type Auftrag } from '../engine/auftrag.ts'
import { formatGameTime } from '../lib/format.ts'
import { reportSting } from '../audio/sounds.ts'
import type { ShiftReport } from '../engine/scoring.ts'
import './shift-report.css'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Single rAF-driven reveal progress (0→1) for all number count-ups.
 * Under prefers-reduced-motion the final values render instantly.
 */
function useRevealProgress(active: boolean): number {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!active) {
      setP(0)
      return
    }
    if (prefersReducedMotion()) {
      setP(1)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const DURATION_MS = 900
    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / DURATION_MS)
      setP(1 - Math.pow(1 - x, 3)) // ease-out cubic
      if (x < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active])
  return p
}

/** Simple token-styled SVG bar chart of past shift grades (no chart lib). */
function HistoryChart({ history }: { history: ShiftReport[] }) {
  const last = history.slice(-12)
  if (last.length < 2) return null
  const w = 360
  const h = 90
  const bw = Math.min(34, (w - 10) / last.length)
  return (
    <svg
      className="history-chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Notenverlauf der letzten Schichten"
    >
      {last.map((r, i) => {
        const barH = ((6 - r.note) / 5) * (h - 24)
        return (
          <g key={i} transform={`translate(${5 + i * bw}, 0)`}>
            <rect
              x={2}
              y={h - 16 - barH}
              width={bw - 6}
              height={barH}
              rx={2}
              className={`history-bar note-${r.note}`}
            />
            <text x={(bw - 4) / 2} y={h - 4} textAnchor="middle" className="history-label">
              {r.note}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- Shift timeline strip (one dot per Auftrag over the 8-h axis) ----------

interface TimelineDot {
  id: string
  x: number
  cls: string
  tip: string
}

interface TimelineData {
  startSec: number
  spanSec: number
  hours: number
  dots: TimelineDot[]
}

const TL_W = 360
const TL_PAD = 8
const TL_AXIS_Y = 32

function dotClass(a: Auftrag): string {
  if (a.outcome?.survived === false) return 'tl-dot-danger'
  const hilfsfristMissed =
    a.hilfsfristDeadline !== undefined &&
    (a.firstArrivalSec === undefined || a.firstArrivalSec > a.hilfsfristDeadline)
  if (hilfsfristMissed || (a.outcome?.issues.length ?? 0) > 0 || a.hospitalSuitable === false) {
    return 'tl-dot-warn'
  }
  return 'tl-dot-ok'
}

/** Built once when the report opens — the world is frozen at report time. */
function buildTimeline(): TimelineData {
  const g = useGameStore.getState()
  const startSec = g.shiftStartSec
  const spanSec = Math.max(8 * 3600, g.simSec - startSec)
  const dots = Object.values(useDispatchStore.getState().auftraege)
    .filter((a) => !a.uebung && a.createdAt >= startSec)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => ({
      id: a.id,
      x: TL_PAD + Math.min(1, (a.createdAt - startSec) / spanSec) * (TL_W - 2 * TL_PAD),
      cls: dotClass(a),
      tip: `${a.id} — ${alarmtext(a)} (${formatGameTime(a.createdAt).slice(0, 5)})`,
    }))
  return { startSec, spanSec, hours: Math.round(spanSec / 3600), dots }
}

function ShiftTimeline({ data }: { data: TimelineData }) {
  const labelEvery = data.hours > 12 ? 4 : 2
  const ticks: { x: number; label: string | null }[] = []
  for (let h = 0; h <= data.hours; h++) {
    ticks.push({
      x: TL_PAD + ((h * 3600) / data.spanSec) * (TL_W - 2 * TL_PAD),
      label:
        h % labelEvery === 0 ? formatGameTime(data.startSec + h * 3600).slice(0, 5) : null,
    })
  }
  return (
    <svg
      className="shift-timeline"
      viewBox={`0 0 ${TL_W} 48`}
      role="img"
      aria-label="Zeitachse der Aufträge über die Schicht"
    >
      <line x1={TL_PAD} y1={TL_AXIS_Y} x2={TL_W - TL_PAD} y2={TL_AXIS_Y} className="tl-axis" />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={t.x} y1={TL_AXIS_Y - 3} x2={t.x} y2={TL_AXIS_Y + 3} className="tl-tick" />
          {t.label && (
            <text x={t.x} y={46} textAnchor="middle" className="tl-tick-label">
              {t.label}
            </text>
          )}
        </g>
      ))}
      {data.dots.map((d) => (
        <circle key={d.id} cx={d.x} cy={TL_AXIS_Y - 10} r={4} className={`tl-dot ${d.cls}`}>
          <title>{d.tip}</title>
        </circle>
      ))}
    </svg>
  )
}

// ---- Dialog -----------------------------------------------------------------

export function ShiftReportDialog() {
  const report = useShiftStore((s) => s.report)
  const history = useShiftStore((s) => s.history)
  const show = useShiftStore((s) => s.showReport)
  const close = useShiftStore((s) => s.closeReport)
  const navigate = useNavigate()
  const stungRef = useRef(false)
  const progress = useRevealProgress(show && report !== null)

  useEffect(() => {
    void useShiftStore.getState().loadHistory()
  }, [])

  // report sting once per dialog open (AUDIO API CONTRACT)
  useEffect(() => {
    if (show && report && !stungRef.current) {
      stungRef.current = true
      reportSting()
    }
    if (!show) stungRef.current = false
  }, [show, report])

  const timeline = useMemo(() => (show && report ? buildTimeline() : null), [show, report])

  if (!show || !report) return null

  // animated values — final state is identical to the static rendering
  const pctAnim = (v: number | null) =>
    v === null ? '—' : `${Math.round(v * 100 * progress)} %`
  const numAnim = (n: number) => Math.round(n * progress)

  const stats: { value: string; label: string }[] = [
    { value: pctAnim(report.hilfsfristQuote), label: 'Hilfsfrist ≤ 15 min (Ziel 95 %)' },
    { value: pctAnim(report.stichwortQuote), label: 'Stichwortgenauigkeit' },
    { value: String(numAnim(report.fehldispoCount)), label: 'Fehldispositionen (Zielklinik)' },
    {
      value: `${numAnim(report.ueberlebt)} / ${report.ueberlebt + report.verstorben}`,
      label: 'Patienten überlebt',
    },
    { value: String(numAnim(report.calls.angenommen)), label: 'Anrufe angenommen' },
    { value: String(numAnim(report.auftraege.length)), label: 'Aufträge' },
  ]

  const problematic = report.auftraege.filter(
    (m) => m.issues.length > 0 || m.hilfsfristMet === false || m.survived === false,
  )

  return (
    <div className="report-overlay" role="dialog" aria-label="Schichtreport">
      <div className="report-dialog" data-testid="schichtreport">
        <header className="report-header">
          <h2>Schichtreport — Leitstelle {report.region}</h2>
          <span className={`report-note note-badge-${report.note}`}>Note {report.note}</span>
        </header>
        <p className="report-note-text">{report.noteText}</p>

        <div className="report-grid">
          {stats.map((s, i) => (
            <div
              className="report-stat"
              key={s.label}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="report-stat-value">{s.value}</span>
              <span className="report-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {timeline && timeline.dots.length > 0 && (
          <div className="report-timeline">
            <h3>Schichtverlauf</h3>
            <ShiftTimeline data={timeline} />
          </div>
        )}

        {problematic.length > 0 && (
          <div className="report-debrief">
            <h3>Debriefing</h3>
            <ul>
              {problematic.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <span className="mono">{m.id}</span> {m.alarmtext}
                  {m.hilfsfristMet === false && ' — Hilfsfrist überschritten'}
                  {m.survived === false && ' — Patient verstorben'}
                  {m.issues.map((i) => (
                    <em key={i}> · {i}</em>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        {history.length >= 2 && (
          <div className="report-history">
            <h3>Verlauf</h3>
            <HistoryChart history={history} />
          </div>
        )}

        <div className="report-actions">
          <button onClick={close}>Weiter beobachten</button>
          <button
            className="report-primary"
            onClick={() => {
              close()
              navigate('/')
            }}
          >
            Zum Hauptmenü
          </button>
        </div>
      </div>
    </div>
  )
}
