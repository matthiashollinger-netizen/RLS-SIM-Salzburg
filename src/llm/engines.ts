import type {
  CallerEngine,
  ChatMessage,
  EndpointConfig,
  GenerateOptions,
  WebLlmModelId,
} from './types.ts'

/** CI/e2e mock flag — set localStorage 'rls-llm-mock' = '1' before load. */
export function isMockMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('rls-llm-mock') === '1'
  } catch {
    return false
  }
}

/** Deterministic mock engine (CI without GPU — CLAUDE.md M6). */
export function createMockEngine(): CallerEngine {
  return {
    kind: 'mock',
    async generate(messages: ChatMessage[]) {
      const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
      if (/wo|adresse|stra(ß|ss)e/i.test(last))
        return 'MOCK: Wir sind in der Teststraße, gleich beim Bahnhof!'
      if (/atmet|atmung/i.test(last)) return 'MOCK: Ja, atmen tut er, aber ganz schwer!'
      if (/was.*(passiert|los)/i.test(last)) return 'MOCK: Er ist einfach umgekippt!'
      return 'MOCK: Bitte schicken Sie schnell jemanden!'
    },
  }
}

/**
 * WebLLM in a web worker. The heavy library chunk loads only when this is
 * called (Light-Modus by default).
 */
export async function createWebLlmEngine(
  modelId: WebLlmModelId,
  onProgress: (progress: number, text: string) => void,
): Promise<CallerEngine> {
  if (isMockMode()) {
    onProgress(1, 'Mock-Engine (CI) geladen')
    return createMockEngine()
  }
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
  const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' })
  const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (p) => onProgress(p.progress, p.text),
  })
  return {
    kind: 'webllm',
    async generate(messages: ChatMessage[], opts?: GenerateOptions) {
      const reply = await engine.chat.completions.create({
        messages,
        temperature: opts?.temperature ?? 0.8,
        max_tokens: opts?.maxTokens ?? 120,
      })
      return reply.choices[0]?.message?.content?.trim() ?? 'Ich… hallo? Sind Sie noch dran?'
    },
    dispose() {
      worker.terminate()
    },
  }
}

/** Tier 3: any OpenAI-compatible endpoint (Ollama, cloud, …). */
export function createEndpointEngine(config: EndpointConfig): CallerEngine {
  return {
    kind: 'endpoint',
    async generate(messages: ChatMessage[], opts?: GenerateOptions) {
      const base = config.url.replace(/\/+$/, '')
      const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: opts?.temperature ?? 0.8,
          max_tokens: opts?.maxTokens ?? 120,
        }),
      })
      if (!res.ok) throw new Error(`Endpoint-Fehler ${res.status}`)
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      return data.choices?.[0]?.message?.content?.trim() ?? '…'
    },
  }
}
