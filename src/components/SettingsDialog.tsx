import { useEffect, useState } from 'react'
import { useLlmStore } from '../state/llmStore.ts'
import { isTtsAvailable } from '../llm/tts.ts'
import { WEBLLM_MODELS, type WebLlmModelId } from '../llm/types.ts'
import { getVolume, setVolume } from '../audio/sounds.ts'
import { ACHIEVEMENTS, useAchievementStore } from '../state/achievementStore.ts'
import './settings-dialog.css'

const MIXER_CHANNELS = [
  { id: 'master' as const, label: 'Gesamt' },
  { id: 'ring' as const, label: 'Telefon' },
  { id: 'funk' as const, label: 'Funk-Quittung' },
  { id: 'gong' as const, label: 'Pager-Gong' },
]

function SoundMixer() {
  const [, force] = useState(0)
  return (
    <section className="settings-section">
      <h3>Sound-Mixer</h3>
      {MIXER_CHANNELS.map((c) => (
        <label key={c.id} className="mixer-row">
          <span>{c.label}</span>
          <input
            type="range"
            min={0}
            max={100}
            aria-label={`Lautstärke ${c.label}`}
            value={Math.round(getVolume(c.id) * 100)}
            onChange={(e) => {
              setVolume(c.id, Number(e.target.value) / 100)
              force((n) => n + 1)
            }}
          />
        </label>
      ))}
    </section>
  )
}

function AchievementList() {
  const unlocked = useAchievementStore((s) => s.unlocked)
  useEffect(() => {
    void useAchievementStore.getState().load()
  }, [])
  return (
    <section className="settings-section">
      <h3>Erfolge</h3>
      <ul className="achievement-list">
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} className={unlocked[a.id] ? 'achievement-unlocked' : 'achievement-locked'}>
            <span aria-hidden="true">{unlocked[a.id] ? '★' : '☆'}</span> <strong>{a.title}</strong>{' '}
            — {a.description}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const llm = useLlmStore()
  const [endpointDraft, setEndpointDraft] = useState(llm.endpoint)

  return (
    <div className="settings-overlay" role="dialog" aria-label="Einstellungen">
      <div className="settings-dialog">
        <header className="settings-header">
          <h2>Einstellungen</h2>
          <button aria-label="Einstellungen schließen" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="settings-section">
          <h3>KI-Anrufer</h3>
          <p className="settings-hint">
            Light-Modus (Dialogbaum) ist sofort spielbar. WebLLM lädt einmalig ein Sprachmodell
            (~1–2 GB, danach offline verfügbar).
          </p>
          <div className="settings-row" role="radiogroup" aria-label="KI-Stufe">
            <label>
              <input
                type="radio"
                name="tier"
                checked={llm.tier === 'tier1'}
                onChange={() => llm.setTier('tier1')}
              />
              Light-Modus ohne KI (Dialogbaum)
            </label>
            <label>
              <input
                type="radio"
                name="tier"
                checked={llm.tier === 'webllm'}
                onChange={() => llm.setTier('webllm')}
              />
              WebLLM (lokal im Browser)
            </label>
            <label>
              <input
                type="radio"
                name="tier"
                checked={llm.tier === 'endpoint'}
                onChange={() => llm.setTier('endpoint')}
              />
              Eigener Endpoint (OpenAI-kompatibel)
            </label>
          </div>

          {llm.tier === 'webllm' && (
            <div className="settings-row">
              <select
                aria-label="WebLLM-Modell"
                value={llm.modelId}
                onChange={(e) => llm.setModelId(e.target.value as WebLlmModelId)}
              >
                {WEBLLM_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button onClick={() => void llm.activate()} disabled={llm.status === 'loading'}>
                {llm.status === 'ready' ? 'Neu laden' : 'Modell laden'}
              </button>
            </div>
          )}

          {llm.tier === 'endpoint' && (
            <div className="settings-endpoint">
              <input
                aria-label="Endpoint-URL"
                placeholder="https://localhost:11434 (Ollama) oder https://…/v1"
                value={endpointDraft.url}
                onChange={(e) => setEndpointDraft({ ...endpointDraft, url: e.target.value })}
              />
              <input
                aria-label="API-Key"
                placeholder="API-Key (optional)"
                type="password"
                value={endpointDraft.apiKey}
                onChange={(e) => setEndpointDraft({ ...endpointDraft, apiKey: e.target.value })}
              />
              <input
                aria-label="Modellname"
                placeholder="Modell (z. B. llama3.1)"
                value={endpointDraft.model}
                onChange={(e) => setEndpointDraft({ ...endpointDraft, model: e.target.value })}
              />
              <button
                onClick={() => {
                  llm.setEndpoint(endpointDraft)
                  void llm.activate()
                }}
                disabled={llm.status === 'loading' || !endpointDraft.url}
              >
                Verbinden
              </button>
            </div>
          )}

          {llm.tier !== 'tier1' && (
            <div className="settings-status" data-testid="llm-status">
              {llm.status === 'idle' && <span>Nicht geladen.</span>}
              {llm.status === 'loading' && (
                <>
                  <progress value={llm.progress} max={1} />
                  <span>{llm.progressText}</span>
                </>
              )}
              {llm.status === 'ready' && <span className="settings-ok">✓ KI-Anrufer aktiv</span>}
              {llm.status === 'error' && (
                <span className="settings-error">Fehler: {llm.progressText}</span>
              )}
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>Sprachausgabe</h3>
          <label>
            <input
              type="checkbox"
              checked={llm.ttsEnabled}
              disabled={!isTtsAvailable()}
              onChange={(e) => llm.setTts(e.target.checked)}
            />
            Anrufer vorlesen (Web Speech, deutsche Stimme{isTtsAvailable() ? '' : ' — nicht verfügbar'})
          </label>
        </section>

        <SoundMixer />
        <AchievementList />
      </div>
    </div>
  )
}
