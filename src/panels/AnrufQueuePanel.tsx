import { useEffect } from 'react'
import { useCallStore } from '../state/callStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { formatCountdown } from '../lib/format.ts'
import { startRinging, stopRinging } from '../audio/sounds.ts'
import { simulateDemoCall } from '../state/debugActions.ts'
import './panels.css'
import './call-panels.css'

const TITLE_ALARM = '☎ ANRUF — RLS-SIM Salzburg'

export function AnrufQueuePanel() {
  const queue = useCallStore((s) => s.queue)
  const active = useCallStore((s) => s.active)
  const answer = useCallStore((s) => s.answer)
  const simSec = useGameStore((s) => s.simSec)
  const hasWaiting = queue.length > 0

  useEffect(() => {
    if (queue.length > 0) startRinging()
    else stopRinging()
    return stopRinging
  }, [queue.length])

  // tab-title alarm while calls wait — restore the exact title on cleanup
  useEffect(() => {
    if (!hasWaiting) return
    const baseTitle = document.title
    let flash = true
    document.title = TITLE_ALARM
    const interval = setInterval(() => {
      flash = !flash
      document.title = flash ? TITLE_ALARM : baseTitle
    }, 1000)
    return () => {
      clearInterval(interval)
      document.title = baseTitle
    }
  }, [hasWaiting])

  return (
    <div className="anruf-queue" data-testid="anruf-queue">
      <div className="panel-toolbar">
        <span className="queue-count">
          {queue.length === 0 ? 'Keine wartenden Anrufe' : `${queue.length} wartend`}
        </span>
        <button className="debug-btn" onClick={() => simulateDemoCall()}>
          Test-Anruf
        </button>
      </div>
      <ul className="queue-list">
        {queue.map((c) => (
          <li key={c.id} className="queue-entry">
            <span className="queue-ring" aria-hidden="true">
              ☎
            </span>
            <span className="queue-info">
              <span className="mono">{c.scenario.phone === 'handy' ? 'Mobil' : 'Festnetz'} 144</span>
              <span className="queue-wait mono">{formatCountdown(simSec - c.ringingSince)}</span>
            </span>
            <button
              className="queue-answer"
              disabled={!!active}
              onClick={() => answer(c.id)}
            >
              Annehmen
            </button>
          </li>
        ))}
      </ul>
      {active && (
        <div className="queue-active-hint">
          Aktives Gespräch: <span className="mono">{active.id}</span> — siehe Abfragemaske
        </div>
      )}
    </div>
  )
}
