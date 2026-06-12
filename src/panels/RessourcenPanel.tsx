import { useMemo, useState } from 'react'
import { hospitals, statusByCode } from '../data/index.ts'
import { isAvailable } from '../engine/status.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useVehicleVersion } from '../state/useVehicles.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useMapStore } from '../state/mapStore.ts'
import { probealarm } from '../state/debugActions.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useFunkStore } from '../state/funkStore.ts'
import { useWindowStore } from '../windows/windowStore.ts'
import { StatusBadge } from '../components/StatusBadge.tsx'
import type { VehicleRuntime } from '../engine/vehicleSim.ts'
import './panels.css'

const positionHospitals = hospitals.filter((h) => h.positionsCode)

type SortKey = 'rufname' | 'typ' | 'status' | 'wache'

const SORT_FNS: Record<SortKey, (a: VehicleRuntime, b: VehicleRuntime) => number> = {
  rufname: (a, b) => unitDisplayName(a.unit).localeCompare(unitDisplayName(b.unit)),
  typ: (a, b) => a.unit.typ.localeCompare(b.unit.typ) || a.id.localeCompare(b.id),
  status: (a, b) =>
    String(a.status).localeCompare(String(b.status)) || a.id.localeCompare(b.id),
  wache: (a, b) =>
    a.unit.stationName.localeCompare(b.unit.stationName) || a.id.localeCompare(b.id),
}

/** order on the Lichterkette: emergency units first (classic status board) */
const LICHTERKETTE_ORDER = ['NEF', 'NAW', 'HELI', 'RTW', 'ITW', 'KTW', 'GKTW', 'BTW', 'MTW', 'EL']

/**
 * Status-Lichterkette (Award-Polish): the whole on-duty fleet as one row of
 * colored status cells — the classic dispatch-center wall board. Click selects
 * the unit, double-click centers the map.
 */
function Lichterkette({
  runtimes,
  onPick,
}: {
  runtimes: VehicleRuntime[]
  onPick: (id: string) => void
}) {
  const cells = [...runtimes]
    .filter((rt) => rt.status !== 'AUS')
    .sort(
      (a, b) =>
        LICHTERKETTE_ORDER.indexOf(a.unit.typ) - LICHTERKETTE_ORDER.indexOf(b.unit.typ) ||
        a.id.localeCompare(b.id),
    )
  if (cells.length === 0) return null
  return (
    <div className="lichterkette" role="group" aria-label="Status-Lichterkette" data-testid="lichterkette">
      {cells.map((rt) => {
        const def = statusByCode.get(rt.status)
        return (
          <button
            key={rt.id}
            className="lichterkette-cell"
            style={{ background: `var(${def?.colorToken ?? '--status-oos'})` }}
            title={`${unitDisplayName(rt.unit)} (${rt.unit.typ}) — Status ${rt.status}${def ? ` ${def.label}` : ''}`}
            onClick={() => onPick(rt.id)}
            onDoubleClick={() => {
              const pos = vehicleSim.posOf(rt, useGameStore.getState().simSec)
              useMapStore.getState().focusOn(pos.lat, pos.lon, 13)
            }}
          >
            {rt.status}
          </button>
        )
      })}
    </div>
  )
}

export function RessourcenPanel() {
  useVehicleVersion()
  const [filter, setFilter] = useState('')
  const [region, setRegion] = useState<'ALLE' | 'NORD' | 'SUED'>('ALLE')
  const [showAus, setShowAus] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('rufname')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  const runtimes = vehicleSim.all()
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return runtimes
      .filter((rt) => region === 'ALLE' || rt.unit.region === region)
      .filter((rt) => showAus || rt.status !== 'AUS')
      .filter(
        (rt) =>
          !f ||
          rt.id.toLowerCase().includes(f) ||
          unitDisplayName(rt.unit).toLowerCase().includes(f) ||
          rt.unit.typ.toLowerCase().includes(f) ||
          rt.unit.stationName.toLowerCase().includes(f),
      )
      .sort((a, b) => SORT_FNS[sortKey](a, b) * sortDir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimes, filter, region, showAus, sortKey, sortDir, vehicleSim.version])

  const sel = selected ? vehicleSim.get(selected) : undefined
  const simSec = useGameStore.getState().simSec
  const selectedAuftragId = useDispatchStore((s) => s.selectedId)
  const selectedAuftrag = useDispatchStore((s) =>
    s.selectedId ? s.auftraege[s.selectedId] : undefined,
  )

  return (
    <div className="ressourcen-panel" data-testid="ressourcen-panel">
      <Lichterkette runtimes={runtimes} onPick={(id) => setSelected(id === selected ? null : id)} />
      <div className="panel-toolbar">
        <input
          aria-label="Fahrzeuge filtern"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value as typeof region)}
        >
          <option value="ALLE">Nord + Süd</option>
          <option value="NORD">Nord</option>
          <option value="SUED">Süd</option>
        </select>
        <label className="panel-checkbox">
          <input type="checkbox" checked={showAus} onChange={(e) => setShowAus(e.target.checked)} />
          a. D.
        </label>
      </div>
      {sel && (
        <div className="vehicle-actions" data-testid="vehicle-actions">
          <span className="mono vehicle-actions-title">
            {unitDisplayName(sel.unit)} · {sel.unit.typ}
            {sel.unit.nickname && sel.unit.typ !== 'HELI' ? ` „${sel.unit.nickname}"` : ''}
          </span>
          {isAvailable(sel.status) &&
            positionHospitals.map((h) => (
              <button
                key={h.id}
                onClick={() => vehicleSim.sendToPosition(sel.id, h.id, useGameStore.getState().simSec)}
              >
                → {h.short} ({h.positionsCode})
              </button>
            ))}
          {sel.status !== 'AUS' && (
            <button
              onClick={() => {
                useFunkStore.getState().setTarget(sel.id)
                useWindowStore.getState().setOpen('funk', true)
              }}
            >
              Anfunken
            </button>
          )}
          {selectedAuftragId &&
            selectedAuftrag?.state !== 'abgeschlossen' &&
            sel.status !== 'AUS' &&
            (isAvailable(sel.status) || sel.status === '1' || sel.status === '2' || sel.status === '3') &&
            !selectedAuftrag?.assigned[sel.id] && (
              <button
                title="Mittel (auch aus laufendem Einsatz) zum ausgewählten Auftrag umdisponieren"
                onClick={() => useDispatchStore.getState().redirectVehicle(sel.id, selectedAuftragId)}
              >
                ⇒ zu {selectedAuftragId}
              </button>
            )}
          {isAvailable(sel.status) && (
            <>
              <button onClick={() => probealarm(sel.id)}>Probealarm (ÜBUNG)</button>
              <button
                onClick={() =>
                  vehicleSim.setSonderstatus(sel.id, '94', 3600, useGameStore.getState().simSec)
                }
              >
                94 außer Betrieb
              </button>
            </>
          )}
          {sel.unit.reserve && (
            <button
              onClick={() =>
                vehicleSim.setReserveActive(sel.id, sel.status === 'AUS', simSec)
              }
            >
              {sel.status === 'AUS' ? 'Reserve aktivieren' : 'Reserve abrüsten'}
            </button>
          )}
          <button onClick={() => setSelected(null)}>×</button>
        </div>
      )}
      <div className="panel-table-wrap">
        <table className="panel-table">
          <thead>
            <tr>
              {(
                [
                  ['rufname', 'Rufname'],
                  ['typ', 'Typ'],
                  ['status', 'Status'],
                  ['wache', 'Dienststelle'],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="sortable-th"
                  aria-sort={sortKey === key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
                  onClick={() => toggleSort(key)}
                >
                  {label}
                  {sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rt) => (
              <tr
                key={rt.id}
                className={selected === rt.id ? 'row-selected' : ''}
                onClick={() => setSelected(rt.id === selected ? null : rt.id)}
                onDoubleClick={() => {
                  const pos = vehicleSim.posOf(rt, useGameStore.getState().simSec)
                  useMapStore.getState().focusOn(pos.lat, pos.lon, 13)
                }}
                title="Doppelklick: auf Karte zeigen"
              >
                <td className="mono">{unitDisplayName(rt.unit)}</td>
                <td>
                  {rt.unit.typ}
                  {rt.unit.notfallKtw ? ' (N)' : ''}
                </td>
                <td>
                  <StatusBadge status={rt.status} />
                </td>
                <td>{rt.unit.stationName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
