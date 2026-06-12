import { useMemo, useState } from 'react'
import {
  HAUPTBESCHWERDEN,
  KT_KATEGORIEN,
  buildMerkmalskette,
  categoryFromAnswers,
} from '../engine/abfrage.ts'
import { deriveCode } from '../engine/ao.ts'
import { haversineKm } from '../engine/geo.ts'
import { searchAddress } from '../lib/fuzzy.ts'
import { useCallStore } from '../state/callStore.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { alarmtext } from '../engine/auftrag.ts'
import './panels.css'
import './call-panels.css'

/**
 * Abfrageschema-Fenster (Rework 2, Fenster-Split): das OFFIZIELLE
 * standardisierte Schema — Ja/Nein-Fragen und Auswahlpunkte, die der
 * Calltaker selbst aus dem Gespräch NOTIERT (kein Auto-Fill). Daraus
 * entsteht der Einsatz; editierbar bleibt er ohnehin.
 */

function JaNein({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | undefined
  onChange: (v: boolean) => void
}) {
  return (
    <div className="janein-row">
      <span className="janein-label">{label}</span>
      <button
        className={value === true ? 'beschwerde-active' : ''}
        aria-pressed={value === true}
        onClick={() => onChange(true)}
      >
        Ja
      </button>
      <button
        className={value === false ? 'beschwerde-active' : ''}
        aria-pressed={value === false}
        onClick={() => onChange(false)}
      >
        Nein
      </button>
    </div>
  )
}

function AdresseBlock() {
  const active = useCallStore((s) => s.active)
  const setAdresse = useCallStore((s) => s.setAdresse)
  const requestOrtungsSms = useCallStore((s) => s.requestOrtungsSms)
  const requestNetzbetreiber = useCallStore((s) => s.requestNetzbetreiber)
  const region = useGameStore((s) => s.region)
  const [query, setQuery] = useState('')

  const hits = useMemo(() => searchAddress(query, region), [query, region])
  if (!active) return null
  const adresse = active.answers.adresse

  return (
    <div className="adresse-block">
      <div className="adresse-row">
        <strong>Adresse:</strong>{' '}
        {adresse ? (
          <span data-testid="adresse-value">
            {adresse.strasse}, {adresse.stadtteil}{' '}
            <em className="adresse-quelle">({adresse.quelle})</em>
          </span>
        ) : (
          <em>unbekannt</em>
        )}
      </div>
      <div className="adresse-search">
        <input
          aria-label="Adresse suchen"
          placeholder="Adresse suchen (z. B. lehen ignaz)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {hits.length > 0 && query.length >= 2 && (
          <ul className="adresse-hits">
            {hits.map((h) => (
              <li key={`${h.place.id}-${h.strasse}`}>
                <button
                  onClick={() => {
                    setAdresse({
                      stadtteil: h.place.name,
                      strasse: h.strasse,
                      lat: h.place.lat,
                      lon: h.place.lon,
                      quelle: 'Abfrage',
                    })
                    setQuery('')
                  }}
                >
                  {h.strasse}, {h.place.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ortung-row">
        {active.amlPoint ? (
          <span className="ortung-ok" data-testid="ortung-status">
            📍 {active.amlPoint.quelle}-Ortung ±{active.amlPoint.radiusM} m
          </span>
        ) : (
          <span className="ortung-wait" data-testid="ortung-status">
            {active.scenario.phone === 'handy' ? 'Warte auf AML…' : 'Festnetz — keine AML'}
          </span>
        )}
        <button onClick={requestOrtungsSms} disabled={active.smsResult === 'pending'}>
          Ortungs-SMS
        </button>
        <button onClick={requestNetzbetreiber} disabled={!!active.netzAbfrageAt}>
          Netzbetreiber
        </button>
        {active.amlPoint && (
          <button
            onClick={() =>
              setAdresse({
                stadtteil: 'Ortungspunkt',
                strasse: `±${active.amlPoint!.radiusM} m (${active.amlPoint!.quelle})`,
                lat: active.amlPoint!.lat,
                lon: active.amlPoint!.lon,
                quelle: active.amlPoint!.quelle,
              })
            }
          >
            Ortung übernehmen
          </button>
        )}
      </div>
    </div>
  )
}

function DuplikatBlock() {
  const active = useCallStore((s) => s.active)
  const assignToExisting = useCallStore((s) => s.assignToExisting)
  const hangup = useCallStore((s) => s.hangup)
  const auftraege = useDispatchStore((s) => s.auftraege)
  if (!active) return null
  const pos = active.answers.adresse ?? active.amlPoint
  if (!pos) return null
  const nearby = Object.values(auftraege).filter(
    (a) =>
      a.state !== 'abgeschlossen' &&
      haversineKm({ lat: pos.lat, lon: pos.lon }, { lat: a.ort.lat, lon: a.ort.lon }) < 2,
  )
  if (nearby.length === 0) return null
  return (
    <div className="duplikat-block" data-testid="duplikat-block">
      <strong>⚠ Offene Einsätze in der Nähe — Duplizität prüfen:</strong>
      {nearby.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            assignToExisting(a.id)
            hangup()
          }}
        >
          Zuordnen zu {a.id} ({alarmtext(a)})
        </button>
      ))}
    </div>
  )
}

export function AbfragePanel() {
  const active = useCallStore((s) => s.active)
  const setAnswer = useCallStore((s) => s.setAnswer)
  const chooseHauptbeschwerde = useCallStore((s) => s.chooseHauptbeschwerde)
  const createAuftrag = useCallStore((s) => s.createAuftrag)

  if (!active) {
    return (
      <div className="panel-empty" data-testid="abfrage-panel">
        <p>Kein aktives Gespräch.</p>
        <p className="panel-hint">
          Das offizielle Abfrageschema füllt sich mit dem nächsten Anruf — Antworten
          aus dem Gespräch hier selbst notieren.
        </p>
      </div>
    )
  }

  const a = active.answers
  const derived = categoryFromAnswers(a)
  const codePreview = deriveCode(derived.categoryId, {
    personen: a.personen ?? 1,
    severity: derived.severity,
  })
  const merkmalskette = buildMerkmalskette(a)
  const canCreate = !!a.adresse || !!active.amlPoint

  return (
    <div className="abfrage-panel" data-testid="abfrage-panel">
      <div className="schema-grid">
        <section className="schema-section">
          <h4>1 · Notfallort</h4>
          <AdresseBlock />
        </section>

        <section className="schema-section">
          <h4>2 · Anrufer & Personen</h4>
          <div className="anrufer-rolle-row">
            <span>Anrufer:</span>
            {(['selbst', 'angehoeriger', 'passant', 'fachpersonal', 'kind'] as const).map((r) => (
              <button
                key={r}
                className={a.rolle === r ? 'beschwerde-active' : ''}
                onClick={() => setAnswer({ rolle: r })}
              >
                {r === 'selbst'
                  ? 'Selbst'
                  : r === 'angehoeriger'
                    ? 'Angehörige/r'
                    : r === 'passant'
                      ? 'Passant'
                      : r === 'fachpersonal'
                        ? 'Fachpersonal'
                        : 'Kind'}
              </button>
            ))}
          </div>
          <div className="schema-numbers">
            <label>
              Personen
              <input
                aria-label="Personenzahl notieren"
                type="number"
                min={1}
                max={200}
                value={a.personen ?? ''}
                onChange={(e) =>
                  setAnswer({ personen: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </label>
            <label>
              Alter (ca.)
              <input
                aria-label="Alter notieren"
                type="number"
                min={0}
                max={120}
                value={a.alter ?? ''}
                onChange={(e) =>
                  setAnswer({ alter: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </label>
            <label className="panel-checkbox schema-rueckruf">
              <input
                type="checkbox"
                checked={a.rueckrufOk === true}
                onChange={(e) => setAnswer({ rueckrufOk: e.target.checked })}
              />
              Rückruf bestätigt
            </label>
          </div>
        </section>

        <section className="schema-section">
          <h4>3 · Vitalstatus (Schlüsselfragen)</h4>
          <JaNein
            label="Person ansprechbar?"
            value={a.ansprechbar}
            onChange={(v) => setAnswer({ ansprechbar: v })}
          />
          <JaNein label="Atmet normal?" value={a.atmet} onChange={(v) => setAnswer({ atmet: v })} />
          <div className="janein-row">
            <span className="janein-label">Zugang</span>
            <select
              aria-label="Zugang notieren"
              value={a.zugang ?? ''}
              onChange={(e) =>
                setAnswer({
                  zugang: (e.target.value || undefined) as
                    | 'frei'
                    | 'versperrt'
                    | 'schwer'
                    | undefined,
                })
              }
            >
              <option value="">—</option>
              <option value="frei">frei zugänglich</option>
              <option value="versperrt">versperrt</option>
              <option value="schwer">schwer zugänglich</option>
            </select>
          </div>
          {a.atmet === false && (
            <p className="schema-warn">
              ⚠ Keine normale Atmung → STILL (A1) — Telefonreanimation anleiten!
            </p>
          )}
        </section>

        <section className="schema-section">
          <h4>4 · Hauptbeschwerde / Stichwort</h4>
          <div className="beschwerde-grid" data-testid="beschwerde-grid">
            {HAUPTBESCHWERDEN.map((h) => (
              <button
                key={h.id}
                className={a.hauptbeschwerdeId === h.id ? 'beschwerde-active' : ''}
                onClick={() => chooseHauptbeschwerde(h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="kt-row">
            KT-Anmeldung:
            {KT_KATEGORIEN.map((kt) => (
              <button
                key={kt}
                className={a.categoryId === kt ? 'beschwerde-active' : ''}
                onClick={() => setAnswer({ categoryId: kt })}
              >
                {kt}
              </button>
            ))}
          </div>
        </section>
      </div>

      <DuplikatBlock />

      <div className="merkmalskette-preview">
        <strong>Merkmalskette:</strong> {merkmalskette.join(', ')}
      </div>

      <div className="abfrage-actions">
        <span className="code-preview">
          Stichwort: <span className="mono">{codePreview}</span> {derived.categoryId}
        </span>
        <button
          className="create-auftrag-btn"
          disabled={!canCreate}
          data-testid="auftrag-anlegen"
          onClick={() => createAuftrag()}
        >
          {active.auftragId ? `Auftrag ${active.auftragId} angelegt ✓` : 'Auftrag anlegen'}
        </button>
      </div>
    </div>
  )
}
