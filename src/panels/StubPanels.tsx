import './panels.css'

/** Placeholder contents — real dispatch list arrives in M4 */

export function EinsatzlistePanel() {
  return (
    <div className="panel-empty" data-testid="einsatzliste-panel">
      <p>Keine offenen Einsätze.</p>
      <p className="panel-hint">Aufträge erscheinen hier ab Meilenstein M4.</p>
    </div>
  )
}
