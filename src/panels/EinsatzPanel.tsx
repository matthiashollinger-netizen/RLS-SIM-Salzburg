import { useMemo, useState } from 'react'
import { categoryById, codes } from '../data/index.ts'
import type { Partner } from '../data/schemas.ts'
import { alarmtext, type Auftrag } from '../engine/auftrag.ts'
import { hospitalNeedsFor, proposeAo, unitsForCode } from '../engine/ao.ts'
import { findUnits } from '../engine/dispatchSearch.ts'
import { matchHospitals } from '../engine/hospitalMatch.ts'
import { isDaylight } from '../engine/time.ts'
import { formatCountdown } from '../lib/format.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useVehicleVersion } from '../state/useVehicles.ts'
import { createRandomAuftrag } from '../state/debugActions.ts'
import { StatusBadge } from '../components/StatusBadge.tsx'
import './panels.css'
import './einsatz-panel.css'

const ALL_PARTNERS: Partner[] = ['FW', 'POL', 'WR', 'BR']

function HilfsfristTimer({ auftrag }: { auftrag: Auftrag }) {
  const simSec = useGameStore((s) => s.simSec)
  if (!auftrag.hilfsfristDeadline) return <span className="timer-none">—</span>
  if (auftrag.firstArrivalSec !== undefined) {
    const ok = auftrag.firstArrivalSec <= auftrag.hilfsfristDeadline
    return <span className={ok ? 'timer-ok' : 'timer-over'}>{ok ? '✓' : '✗'}</span>
  }
  const remaining = auftrag.hilfsfristDeadline - simSec
  return (
    <span className={`mono ${remaining < 0 ? 'timer-over' : remaining < 240 ? 'timer-warn' : 'timer-run'}`}>
      {formatCountdown(remaining)}
    </span>
  )
}

function AuftragDetail({ auftrag }: { auftrag: Auftrag }) {
  useVehicleVersion()
  const store = useDispatchStore.getState()
  const simSec = useGameStore((s) => s.simSec)
  const weather = useGameStore((s) => s.weather)
  const gameCtx = useGameStore.getState()
  const category = categoryById.get(auftrag.categoryId)

  const proposal = useMemo(
    () => proposeAo(auftrag.categoryId, { personen: auftrag.personen, severity: auftrag.severity }),
    [auftrag.categoryId, auftrag.personen, auftrag.severity],
  )
  const units = useMemo(
    () => unitsForCode(auftrag.code, category),
    [auftrag.code, category],
  )

  const searchCtx = {
    simSec,
    weather,
    startWeekday: gameCtx.startWeekday,
    month: gameCtx.month,
    season: gameCtx.season,
  }

  const needs = hospitalNeedsFor(auftrag.categoryId, auftrag.severity)
  const hospitalCandidates = useMemo(
    () => matchHospitals(needs, auftrag.ort, auftrag.sosi).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auftrag.categoryId, auftrag.severity, auftrag.ort.lat, auftrag.ort.lon],
  )

  const assignedIds = Object.keys(auftrag.assigned)
  const daylight = isDaylight(simSec, gameCtx)

  return (
    <div className="auftrag-detail" data-testid="auftrag-detail">
      <div className="auftrag-detail-header">
        <span className={`code-chip ${auftrag.sosi ? 'code-sosi' : ''}`}>{auftrag.code}</span>
        <span className="auftrag-alarmtext mono">{alarmtext(auftrag)}</span>
        {auftrag.uebung && <span className="uebung-chip">ÜBUNG</span>}
      </div>
      {auftrag.merkmalskette.length > 0 && (
        <p className="merkmalskette">{auftrag.merkmalskette.join(', ')}</p>
      )}

      <div className="auftrag-row">
        <label>
          Code:
          <select
            aria-label="Einsatzcode übersteuern"
            value={auftrag.code}
            onChange={(e) => store.overrideCode(auftrag.id, e.target.value)}
          >
            {codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} {c.sosi ? '🚨' : ''} — {c.label}
              </option>
            ))}
          </select>
        </label>
        <span className="auftrag-meta">
          {category?.label} · {auftrag.personen} Pers.
          {proposal.manv && <strong className="manv-flag"> MANV!</strong>}
        </span>
      </div>

      <div className="auftrag-row partner-row">
        <span>Partner:</span>
        {ALL_PARTNERS.map((p) => (
          <button
            key={p}
            className={`partner-btn ${auftrag.partnersAlarmed.includes(p) ? 'partner-active' : ''} ${proposal.partners.includes(p) ? 'partner-suggested' : ''}`}
            aria-pressed={auftrag.partnersAlarmed.includes(p)}
            onClick={() => store.togglePartner(auftrag.id, p)}
          >
            {p}
          </button>
        ))}
        {auftrag.lagefreigabe && <span className="lagefreigabe-hint">⚠ Lagefreigabe Polizei!</span>}
      </div>

      {proposal.heliRecommended && (
        <div className="heli-hint">
          Heli empfohlen — {daylight ? 'Tageslicht ✓' : 'Nacht: kein Flugbetrieb ✗'}
          {weather === 'schlecht' ? ' · Wetter ✗' : ' · Wetter ✓'}
        </div>
      )}

      <div className="unit-slots">
        {units.map((slot, i) => {
          const candidates = findUnits(vehicleSim, slot.types, auftrag.ort, auftrag.sosi, searchCtx, 4)
          return (
            <div key={i} className="unit-slot">
              <span className="unit-slot-types mono">
                {slot.purpose === 'na' ? 'NA-Mittel' : slot.purpose === 'el' ? 'EL' : 'Transport'} (
                {slot.types.join('/')})
              </span>
              <div className="unit-candidates">
                {candidates.length === 0 && <span className="no-units">kein Mittel frei!</span>}
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    className="unit-candidate"
                    onClick={() => store.assignVehicle(auftrag.id, c.id)}
                    disabled={assignedIds.includes(c.id)}
                  >
                    <span className="mono">{unitDisplayName(c.runtime.unit)}</span>
                    <span className="eta">{Math.round(c.etaSec / 60)} min</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {assignedIds.length > 0 && (
        <div className="assigned-units">
          <span>Disponiert:</span>
          {assignedIds.map((id) => {
            const rt = vehicleSim.get(id)
            return (
              <span key={id} className="assigned-unit">
                <span className="mono">{rt ? unitDisplayName(rt.unit) : id}</span>
                {rt && <StatusBadge status={rt.status} />}
                {rt && (rt.status === '1' || rt.status === '2' || rt.status === '3') && (
                  <button
                    title="Einsatzabbruch"
                    onClick={() => store.cancelVehicle(auftrag.id, id)}
                  >
                    ✕
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="auftrag-row">
        <label>
          Zielklinik:
          <select
            aria-label="Zielklinik"
            value={auftrag.hospitalId ?? ''}
            onChange={(e) => e.target.value && store.setHospital(auftrag.id, e.target.value)}
          >
            <option value="">automatisch (nächstes geeignetes)</option>
            {hospitalCandidates.map((c) => (
              <option key={c.hospital.id} value={c.hospital.id}>
                {c.suitable ? '✓' : '⚠'} {c.hospital.short} ({Math.round(c.etaSec / 60)} min)
                {c.suitable ? '' : ` — fehlt: ${c.missing.join(', ')}`}
              </option>
            ))}
          </select>
        </label>
        {auftrag.hospitalId && !hospitalCandidates.find((c) => c.hospital.id === auftrag.hospitalId)?.suitable && (
          <span className="hospital-warn">⚠ Zielklinik ohne benötigte Fähigkeit — Sekundärtransport droht</span>
        )}
      </div>

      <div className="auftrag-actions">
        <button onClick={() => store.closeAuftrag(auftrag.id)}>Auftrag abschließen</button>
      </div>
    </div>
  )
}

export function EinsatzPanel() {
  const auftraege = useDispatchStore((s) => s.auftraege)
  const order = useDispatchStore((s) => s.order)
  const selectedId = useDispatchStore((s) => s.selectedId)
  const select = useDispatchStore((s) => s.select)
  const [showClosed, setShowClosed] = useState(false)

  const list = order
    .map((id) => auftraege[id]!)
    .filter((a) => showClosed || a.state !== 'abgeschlossen')

  const selected = selectedId ? auftraege[selectedId] : undefined

  return (
    <div className="einsatz-panel" data-testid="einsatzliste-panel">
      <div className="panel-toolbar">
        <button onClick={() => createRandomAuftrag()}>Neuer Einsatz (Test)</button>
        <label className="panel-checkbox">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          abgeschl.
        </label>
      </div>
      {list.length === 0 && <div className="panel-empty">Keine offenen Einsätze.</div>}
      <div className="einsatz-list">
        {list.map((a) => (
          <button
            key={a.id}
            className={`einsatz-row ${selectedId === a.id ? 'einsatz-row-selected' : ''} state-${a.state}`}
            onClick={() => select(selectedId === a.id ? null : a.id)}
          >
            <HilfsfristTimer auftrag={a} />
            <span className={`code-chip ${a.sosi ? 'code-sosi' : ''}`}>{a.code}</span>
            <span className="einsatz-text mono">{alarmtext(a)}</span>
            <span className="einsatz-state">{a.state}</span>
            <span className="einsatz-units">{Object.keys(a.assigned).length} Fzg</span>
          </button>
        ))}
      </div>
      {selected && <AuftragDetail auftrag={selected} />}
    </div>
  )
}
