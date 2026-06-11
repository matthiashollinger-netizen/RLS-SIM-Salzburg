import { useMemo, useState } from 'react'
import {
  balancing,
  categories,
  codes,
  crossValidate,
  helicopters,
  hospitals,
  stations,
  statusDefs,
  vehicles,
} from '../data/index.ts'
import './data-browser.css'

type DatasetKey =
  | 'codes'
  | 'categories'
  | 'status'
  | 'stations'
  | 'vehicles'
  | 'hospitals'
  | 'helicopters'
  | 'balancing'

const datasets: Record<DatasetKey, unknown[]> = {
  codes,
  categories,
  status: statusDefs,
  stations,
  vehicles,
  hospitals,
  helicopters,
  balancing: [balancing],
}

function Table({ rows }: { rows: unknown[] }) {
  const cols = useMemo(() => {
    const keys = new Set<string>()
    for (const r of rows) for (const k of Object.keys(r as object)) keys.add(k)
    return [...keys]
  }, [rows])

  return (
    <table className="data-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {cols.map((c) => {
              const v = (row as Record<string, unknown>)[c]
              return (
                <td key={c}>
                  {v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DataBrowser() {
  const [active, setActive] = useState<DatasetKey>('codes')
  const problems = useMemo(() => crossValidate(), [])
  const rows = datasets[active]

  return (
    <div className="data-browser">
      <header className="data-browser-header">
        <h1>Datenbrowser</h1>
        <span className={problems.length === 0 ? 'data-ok' : 'data-problems'}>
          {problems.length === 0
            ? 'Kreuzvalidierung OK'
            : `${problems.length} Validierungsprobleme!`}
        </span>
      </header>
      <nav className="data-browser-tabs">
        {(Object.keys(datasets) as DatasetKey[]).map((key) => (
          <button
            key={key}
            className={key === active ? 'active' : ''}
            onClick={() => setActive(key)}
          >
            {key} ({datasets[key].length})
          </button>
        ))}
      </nav>
      {problems.length > 0 && (
        <ul className="data-problem-list">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="data-browser-content">
        <Table rows={rows} />
      </div>
    </div>
  )
}
