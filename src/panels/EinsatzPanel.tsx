import { useMemo, useState } from 'react'
import { categories, categoryById, codes } from '../data/index.ts'
import type { Partner } from '../data/schemas.ts'
import { alarmtext, type Auftrag } from '../engine/auftrag.ts'
import { hospitalNeedsFor, proposeAo, unitsForCode } from '../engine/ao.ts'
import { findUnits, type SearchContext } from '../engine/dispatchSearch.ts'
import { matchHospitals } from '../engine/hospitalMatch.ts'
import { routeGround } from '../engine/routing.ts'
import { isAvailable } from '../engine/status.ts'
import { isDaylight } from '../engine/time.ts'
import { searchAddress } from '../lib/fuzzy.ts'
import { formatCountdown, formatGameTime } from '../lib/format.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useEventLog } from '../state/eventLog.ts'
import { useGameStore } from '../state/gameStore.ts'
import { hospitalFreeSlots } from '../state/hospitalLoadStore.ts'
import { useMapStore } from '../state/mapStore.ts'
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

/** Inline editor (Rework #10): Ort, Kategorie, Schwere, Personen, Notiz. */
function AuftragEdit({ auftrag }: { auftrag: Auftrag }) {
  const [open, setOpen] = useState(false)
  const [ortQuery, setOrtQuery] = useState('')
  const region = useGameStore((s) => s.region)
  const update = useDispatchStore((s) => s.updateAuftrag)
  const hits = useMemo(() => searchAddress(ortQuery, region), [ortQuery, region])
  const emergencyCats = useMemo(() => categories.filter((c) => c.group === 'emergency'), [])

  if (!open) {
    return (
      <button className="auftrag-edit-toggle" onClick={() => setOpen(true)}>
        Bearbeiten
      </button>
    )
  }
  return (
    <div className="auftrag-edit" data-testid="auftrag-edit">
      <div className="auftrag-edit-row">
        <label>
          Kategorie
          <select
            aria-label="Kategorie ändern"
            value={auftrag.categoryId}
            onChange={(e) => update(auftrag.id, { categoryId: e.target.value })}
          >
            {emergencyCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Schwere
          <select
            aria-label="Schwere ändern"
            value={auftrag.severity}
            onChange={(e) => update(auftrag.id, { severity: e.target.value as 'hoch' | 'normal' })}
          >
            <option value="hoch">hoch</option>
            <option value="normal">normal</option>
          </select>
        </label>
        <label>
          Personen
          <input
            aria-label="Personenzahl ändern"
            type="number"
            min={1}
            max={200}
            value={auftrag.personen}
            onChange={(e) => update(auftrag.id, { personen: Number(e.target.value) || 1 })}
          />
        </label>
        <button onClick={() => setOpen(false)}>Fertig</button>
      </div>
      <div className="auftrag-edit-row">
        <input
          aria-label="Einsatzort korrigieren"
          placeholder="Einsatzort korrigieren (Suche)…"
          value={ortQuery}
          onChange={(e) => setOrtQuery(e.target.value)}
        />
        {ortQuery.length >= 2 && hits.length > 0 && (
          <ul className="adresse-hits auftrag-edit-hits">
            {hits.slice(0, 5).map((h) => (
              <li key={`${h.place.id}-${h.strasse}`}>
                <button
                  onClick={() => {
                    update(auftrag.id, {
                      ort: {
                        lat: h.place.lat,
                        lon: h.place.lon,
                        stadtteil: h.place.name,
                        strasse: h.strasse,
                      },
                    })
                    setOrtQuery('')
                  }}
                >
                  {h.strasse}, {h.place.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="auftrag-edit-row">
        <input
          aria-label="Notiz"
          placeholder="Notiz zum Auftrag…"
          defaultValue={auftrag.notiz ?? ''}
          onBlur={(e) => update(auftrag.id, { notiz: e.target.value })}
        />
      </div>
    </div>
  )
}

/** Freie Mittelwahl (Rework 2): jedes verfügbare Mittel suchen und zuteilen. */
function FreieMittelwahl({
  auftrag,
  searchCtx,
}: {
  auftrag: Auftrag
  searchCtx: SearchContext
}) {
  const [query, setQuery] = useState('')
  const store = useDispatchStore.getState()
  const assignedIds = Object.keys(auftrag.assigned)

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return vehicleSim
      .all()
      .filter(
        (rt) =>
          isAvailable(rt.status) &&
          !assignedIds.includes(rt.id) &&
          (unitDisplayName(rt.unit).toLowerCase().includes(q) ||
            rt.unit.typ.toLowerCase().includes(q) ||
            rt.unit.stationName.toLowerCase().includes(q)),
      )
      .map((rt) => ({
        rt,
        etaSec: Math.round(
          vehicleSim.estimateTurnoutSec(rt.id, searchCtx.simSec) +
            routeGround(vehicleSim.posOf(rt, searchCtx.simSec), auftrag.ort, {
              typ: rt.unit.typ,
              sosi: auftrag.sosi,
            }).sec,
        ),
      }))
      .sort((a, b) => a.etaSec - b.etaSec)
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, auftrag.id, assignedIds.length, searchCtx.simSec])

  return (
    <div className="freie-mittelwahl">
      <input
        aria-label="Beliebiges Mittel suchen"
        placeholder="Beliebiges Mittel suchen (Rufname/Typ/Wache)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {hits.length > 0 && (
        <div className="unit-candidates">
          {hits.map(({ rt, etaSec }) => (
            <button
              key={rt.id}
              className="unit-candidate"
              onClick={() => {
                store.assignVehicle(auftrag.id, rt.id)
                setQuery('')
              }}
            >
              <span className="mono">
                + {unitDisplayName(rt.unit)} ({rt.unit.typ})
              </span>
              <span className="eta">{Math.round(etaSec / 60)} min</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Einsatzinfos wie im echten ELS: zeitgestempelte Freitext-Zeilen (Rework 2). */
function AuftragInfos({ auftrag }: { auftrag: Auftrag }) {
  const [text, setText] = useState('')
  const addInfo = useDispatchStore((s) => s.addInfo)
  return (
    <div className="auftrag-infos" data-testid="auftrag-infos">
      {(auftrag.infos ?? []).length > 0 && (
        <ul className="auftrag-infos-list">
          {auftrag.infos!.map((info, i) => (
            <li key={i}>
              <span className="mono info-time">{formatGameTime(info.simSec).slice(0, 5)}</span>{' '}
              {info.text}
            </li>
          ))}
        </ul>
      )}
      <form
        className="auftrag-infos-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) {
            addInfo(auftrag.id, text)
            setText('')
          }
        }}
      >
        <input
          aria-label="Einsatzinfo hinzufügen"
          placeholder={'Einsatzinfo eintragen (z. B. Zufahrt über Hofeinfahrt)…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim()}>
          Info
        </button>
      </form>
    </div>
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
  const stagedCount = Object.values(auftrag.assigned).filter((s) => s === 'zugeteilt').length
  const daylight = isDaylight(simSec, gameCtx)

  return (
    <div className="auftrag-detail" data-testid="auftrag-detail">
      <div className="auftrag-detail-header">
        <span className={`code-chip ${auftrag.sosi ? 'code-sosi' : ''}`}>{auftrag.code}</span>
        <span className="auftrag-alarmtext mono">{alarmtext(auftrag)}</span>
        {auftrag.uebung && <span className="uebung-chip">ÜBUNG</span>}
        <AuftragEdit auftrag={auftrag} />
      </div>
      {auftrag.merkmalskette.length > 0 && (
        <p className="merkmalskette">{auftrag.merkmalskette.join(', ')}</p>
      )}
      {auftrag.notiz && <p className="auftrag-notiz">📝 {auftrag.notiz}</p>}

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
        {auftrag.lagefreigabe && !auftrag.lageFreigegeben && (
          <span className="lagefreigabe-hint">⚠ Lagefreigabe Polizei!</span>
        )}
        {auftrag.lageFreigegeben && <span className="lagefreigabe-ok">Lagefreigabe ✓</span>}
      </div>

      {auftrag.lagefreigabe && !auftrag.lageFreigegeben && auftrag.lagePolizeiFreiAt !== undefined && (
        <div className="lagefreigabe-banner" data-testid="lagefreigabe-banner">
          {auftrag.lageGemeldet
            ? 'Polizei meldet: Lage GESICHERT — Anfahrt freigeben?'
            : 'Mittel warten im Bereitstellungsraum — Polizei sichert die Lage…'}
          <button
            className={auftrag.lageGemeldet ? 'lagefreigabe-btn' : 'lagefreigabe-btn lagefreigabe-risiko'}
            onClick={() => store.freigabeLage(auftrag.id)}
          >
            {auftrag.lageGemeldet ? 'Anfahrt freigeben' : 'Trotzdem freigeben (Lage NICHT gesichert!)'}
          </button>
        </div>
      )}

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
                    title="Zuteilen (Alarmierung erfolgt gesammelt)"
                    onClick={() => store.assignVehicle(auftrag.id, c.id)}
                    disabled={assignedIds.includes(c.id)}
                  >
                    <span className="mono">+ {unitDisplayName(c.runtime.unit)}</span>
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
          <span>Mittel:</span>
          {assignedIds.map((id) => {
            const rt = vehicleSim.get(id)
            const stateOf = auftrag.assigned[id]
            const isTransporter = auftrag.transporters?.includes(id)
            return (
              <span
                key={id}
                className={`assigned-unit ${stateOf === 'zugeteilt' ? 'assigned-staged' : ''}`}
              >
                <span className="mono">{rt ? unitDisplayName(rt.unit) : id}</span>
                {stateOf === 'zugeteilt' ? (
                  <span className="staged-chip">zugeteilt</span>
                ) : (
                  rt && <StatusBadge status={rt.status} />
                )}
                {isTransporter && stateOf !== 'zugeteilt' && (
                  <span className="transport-chip" title="Transportiert den Patienten">
                    T
                  </span>
                )}
                {stateOf === 'zugeteilt' && (
                  <button
                    title="Zuteilung entfernen"
                    onClick={() => store.removeStagedVehicle(auftrag.id, id)}
                  >
                    ✕
                  </button>
                )}
                {rt && stateOf !== 'zugeteilt' && (rt.status === '1' || rt.status === '2' || rt.status === '3') && (
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

      <FreieMittelwahl auftrag={auftrag} searchCtx={searchCtx} />

      {stagedCount > 0 && (
        <button
          className="alarmieren-btn"
          data-testid="alarmieren"
          onClick={() => store.alarmieren(auftrag.id)}
        >
          🔔 ALARMIEREN ({stagedCount} Mittel)
        </button>
      )}

      <AuftragInfos auftrag={auftrag} />

      <div className="auftrag-row">
        <label>
          Zielklinik:
          <select
            aria-label="Zielklinik"
            value={auftrag.hospitalId ?? ''}
            onChange={(e) => e.target.value && store.setHospital(auftrag.id, e.target.value)}
          >
            <option value="">automatisch (nächstes geeignetes)</option>
            {hospitalCandidates.map((c) => {
              const frei = hospitalFreeSlots(c.hospital.id, simSecNow())
              return (
                <option key={c.hospital.id} value={c.hospital.id}>
                  {c.suitable ? '✓' : '⚠'} {c.hospital.short} ({Math.round(c.etaSec / 60)} min ·{' '}
                  {frei === 0 ? 'VOLL' : `${frei} frei`})
                  {c.suitable ? '' : ` — fehlt: ${c.missing.join(', ')}`}
                </option>
              )
            })}
          </select>
        </label>
        {auftrag.hospitalId && !hospitalCandidates.find((c) => c.hospital.id === auftrag.hospitalId)?.suitable && (
          <span className="hospital-warn">⚠ Zielklinik ohne benötigte Fähigkeit — Sekundärtransport droht</span>
        )}
        {auftrag.hospitalId && hospitalFreeSlots(auftrag.hospitalId, simSecNow()) === 0 && (
          <span className="hospital-warn">⚠ Notaufnahme VOLL — Übergabe wird sich verzögern</span>
        )}
      </div>

      <AuftragVerlauf id={auftrag.id} />

      <div className="auftrag-actions">
        <button onClick={() => store.closeAuftrag(auftrag.id)}>Auftrag abschließen</button>
      </div>
    </div>
  )
}

function simSecNow() {
  return useGameStore.getState().simSec
}

/** Einsatztagebuch (Award-Polish): chronological per-Auftrag history. */
function AuftragVerlauf({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const entries = useEventLog((s) => s.entries)
  const own = entries.filter((e) => e.auftragId === id)
  return (
    <div className="auftrag-verlauf">
      <button className="verlauf-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Einsatztagebuch ({own.length})
      </button>
      {open && (
        <div className="verlauf-list" data-testid="auftrag-verlauf">
          {own.length === 0 && <span className="panel-empty">Noch keine Einträge.</span>}
          {own.map((e) => (
            <p key={e.id} className="verlauf-row">
              <span className="mono verlauf-time">{formatGameTime(e.simSec).slice(0, 5)}</span>{' '}
              {e.text}
            </p>
          ))}
        </div>
      )}
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
            onDoubleClick={() => useMapStore.getState().focusOn(a.ort.lat, a.ort.lon, 13)}
            title="Doppelklick: auf Karte zeigen"
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
