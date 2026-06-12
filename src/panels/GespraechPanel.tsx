import { useEffect, useRef, useState } from 'react'
import { FRAGEN, hauptbeschwerdeById } from '../engine/abfrage.ts'
import { formatCountdown } from '../lib/format.ts'
import { useCallStore } from '../state/callStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useLlmStore } from '../state/llmStore.ts'
import './panels.css'
import './call-panels.css'

/**
 * Gesprächs-Fenster (Rework 2, Fenster-Split): hier wird mit dem Anrufer
 * GESPROCHEN — Fragen stellen (Buttons/Freitext), beruhigen, auflegen.
 * Die Antworten NOTIERT der Calltaker selbst im Abfrageschema-Fenster.
 */

function Transcript() {
  const active = useCallStore((s) => s.active)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [active?.transcript.length])
  if (!active) return null
  return (
    <div
      className="transcript transcript-tall"
      data-testid="transcript"
      role="log"
      aria-live="polite"
      aria-label="Gesprächsverlauf"
    >
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

export function GespraechPanel() {
  const active = useCallStore((s) => s.active)
  const ask = useCallStore((s) => s.ask)
  const askFreeText = useCallStore((s) => s.askFreeText)
  const generating = useCallStore((s) => s.generating)
  const hangup = useCallStore((s) => s.hangup)
  const simSec = useGameStore((s) => s.simSec)
  const llmStatus = useLlmStore((s) => s.status)
  const [freeText, setFreeText] = useState('')

  if (!active) {
    return (
      <div className="panel-empty" data-testid="gespraech-panel">
        <p>Kein aktives Gespräch.</p>
        <p className="panel-hint">Anruf in der Anruf-Queue annehmen.</p>
      </div>
    )
  }

  const hb = active.answers.hauptbeschwerdeId
    ? hauptbeschwerdeById.get(active.answers.hauptbeschwerdeId)
    : undefined

  return (
    <div className="abfrage-panel" data-testid="gespraech-panel">
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

      <div className="frage-buttons">
        {FRAGEN.filter((f) => f.phase === 1).map((f) => (
          <button key={f.id} onClick={() => ask(f.id)}>
            {f.text}
          </button>
        ))}
        {FRAGEN.filter((f) => f.phase === 2).map((f) => (
          <button key={f.id} onClick={() => ask(f.id)}>
            {f.text}
          </button>
        ))}
        {hb && (
          <>
            <button onClick={() => ask('detail1')}>{hb.detailFragen[0]}</button>
            <button onClick={() => ask('detail2')}>{hb.detailFragen[1]}</button>
          </>
        )}
        <button onClick={() => ask('eh_anweisung')}>EH-Anweisung geben</button>
      </div>
      <p className="schritt-hint">
        Antworten im Fenster „Abfrageschema" notieren — daraus entsteht der Einsatz.
      </p>
    </div>
  )
}
