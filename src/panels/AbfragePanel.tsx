import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FRAGEN,
  HAUPTBESCHWERDEN,
  KT_KATEGORIEN,
  buildMerkmalskette,
  categoryFromAnswers,
  hauptbeschwerdeById,
} from '../engine/abfrage.ts'
import { deriveCode } from '../engine/ao.ts'
import { haversineKm } from '../engine/geo.ts'
import { searchAddress } from '../lib/fuzzy.ts'
import { formatCountdown } from '../lib/format.ts'
import { useCallStore } from '../state/callStore.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useLlmStore } from '../state/llmStore.ts'
import { alarmtext } from '../engine/auftrag.ts'
import './panels.css'
import './call-panels.css'

function Transcript() {
  const active = useCallStore((s) => s.active)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [active?.transcript.length])
  if (!active) return null
  return (
    <div className="transcript" data-testid="transcript" role="log" aria-live="polite" aria-label="Gesprächsverlauf">
      {active.transcript.map((t, i) => (
        <p key={i} className={`transcript-${t.from}`}>
          {t.from === 'anrufer' ? '☎ ' : t.from === 'calltaker' ? '🎧 ' : 'ℹ '}
          {t.text}
        </p>
      ))}
      <div ref={endRef} />
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

/** One numbered step of the standardized questionnaire (Rework #3). */
function Schritt({
  nr,
  title,
  done,
  current,
  children,
}: {
  nr: number
  title: string
  done: boolean
  current: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`abfrage-schritt${done ? ' schritt-done' : ''}${current ? ' schritt-current' : ''}`}
      aria-label={`Schritt ${nr}: ${title}`}
    >
      <header className="schritt-header">
        <span className="schritt-nr mono">{done ? '✓' : nr}</span>
        <span className="schritt-title">{title}</span>
      </header>
      <div className="schritt-body">{children}</div>
    </section>
  )
}

export function AbfragePanel() {
  const active = useCallStore((s) => s.active)
  const ask = useCallStore((s) => s.ask)
  const askFreeText = useCallStore((s) => s.askFreeText)
  const generating = useCallStore((s) => s.generating)
  const hangup = useCallStore((s) => s.hangup)
  const chooseHauptbeschwerde = useCallStore((s) => s.chooseHauptbeschwerde)
  const setAnswer = useCallStore((s) => s.setAnswer)
  const createAuftrag = useCallStore((s) => s.createAuftrag)
  const simSec = useGameStore((s) => s.simSec)
  const llmStatus = useLlmStore((s) => s.status)
  const [freeText, setFreeText] = useState('')

  if (!active) {
    return (
      <div className="panel-empty" data-testid="abfrage-panel">
        <p>Kein aktives Gespräch.</p>
        <p className="panel-hint">Anruf in der Anruf-Queue annehmen.</p>
      </div>
    )
  }

  const a = active.answers
  const asked = active.callerState.asked
  const hb = a.hauptbeschwerdeId ? hauptbeschwerdeById.get(a.hauptbeschwerdeId) : undefined
  const derived = categoryFromAnswers(a)
  const codePreview = deriveCode(derived.categoryId, {
    personen: a.personen ?? 1,
    severity: derived.severity,
  })
  const merkmalskette = buildMerkmalskette(a)
  const canCreate = !!a.adresse || !!active.amlPoint

  // standardized phases (GAME_DATA §3) with completion state
  const ortDone = !!a.adresse
  const geschehenDone = !!a.hauptbeschwerdeId || !!a.categoryId
  const personenDone = a.personen !== undefined && a.rueckrufOk === true
  const vitalDone = a.ansprechbar !== undefined && a.atmet !== undefined
  const detailDone = asked.includes('detail1') || asked.includes('detail2')
  const steps = [ortDone, geschehenDone, personenDone, vitalDone, detailDone]
  const currentStep = steps.findIndex((d) => !d) + 1 || 6

  const frage = (id: string) => FRAGEN.find((f) => f.id === id)!

  return (
    <div className="abfrage-panel" data-testid="abfrage-panel">
      <div className="abfrage-header">
        <span className="mono">{active.id}</span>
        <span>{active.scenario.phone === 'handy' ? 'Mobil' : 'Festnetz'}</span>
        <span className="mono">
          ⏱ {active.answeredAt !== undefined ? formatCountdown(simSec - active.answeredAt) : ''}
        </span>
        <span
          className={`llm-indicator ${llmStatus === 'ready' ? 'llm-on' : ''}`}
          title={
            llmStatus === 'ready'
              ? 'KI-Anrufer aktiv (freie Antworten)'
              : 'Dialogbaum aktiv — KI-Anrufer in ⚙ Einstellungen aktivierbar'
          }
        >
          {llmStatus === 'ready' ? 'KI' : 'Skript'}
        </span>
        <button onClick={() => ask('beruhigen')} title="Anrufer beruhigen">
          Beruhigen
        </button>
        <button className="hangup-btn" onClick={hangup}>
          Auflegen
        </button>
      </div>

      <Transcript />
      {generating && <div className="caller-typing">Anrufer spricht…</div>}

      <form
        className="freitext-row"
        onSubmit={(e) => {
          e.preventDefault()
          const text = freeText.trim()
          if (!text) return
          askFreeText(text)
          setFreeText('')
        }}
      >
        <input
          aria-label="Freitext-Frage"
          placeholder="Eigene Frage stellen…"
          value={freeText}
          disabled={generating}
          onChange={(e) => setFreeText(e.target.value)}
        />
        <button type="submit" disabled={generating || !freeText.trim()}>
          Fragen
        </button>
      </form>

      <div className="abfrage-schritte" data-testid="abfrage-schritte">
        <Schritt nr={1} title="Notfallort" done={ortDone} current={currentStep === 1}>
          <div className="schritt-buttons">
            <button onClick={() => ask('ort')}>{frage('ort').text}</button>
          </div>
          <AdresseBlock />
        </Schritt>

        <Schritt nr={2} title="Was ist passiert?" done={geschehenDone} current={currentStep === 2}>
          <div className="schritt-buttons">
            <button onClick={() => ask('geschehen')}>{frage('geschehen').text}</button>
          </div>
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
        </Schritt>

        <Schritt nr={3} title="Personen & Rückruf" done={personenDone} current={currentStep === 3}>
          <div className="schritt-buttons">
            <button onClick={() => ask('personen')}>{frage('personen').text}</button>
            <button onClick={() => ask('rueckruf')}>{frage('rueckruf').text}</button>
          </div>
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
        </Schritt>

        <Schritt nr={4} title="Vitalfragen" done={vitalDone} current={currentStep === 4}>
          <div className="schritt-buttons">
            <button onClick={() => ask('bewusstsein')}>{frage('bewusstsein').text}</button>
            <button onClick={() => ask('atmung')}>{frage('atmung').text}</button>
            <button onClick={() => ask('alter')}>{frage('alter').text}</button>
            <button onClick={() => ask('zugang')}>{frage('zugang').text}</button>
          </div>
        </Schritt>

        <Schritt
          nr={5}
          title={hb ? `Detailfragen (${hb.label})` : 'Detailfragen'}
          done={detailDone}
          current={currentStep === 5}
        >
          {hb ? (
            <div className="schritt-buttons">
              <button onClick={() => ask('detail1')}>{hb.detailFragen[0]}</button>
              <button onClick={() => ask('detail2')}>{hb.detailFragen[1]}</button>
              <button onClick={() => ask('eh_anweisung')}>EH-Anweisung geben</button>
            </div>
          ) : (
            <p className="schritt-hint">Zuerst in Schritt 2 die Hauptbeschwerde wählen.</p>
          )}
        </Schritt>
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
