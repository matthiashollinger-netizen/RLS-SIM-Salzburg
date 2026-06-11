import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShiftStore } from '../state/shiftStore.ts'
import type { ShiftReport } from '../engine/scoring.ts'
import './shift-report.css'

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)} %`
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

export function ShiftReportDialog() {
  const report = useShiftStore((s) => s.report)
  const history = useShiftStore((s) => s.history)
  const show = useShiftStore((s) => s.showReport)
  const close = useShiftStore((s) => s.closeReport)
  const navigate = useNavigate()

  useEffect(() => {
    void useShiftStore.getState().loadHistory()
  }, [])

  if (!show || !report) return null

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
          <div className="report-stat">
            <span className="report-stat-value">{pct(report.hilfsfristQuote)}</span>
            <span className="report-stat-label">Hilfsfrist ≤ 15 min (Ziel 95 %)</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{pct(report.stichwortQuote)}</span>
            <span className="report-stat-label">Stichwortgenauigkeit</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{report.fehldispoCount}</span>
            <span className="report-stat-label">Fehldispositionen (Zielklinik)</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">
              {report.ueberlebt} / {report.ueberlebt + report.verstorben}
            </span>
            <span className="report-stat-label">Patienten überlebt</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{report.calls.angenommen}</span>
            <span className="report-stat-label">Anrufe angenommen</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{report.auftraege.length}</span>
            <span className="report-stat-label">Aufträge</span>
          </div>
        </div>

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
