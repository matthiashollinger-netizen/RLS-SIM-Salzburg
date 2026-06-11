import { useEffect, useRef, useState } from 'react'
import { resolveSprechwunsch, useFunkStore } from '../state/funkStore.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useVehicleVersion } from '../state/useVehicles.ts'
import { QUICK_PHRASES } from '../engine/funk.ts'
import { formatGameTime, unitDisplayName } from '../lib/format.ts'
import './panels.css'
import './funk-panel.css'

function FunkCompose() {
  useVehicleVersion()
  const target = useFunkStore((s) => s.targetVehicleId)
  const setTarget = useFunkStore((s) => s.setTarget)
  const callVehicle = useFunkStore((s) => s.callVehicle)
  const callFreeText = useFunkStore((s) => s.callVehicleFreeText)
  const [text, setText] = useState('')

  const activeUnits = vehicleSim
    .all()
    .filter((rt) => rt.status !== 'AUS')
    .sort((a, b) => a.id.localeCompare(b.id))

  return (
    <div className="funk-compose" data-testid="funk-compose">
      <div className="funk-compose-row">
        <select
          aria-label="Fahrzeug anfunken"
          value={target ?? ''}
          onChange={(e) => setTarget(e.target.value || null)}
        >
          <option value="">— Fahrzeug wählen —</option>
          {activeUnits.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {unitDisplayName(rt.unit)} ({rt.unit.typ}, St. {rt.status})
            </option>
          ))}
        </select>
        {QUICK_PHRASES.map((p) => (
          <button key={p.id} disabled={!target} onClick={() => target && callVehicle(target, p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="funk-compose-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (target && text.trim()) {
            callFreeText(target, text.trim())
            setText('')
          }
        }}
      >
        <input
          aria-label="Funkspruch Freitext"
          placeholder="Freitext-Funkspruch…"
          value={text}
          disabled={!target}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!target || !text.trim()}>
          Senden
        </button>
      </form>
    </div>
  )
}

export function FunkPanel() {
  const sprueche = useFunkStore((s) => s.sprueche)
  const executeAction = useFunkStore((s) => s.executeAction)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [sprueche.length])

  return (
    <div className="funk-panel" data-testid="funkfeld-panel">
      <div className="funk-feed" role="log" aria-live="polite" aria-label="Funkverkehr">
        {sprueche.length === 0 && <div className="panel-empty">Kein Funkverkehr.</div>}
        {sprueche.map((s) => (
          <div key={s.id} className={`funk-spruch funk-${s.kind}${s.requiresAck && !s.acked ? ' funk-pending' : ''}`}>
            <span className="funk-time mono">{formatGameTime(s.simSec).slice(0, 5)}</span>
            <div className="funk-lines">
              {s.lines.map((l, i) => (
                <p key={i} className="funk-line">
                  <span className="funk-speaker mono">{l.speaker}:</span> {l.text}
                </p>
              ))}
              {s.requiresAck && !s.acked && s.kind === 'sprechwunsch' && (
                <button className="funk-action" onClick={() => resolveSprechwunsch(s.id)}>
                  Sprechwunsch quittieren
                </button>
              )}
              {s.requiresAck && !s.acked && s.action?.type === 'a4' && (
                <button className="funk-action" onClick={() => executeAction(s.id)}>
                  A4-Nachforderung anlegen
                </button>
              )}
              {s.requiresAck && !s.acked && s.action?.type === 'polizei' && (
                <button className="funk-action" onClick={() => executeAction(s.id)}>
                  Polizei alarmieren
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <FunkCompose />
    </div>
  )
}
