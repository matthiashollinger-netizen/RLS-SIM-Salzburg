import { useEffect, useMemo, useState } from 'react'
import { useEventLog, type LogEntry } from '../state/eventLog.ts'
import { useWindowStore } from '../windows/windowStore.ts'
import { formatGameTime } from '../lib/format.ts'
import './lage-ticker.css'

/**
 * Lage-Ticker (AAA pass): slim one-line news bar above the taskbar that
 * cycles through the most recent noteworthy log entries — system messages
 * plus SONDERLAGE/ALARMIERUNG incident lines. One message fades in every
 * 5 s (no marquee). Clicking the bar opens the Protokoll window.
 */

const MAX_MESSAGES = 6
const CYCLE_MS = 5000

function isTickerEntry(e: LogEntry): boolean {
  if (e.kind === 'system') return true
  return e.kind === 'einsatz' && (e.text.includes('SONDERLAGE') || e.text.includes('ALARMIERUNG'))
}

export function LageTicker() {
  // subscribe to the array reference (a length subscription would pin at the
  // log's 500-entry cap and freeze the ticker) — the render is one line
  const entries = useEventLog((s) => s.entries)

  const messages = useMemo(() => {
    const picked: LogEntry[] = []
    for (let i = entries.length - 1; i >= 0 && picked.length < MAX_MESSAGES; i--) {
      const e = entries[i]
      if (e && isTickerEntry(e)) picked.push(e)
    }
    return picked.reverse()
  }, [entries])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (messages.length <= 1) return
    const t = setInterval(() => setTick((v) => v + 1), CYCLE_MS)
    return () => clearInterval(t)
  }, [messages.length])

  const msg = messages.length > 0 ? messages[tick % messages.length] : undefined
  const isSonderlage = msg !== undefined && msg.text.includes('SONDERLAGE')

  const openProtokoll = () => useWindowStore.getState().setOpen('protokoll', true)

  return (
    <div
      className="lage-ticker"
      data-testid="lage-ticker"
      role="button"
      tabIndex={0}
      title="Protokoll öffnen"
      onClick={openProtokoll}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openProtokoll()
        }
      }}
    >
      <span className="lage-ticker-label" aria-hidden="true">
        LAGE
      </span>
      {msg ? (
        // key remount restarts the fade-in per cycled message
        <span
          key={msg.id}
          className={`lage-ticker-msg${isSonderlage ? ' lage-ticker-sonderlage' : ''}`}
        >
          <span className="lage-ticker-time">{formatGameTime(msg.simSec)}</span>
          {msg.text}
        </span>
      ) : (
        <span className="lage-ticker-msg lage-ticker-empty">Keine besonderen Ereignisse</span>
      )}
    </div>
  )
}
