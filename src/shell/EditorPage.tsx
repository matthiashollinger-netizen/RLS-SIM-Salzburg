import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { places } from '../data/index.ts'
import { HAUPTBESCHWERDEN } from '../engine/abfrage.ts'
import {
  parseScenario,
  serializeScenario,
  type EditorEinsatz,
  type EditorScenario,
} from '../engine/editorScenario.ts'
import { useGameStore } from '../state/gameStore.ts'
import { resetWorld } from '../state/simulation.ts'
import { useUebungStore } from '../state/uebungStore.ts'
import './editor-page.css'

const DEFAULT_EINSATZ: EditorEinsatz = {
  atSec: 60,
  hauptbeschwerdeId: 'brustschmerz',
  severity: 'hoch',
  personen: 1,
  placeId: 'lehen',
  strasse: 'Ignaz-Harrer-Straße',
  emotion: 'aufgeregt',
  rolle: 'angehoeriger',
  phone: 'festnetz',
}

export function EditorPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('Meine Übung')
  const [region, setRegion] = useState<'NORD' | 'SUED'>('NORD')
  const [einsaetze, setEinsaetze] = useState<EditorEinsatz[]>([{ ...DEFAULT_EINSATZ }])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const scenario: EditorScenario = { version: 1, name, region, einsaetze }

  const update = (i: number, patch: Partial<EditorEinsatz>) =>
    setEinsaetze((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  const exportJson = () => {
    const blob = new Blob([serializeScenario(scenario)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name.replace(/[^a-z0-9äöüß\- ]/gi, '').replace(/\s+/g, '-') || 'uebung'}.rls-uebung.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = (file: File) => {
    void file.text().then((text) => {
      try {
        const parsed = parseScenario(text)
        setName(parsed.name)
        setRegion(parsed.region)
        setEinsaetze(parsed.einsaetze)
        setError('')
      } catch (err) {
        setError(`Datei ungültig: ${err instanceof Error ? err.message : err}`)
      }
    })
  }

  const startUebung = async () => {
    await resetWorld()
    useGameStore.getState().startShift({
      region,
      mode: 'endlos',
      difficulty: 'entspannt',
      role: 'voll',
      month: 6,
      startHour: 8,
      startWeekday: 1,
    })
    useUebungStore.getState().start(scenario)
    navigate('/spiel')
  }

  return (
    <div className="editor-page" data-testid="editor-page">
      <header className="editor-header">
        <h1>Szenario-Editor</h1>
        <span className="editor-hint">Eigene Übungen bauen — laufen im Spiel als ÜBUNG.</span>
      </header>

      <div className="editor-meta">
        <label>
          Name
          <input aria-label="Übungsname" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Leitstelle
          <select
            aria-label="Übungsregion"
            value={region}
            onChange={(e) => setRegion(e.target.value as 'NORD' | 'SUED')}
          >
            <option value="NORD">NORD</option>
            <option value="SUED">SÜD</option>
          </select>
        </label>
      </div>

      <div className="editor-list">
        {einsaetze.map((e, i) => {
          const place = places.find((p) => p.id === e.placeId)
          return (
            <div key={i} className="editor-einsatz">
              <span className="editor-nr mono">#{i + 1}</span>
              <label>
                nach (s)
                <input
                  aria-label={`Einsatz ${i + 1} Zeitpunkt`}
                  type="number"
                  min={0}
                  value={e.atSec}
                  onChange={(ev) => update(i, { atSec: Number(ev.target.value) })}
                />
              </label>
              <label>
                Beschwerde
                <select
                  aria-label={`Einsatz ${i + 1} Hauptbeschwerde`}
                  value={e.hauptbeschwerdeId}
                  onChange={(ev) => update(i, { hauptbeschwerdeId: ev.target.value })}
                >
                  {HAUPTBESCHWERDEN.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ort
                <select
                  aria-label={`Einsatz ${i + 1} Ort`}
                  value={e.placeId}
                  onChange={(ev) => {
                    const p = places.find((pl) => pl.id === ev.target.value)
                    update(i, { placeId: ev.target.value, strasse: p?.strassen[0] ?? '' })
                  }}
                >
                  {places
                    .filter((p) => p.region === region)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Straße
                <select
                  aria-label={`Einsatz ${i + 1} Straße`}
                  value={e.strasse}
                  onChange={(ev) => update(i, { strasse: ev.target.value })}
                >
                  {(place?.strassen ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Personen
                <input
                  aria-label={`Einsatz ${i + 1} Personen`}
                  type="number"
                  min={1}
                  max={60}
                  value={e.personen}
                  onChange={(ev) => update(i, { personen: Number(ev.target.value) })}
                />
              </label>
              <label>
                Emotion
                <select
                  aria-label={`Einsatz ${i + 1} Emotion`}
                  value={e.emotion}
                  onChange={(ev) => update(i, { emotion: ev.target.value as EditorEinsatz['emotion'] })}
                >
                  <option value="ruhig">ruhig</option>
                  <option value="aufgeregt">aufgeregt</option>
                  <option value="panisch">panisch</option>
                  <option value="betrunken">betrunken</option>
                </select>
              </label>
              <label className="editor-lage">
                Anrufer-Skript (optional)
                <input
                  aria-label={`Einsatz ${i + 1} Anruferskript`}
                  placeholder="Eigener Eröffnungssatz des Anrufers…"
                  value={e.lageText ?? ''}
                  onChange={(ev) => update(i, { lageText: ev.target.value || undefined })}
                />
              </label>
              <button
                aria-label={`Einsatz ${i + 1} entfernen`}
                title="Entfernen"
                onClick={() => setEinsaetze((list) => list.filter((_, j) => j !== i))}
                disabled={einsaetze.length === 1}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div className="editor-actions">
        <button
          onClick={() =>
            setEinsaetze((list) => [
              ...list,
              { ...DEFAULT_EINSATZ, atSec: (list.at(-1)?.atSec ?? 0) + 300 },
            ])
          }
        >
          + Einsatz
        </button>
        <button onClick={exportJson}>Als Datei exportieren</button>
        <button onClick={() => fileRef.current?.click()}>Datei importieren</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          hidden
          aria-label="Übungsdatei importieren"
          onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
        />
        <span className="editor-spacer" />
        <button onClick={() => navigate('/')}>Zurück</button>
        <button className="editor-start" data-testid="uebung-starten" onClick={() => void startUebung()}>
          Als ÜBUNG starten
        </button>
      </div>
      {error && <p className="editor-error">{error}</p>}
    </div>
  )
}
