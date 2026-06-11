import { describe, expect, it } from 'vitest'
import { buildReport } from './scoring.ts'
import type { Auftrag } from './auftrag.ts'

function auftrag(partial: Partial<Auftrag>, id: string): Auftrag {
  return {
    id,
    createdAt: 0,
    code: 'A1',
    categoryId: 'INTERN',
    severity: 'hoch',
    personen: 1,
    ort: { lat: 47.8, lon: 13, stadtteil: 'Lehen', strasse: 'X' },
    merkmalskette: [],
    sosi: true,
    hilfsfristDeadline: 900,
    partnersAlarmed: [],
    lagefreigabe: false,
    assigned: {},
    state: 'abgeschlossen',
    uebung: false,
    ...partial,
  }
}

const calls = { angenommen: 10, auftraege: 5, zugeordnet: 1 }
const opts = { region: 'NORD', durationHours: 8, startedAtIso: '2026-06-12T07:00:00Z' }

describe('shift report (GAME_DATA §11 score dimensions)', () => {
  it('computes the Hilfsfrist quota', () => {
    const report = buildReport(
      [
        auftrag({ firstArrivalSec: 600 }, 'E-1'), // met
        auftrag({ firstArrivalSec: 1200 }, 'E-2'), // missed
        auftrag({ hilfsfristDeadline: undefined, code: 'D1', sosi: false }, 'E-3'), // n/a
      ],
      calls,
      opts,
    )
    expect(report.hilfsfristQuote).toBeCloseTo(0.5)
  })

  it('computes Stichwort accuracy only for calls with known truth', () => {
    const report = buildReport(
      [
        auftrag({ truthCategoryId: 'INTERN', categoryId: 'INTERN' }, 'E-1'),
        auftrag({ truthCategoryId: 'NEURO', categoryId: 'INTERN' }, 'E-2'),
        auftrag({}, 'E-3'), // no truth → excluded
      ],
      calls,
      opts,
    )
    expect(report.stichwortQuote).toBeCloseTo(0.5)
  })

  it('counts Fehldispositionen and outcomes', () => {
    const report = buildReport(
      [
        auftrag(
          {
            hospitalSuitable: false,
            outcome: { survived: true, text: '', issues: [], quality: 0.8 },
          },
          'E-1',
        ),
        auftrag(
          { outcome: { survived: false, text: '', issues: [], quality: 0.2 } },
          'E-2',
        ),
      ],
      calls,
      opts,
    )
    expect(report.fehldispoCount).toBe(1)
    expect(report.ueberlebt).toBe(1)
    expect(report.verstorben).toBe(1)
  })

  it('ÜBUNG incidents are excluded from scoring', () => {
    const report = buildReport([auftrag({ uebung: true }, 'E-1')], calls, opts)
    expect(report.auftraege.length).toBe(0)
  })

  it('perfect shift gets Note 1, disastrous shift Note 5', () => {
    const perfect = buildReport(
      Array.from({ length: 5 }, (_, i) =>
        auftrag(
          {
            firstArrivalSec: 500,
            truthCategoryId: 'INTERN',
            outcome: { survived: true, text: '', issues: [], quality: 0.95 },
          },
          `P-${i}`,
        ),
      ),
      calls,
      opts,
    )
    expect(perfect.note).toBe(1)

    const disaster = buildReport(
      Array.from({ length: 5 }, (_, i) =>
        auftrag(
          {
            firstArrivalSec: 2400,
            truthCategoryId: 'NEURO', // chosen INTERN → wrong
            hospitalSuitable: false,
            outcome: { survived: false, text: '', issues: [], quality: 0.1 },
          },
          `D-${i}`,
        ),
      ),
      calls,
      opts,
    )
    expect(disaster.note).toBe(5)
  })
})
