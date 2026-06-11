import { useEventLog } from '../state/eventLog.ts'
import { formatGameTime } from '../lib/format.ts'
import './panels.css'

export function ProtokollPanel() {
  const entries = useEventLog((s) => s.entries)
  return (
    <div className="feed-panel" data-testid="protokoll-panel">
      {entries.length === 0 && <div className="panel-empty">Protokoll leer.</div>}
      <ul className="feed-list">
        {entries
          .slice(-120)
          .reverse()
          .map((e) => (
            <li key={e.id} className={`feed-entry feed-${e.kind}`}>
              <span className="feed-time mono">{formatGameTime(e.simSec)}</span>
              <span className="feed-text">{e.text}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
