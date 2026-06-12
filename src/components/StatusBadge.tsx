import { statusByCode } from '../data/index.ts'
import type { VehiclePhase } from '../engine/status.ts'
import './status-badge.css'

/**
 * Status badge: color (token) + the status DIGIT itself + shape per kind —
 * color is never the only carrier (DESIGN_SYSTEM color-blindness rule).
 */
export function StatusBadge({ status }: { status: VehiclePhase }) {
  if (status === 'AUS') {
    return (
      <span className="status-badge status-badge-aus" title="außer Dienst">
        —
      </span>
    )
  }
  const def = statusByCode.get(status)
  const kind = def?.kind ?? 'lifecycle'
  return (
    // key={status}: a status change remounts the node → badge-pop replays
    <span
      key={status}
      className={`status-badge status-badge-${kind}`}
      style={{ background: `var(${def?.colorToken ?? '--status-oos'})` }}
      title={def?.label ?? status}
    >
      {status}
    </span>
  )
}
