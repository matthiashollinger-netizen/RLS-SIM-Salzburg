import { create } from 'zustand'
import {
  createEndpointEngine,
  createWebLlmEngine,
} from '../llm/engines.ts'
import type { CallerEngine, EndpointConfig, LlmTier, WebLlmModelId } from '../llm/types.ts'
import { setTtsEnabled } from '../llm/tts.ts'

/** KI-Anrufer settings + engine lifecycle (M6). Tier 1 = Light-Modus (default). */

const SETTINGS_KEY = 'rls-settings-v1'

interface PersistedSettings {
  tier: LlmTier
  modelId: WebLlmModelId
  endpoint: EndpointConfig
  tts: boolean
}

function loadSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    tier: 'tier1',
    modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    endpoint: { url: '', apiKey: '', model: 'llama3.1' },
    tts: false,
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
  } catch {
    return defaults
  }
}

function persist(s: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // best effort
  }
}

interface LlmState {
  tier: LlmTier
  modelId: WebLlmModelId
  endpoint: EndpointConfig
  ttsEnabled: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number
  progressText: string
  engine: CallerEngine | null
  setTier: (t: LlmTier) => void
  setModelId: (m: WebLlmModelId) => void
  setEndpoint: (e: EndpointConfig) => void
  setTts: (v: boolean) => void
  /** Load/activate the engine for the chosen tier (user-triggered, ~GB download for WebLLM). */
  activate: () => Promise<void>
}

export const useLlmStore = create<LlmState>((set, get) => {
  const initial = loadSettings()
  setTtsEnabled(initial.tts)

  const persistNow = () => {
    const s = get()
    persist({ tier: s.tier, modelId: s.modelId, endpoint: s.endpoint, tts: s.ttsEnabled })
  }

  return {
    tier: initial.tier,
    modelId: initial.modelId,
    endpoint: initial.endpoint,
    ttsEnabled: initial.tts,
    status: 'idle',
    progress: 0,
    progressText: '',
    engine: null,

    setTier: (tier) => {
      get().engine?.dispose?.()
      set({ tier, engine: null, status: 'idle', progress: 0, progressText: '' })
      persistNow()
    },
    setModelId: (modelId) => {
      set({ modelId })
      persistNow()
    },
    setEndpoint: (endpoint) => {
      set({ endpoint })
      persistNow()
    },
    setTts: (ttsEnabled) => {
      set({ ttsEnabled })
      setTtsEnabled(ttsEnabled)
      persistNow()
    },

    activate: async () => {
      const s = get()
      if (s.tier === 'tier1') {
        set({ status: 'idle', engine: null })
        return
      }
      if (s.status === 'loading') return
      set({ status: 'loading', progress: 0, progressText: 'Initialisiere…' })
      try {
        if (s.tier === 'webllm') {
          const engine = await createWebLlmEngine(s.modelId, (progress, text) =>
            set({ progress, progressText: text }),
          )
          set({ engine, status: 'ready', progress: 1 })
        } else {
          const engine = createEndpointEngine(s.endpoint)
          // probe with a tiny request so errors surface in the UI
          await engine.generate(
            [
              { role: 'system', content: 'Antworte mit OK.' },
              { role: 'user', content: 'Test' },
            ],
            { maxTokens: 4 },
          )
          set({ engine, status: 'ready', progress: 1, progressText: 'Endpoint verbunden' })
        }
      } catch (err) {
        set({
          status: 'error',
          progressText: err instanceof Error ? err.message : 'Unbekannter Fehler',
        })
      }
    },
  }
})
