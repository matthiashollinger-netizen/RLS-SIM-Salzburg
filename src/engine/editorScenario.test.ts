import { describe, expect, it } from 'vitest'
import {
  parseScenario,
  serializeScenario,
  type EditorScenario,
} from './editorScenario.ts'

const scenario: EditorScenario = {
  version: 1,
  name: 'Übung Lehen',
  region: 'NORD',
  einsaetze: [
    {
      atSec: 30,
      hauptbeschwerdeId: 'brand',
      severity: 'hoch',
      personen: 2,
      placeId: 'lehen',
      strasse: 'Strubergasse',
      lageText: 'Es brennt im Keller!',
      emotion: 'panisch',
      rolle: 'angehoeriger',
      phone: 'handy',
    },
  ],
}

describe('editor scenario file format (M10)', () => {
  it('round-trips through serialize/parse', () => {
    const json = serializeScenario(scenario)
    expect(parseScenario(json)).toEqual(scenario)
  })

  it('rejects invalid JSON and missing fields', () => {
    expect(() => parseScenario('not json')).toThrow()
    expect(() => parseScenario('{"name":"x"}')).toThrow()
    expect(() => parseScenario(JSON.stringify({ ...scenario, einsaetze: [] }))).toThrow()
  })

  it('rejects unknown Hauptbeschwerden', () => {
    const bad = {
      ...scenario,
      einsaetze: [{ ...scenario.einsaetze[0]!, hauptbeschwerdeId: 'zombie' }],
    }
    expect(() => parseScenario(JSON.stringify(bad))).toThrow('Unbekannte Hauptbeschwerde')
  })

  it('applies defaults for optional fields', () => {
    const minimal = {
      name: 'Mini',
      einsaetze: [
        { atSec: 0, hauptbeschwerdeId: 'sturz', placeId: 'lehen', strasse: 'Strubergasse' },
      ],
    }
    const parsed = parseScenario(JSON.stringify(minimal))
    expect(parsed.region).toBe('NORD')
    expect(parsed.einsaetze[0]!.severity).toBe('hoch')
    expect(parsed.einsaetze[0]!.phone).toBe('festnetz')
  })
})
