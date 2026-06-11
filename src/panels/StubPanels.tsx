import { stations, vehicles } from '../data/index.ts'
import './panels.css'

/** Placeholder contents (M2) — real engines arrive in M3+ */

export function EinsatzlistePanel() {
  return (
    <div className="panel-empty" data-testid="einsatzliste-panel">
      <p>Keine offenen Einsätze.</p>
      <p className="panel-hint">Aufträge erscheinen hier ab Meilenstein M4.</p>
    </div>
  )
}

export function RessourcenPanel() {
  const byStation = new Map<string, typeof vehicles>()
  for (const v of vehicles) {
    const list = byStation.get(v.homeStation) ?? []
    list.push(v)
    byStation.set(v.homeStation, list)
  }
  return (
    <div className="panel-table-wrap" data-testid="ressourcen-panel">
      <table className="panel-table">
        <thead>
          <tr>
            <th>Rufname</th>
            <th>Typ</th>
            <th>Dienststelle</th>
          </tr>
        </thead>
        <tbody>
          {stations
            .filter((s) => byStation.has(s.id))
            .flatMap((s) =>
              (byStation.get(s.id) ?? []).map((v) => (
                <tr key={v.funkrufname}>
                  <td className="mono">{v.funkrufname}</td>
                  <td>{v.typ}</td>
                  <td>{s.name}</td>
                </tr>
              )),
            )}
        </tbody>
      </table>
    </div>
  )
}

export function FunkfeldPanel() {
  return (
    <div className="panel-empty" data-testid="funkfeld-panel">
      <p>Kein Funkverkehr.</p>
      <p className="panel-hint">Statusmeldungen erscheinen hier ab Meilenstein M3.</p>
    </div>
  )
}

export function ProtokollPanel() {
  return (
    <div className="panel-empty" data-testid="protokoll-panel">
      <p>Protokoll leer.</p>
      <p className="panel-hint">Einsatzprotokolle erscheinen hier ab Meilenstein M4.</p>
    </div>
  )
}
