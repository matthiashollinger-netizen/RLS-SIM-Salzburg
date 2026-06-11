import { useMemo, useState } from 'react'
import { hospitals } from '../data/index.ts'
import { isAvailable } from '../engine/status.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useVehicleVersion } from '../state/useVehicles.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'
import { probealarm } from '../state/debugActions.ts'
import { useFunkStore } from '../state/funkStore.ts'
import { useWindowStore } from '../windows/windowStore.ts'
import { StatusBadge } from '../components/StatusBadge.tsx'
import './panels.css'

const positionHospitals = hospitals.filter((h) => h.positionsCode)

export function RessourcenPanel() {
  useVehicleVersion()
  const [filter, setFilter] = useState('')
  const [region, setRegion] = useState<'ALLE' | 'NORD' | 'SUED'>('ALLE')
  const [showAus, setShowAus] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

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
          rt.unit.typ.toLowerCase().includes(f) ||
          rt.unit.stationName.toLowerCase().includes(f),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimes, filter, region, showAus, vehicleSim.version])

  const sel = selected ? vehicleSim.get(selected) : undefined
  const simSec = useGameStore.getState().simSec

  return (
    <div className="ressourcen-panel" data-testid="ressourcen-panel">
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
              <th>Rufname</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Dienststelle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rt) => (
              <tr
                key={rt.id}
                className={selected === rt.id ? 'row-selected' : ''}
                onClick={() => setSelected(rt.id === selected ? null : rt.id)}
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
