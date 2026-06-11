import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt } from './prompt.ts'
import { classifyFreeText } from './classify.ts'
import { createEndpointEngine, createMockEngine } from './engines.ts'
import { generateScenario } from '../engine/scenario.ts'
import { mulberry32 } from '../engine/rng.ts'

function demoScenario(seed = 5) {
  const rng = mulberry32(seed)
  return generateScenario(rng, {
    region: 'NORD',
    forceType: 'notfall',
    forceHauptbeschwerde: 'brustschmerz',
  })
}

describe('system prompt builder (AI_CALLER_TECH rules)', () => {
  it('contains the truth facts and the no-invention rule', () => {
    const s = demoScenario()
    const prompt = buildSystemPrompt(s)
    expect(prompt).toContain(s.truth.ort.strasse)
    expect(prompt).toContain(s.truth.lageText)
    expect(prompt).toContain('Erfinde NIEMALS neue Fakten')
    expect(prompt).toContain('Ich weiß es nicht!')
    expect(prompt).toContain('1–2 Sätze')
  })

  it('lists withheld information when present', () => {
    const s = demoScenario()
    s.anrufer.verschweigtBisGefragt = ['alter']
    expect(buildSystemPrompt(s)).toContain('NUR preis, wenn konkret danach gefragt')
  })

  it('marks unknown address and english callers', () => {
    const s = demoScenario()
    s.anrufer.kenntAdresse = false
    s.anrufer.sprache = 'en'
    const prompt = buildSystemPrompt(s)
    expect(prompt).toContain('kennst die genaue Adresse NICHT')
    expect(prompt).toContain('NUR Englisch')
  })
})

describe('free-text question classifier', () => {
  it('maps common phrasings to catalog questions', () => {
    expect(classifyFreeText('Wo genau sind Sie denn?')).toBe('ort')
    expect(classifyFreeText('Was ist denn passiert?')).toBe('geschehen')
    expect(classifyFreeText('Atmet er noch normal?')).toBe('atmung')
    expect(classifyFreeText('Ist die Person ansprechbar?')).toBe('bewusstsein')
    expect(classifyFreeText('Wie alt ist Ihre Mutter?')).toBe('alter')
    expect(classifyFreeText('Bleiben Sie ganz ruhig.')).toBe('beruhigen')
    expect(classifyFreeText('Kommen wir gut zur Wohnung rein?')).toBe('zugang')
  })

  it('returns null for unrelated text', () => {
    expect(classifyFreeText('Haben Sie ein Haustier?')).toBeNull()
  })
})

describe('mock engine (CI)', () => {
  it('answers deterministically based on the last question', async () => {
    const engine = createMockEngine()
    const reply = await engine.generate([
      { role: 'system', content: 'x' },
      { role: 'user', content: 'Wo genau ist der Notfallort?' },
    ])
    expect(reply).toContain('MOCK')
    expect(reply).toContain('Teststraße')
  })
})

describe('endpoint engine (OpenAI-compatible)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts to /v1/chat/completions with auth header and parses the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: ' Hallo! ' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const engine = createEndpointEngine({
      url: 'http://localhost:11434',
      apiKey: 'sk-test',
      model: 'llama3.1',
    })
    const reply = await engine.generate([{ role: 'user', content: 'Hi' }])
    expect(reply).toBe('Hallo!')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('llama3.1')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('does not double the /v1 suffix and surfaces HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    const engine = createEndpointEngine({ url: 'https://api.example.com/v1/', apiKey: '', model: 'm' })
    await expect(engine.generate([{ role: 'user', content: 'x' }])).rejects.toThrow('401')
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.com/v1/chat/completions')
  })
})
