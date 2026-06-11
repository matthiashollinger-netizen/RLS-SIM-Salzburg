import { describe, expect, it } from 'vitest'
import {
  HAUPTBESCHWERDEN,
  buildMerkmalskette,
  categoryFromAnswers,
  hauptbeschwerdeById,
} from './abfrage.ts'
import { categoryById } from '../data/index.ts'
import { answerFor, greeting, initialCallerState } from './callerScript.ts'
import { generateScenario } from './scenario.ts'
import { mulberry32 } from './rng.ts'
import { searchAddress } from '../lib/fuzzy.ts'

describe('Merkmalskette → Kategorie mapping', () => {
  it('every Hauptbeschwerde maps to an existing emergency category', () => {
    for (const hb of HAUPTBESCHWERDEN) {
      const cat = categoryById.get(hb.categoryId)
      expect(cat, hb.id).toBeDefined()
    }
  })

  it('keine Atmung overrides everything → STILL (A1)', () => {
    const result = categoryFromAnswers({ hauptbeschwerdeId: 'sturz', atmet: false })
    expect(result).toEqual({ categoryId: 'STILL', severity: 'hoch' })
  })

  it('bewusstlos upgrades severity to hoch', () => {
    const result = categoryFromAnswers({
      hauptbeschwerdeId: 'sturz',
      atmet: true,
      ansprechbar: false,
    })
    expect(result).toEqual({ categoryId: 'TRAUMA', severity: 'hoch' })
  })

  it('no Hauptbeschwerde chosen → SONST (unklare Lage, konservativ)', () => {
    expect(categoryFromAnswers({})).toEqual({ categoryId: 'SONST', severity: 'hoch' })
  })

  it('builds the ELS chain in the official style (GAME_DATA §4 example)', () => {
    const kette = buildMerkmalskette({
      rolle: 'angehoeriger',
      personen: 1,
      alter: 54,
      ansprechbar: true,
      hauptbeschwerdeId: 'allergie',
      zugang: 'frei',
    })
    expect(kette[0]).toBe('medizinischer Notruf')
    expect(kette).toContain('Fremdanrufer Angehörige/r')
    expect(kette).toContain('1 Person betroffen/in Gefahr')
    expect(kette).toContain('Erwachsener (ab 13 J.)')
    expect(kette).toContain('Person spricht')
    expect(kette).toContain('Allergische Reaktion')
    expect(kette).toContain('Person frei zugänglich')
  })
})

describe('Tier-1 caller script', () => {
  function demoScenario(seed = 3) {
    const rng = mulberry32(seed)
    return generateScenario(rng, {
      region: 'NORD',
      forceType: 'notfall',
      forceHauptbeschwerde: 'brustschmerz',
    })
  }

  it('greeting reflects the Lage', () => {
    const s = demoScenario()
    expect(greeting(s).length).toBeGreaterThan(10)
  })

  it('answers reveal the truth on matching questions', () => {
    const s = demoScenario()
    s.anrufer.kenntAdresse = true
    s.stoerungen = []
    const state = initialCallerState()
    const ortAnswer = answerFor(s, 'ort', state)
    expect(ortAnswer).toContain(s.truth.ort.strasse)
    expect(ortAnswer).toContain(s.truth.ort.stadtteil)
    const alterAnswer = answerFor(s, 'alter', state)
    expect(alterAnswer).toContain(String(s.truth.alter))
  })

  it('wrong house number is corrected within the same answer (Störung)', () => {
    const s = demoScenario()
    s.anrufer.kenntAdresse = true
    s.stoerungen = ['falsche_hausnummer']
    const state = initialCallerState()
    const first = answerFor(s, 'ort', state)
    expect(first).toContain('nein warten Sie')
    const second = answerFor(s, 'ort', state)
    expect(second).not.toContain('nein warten Sie')
  })

  it('panicked callers give vague person counts until calmed', () => {
    const s = demoScenario()
    s.anrufer.emotion = 'panisch'
    s.truth.personen = 4
    const state = initialCallerState()
    expect(answerFor(s, 'personen', state)).toContain('Viele')
    answerFor(s, 'beruhigen', state)
    expect(answerFor(s, 'personen', state)).toContain('4')
  })

  it('Hauptbeschwerde detail questions come from the catalog', () => {
    const hb = hauptbeschwerdeById.get('verkehrsunfall')!
    expect(hb.detailFragen[0]).toContain('eingeklemmt')
  })
})

describe('address fuzzy search (Orts-Index)', () => {
  it('finds streets by partial query', () => {
    const hits = searchAddress('getreidegasse')
    expect(hits[0]!.strasse).toBe('Getreidegasse')
    expect(hits[0]!.place.name).toBe('Altstadt')
  })

  it('finds combination of place + street fragments', () => {
    const hits = searchAddress('lehen ignaz')
    expect(hits[0]!.strasse).toBe('Ignaz-Harrer-Straße')
  })

  it('umlaut-insensitive matching', () => {
    const hits = searchAddress('strasswalchen marktpl')
    expect(hits.some((h) => h.place.name === 'Straßwalchen')).toBe(true)
  })

  it('respects the region filter', () => {
    const hits = searchAddress('stadtplatz', 'SUED')
    expect(hits.every((h) => h.place.region === 'SUED')).toBe(true)
  })
})
