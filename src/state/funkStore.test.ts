import { describe, expect, it } from 'vitest'
import { useDispatchStore } from './dispatchStore.ts'
import { useFunkStore } from './funkStore.ts'
import { LEITSTELLE } from '../engine/funk.ts'

describe('funkStore interactive radio (Rework #4)', () => {
  it('incoming call: ruf → kommen reveals message → Verstanden closes', () => {
    const funk = useFunkStore.getState()
    funk.append({
      simSec: 50,
      kind: 'sprechwunsch',
      vehicleId: '5.20-201',
      stage: 'ruf',
      pendingMessage: 'Übergabe verzögert sich.',
      lines: [{ speaker: '20-201', text: 'Leitstelle von 20-201' }],
    })
    let spruch = useFunkStore.getState().sprueche.at(-1)!
    expect(spruch.stage).toBe('ruf')
    expect(spruch.lines.length).toBe(1)

    useFunkStore.getState().kommen(spruch.id)
    spruch = useFunkStore.getState().sprueche.find((s) => s.id === spruch.id)!
    expect(spruch.stage).toBe('offen')
    expect(spruch.lines.map((l) => l.text)).toContain('kommen')
    expect(spruch.lines.map((l) => l.text)).toContain('Übergabe verzögert sich.')

    useFunkStore.getState().verstanden(spruch.id)
    spruch = useFunkStore.getState().sprueche.find((s) => s.id === spruch.id)!
    expect(spruch.stage).toBe('quittiert')
    expect(spruch.lines.at(-1)).toEqual({ speaker: LEITSTELLE, text: 'Verstanden' })
  })

  it('verstanden is rejected before kommen (Funkdisziplin)', () => {
    const funk = useFunkStore.getState()
    funk.append({
      simSec: 60,
      kind: 'eintreffen',
      vehicleId: '5.20-201',
      stage: 'ruf',
      pendingMessage: 'Status 3.',
      lines: [{ speaker: '20-201', text: 'Leitstelle von 20-201' }],
    })
    const spruch = useFunkStore.getState().sprueche.at(-1)!
    useFunkStore.getState().verstanden(spruch.id)
    expect(useFunkStore.getState().sprueche.find((s) => s.id === spruch.id)!.stage).toBe('ruf')
  })

  it('NA-Nachforderung UPGRADES the existing Auftrag to A4 after kommen (Rework 2)', () => {
    const dispatch = useDispatchStore.getState()
    const baseId = dispatch.createAuftrag({
      categoryId: 'KRANK',
      severity: 'normal',
      ort: { lat: 47.8, lon: 13.04, stadtteil: 'Lehen', strasse: 'Ignaz-Harrer-Straße' },
      truthCategoryId: 'INTERN',
      truthSeverity: 'hoch',
    })
    expect(useDispatchStore.getState().auftraege[baseId]!.code).toBe('B3')

    const funk = useFunkStore.getState()
    funk.append({
      simSec: 100,
      kind: 'nachforderung-na',
      vehicleId: '5.20-201',
      auftragId: baseId,
      stage: 'ruf',
      pendingMessage: 'Patient deutlich schlechter als gemeldet — benötigen Notarzt nach!',
      lines: [{ speaker: '20-201', text: 'Leitstelle von 20-201' }],
      action: { type: 'a4', auftragId: baseId },
    })
    const spruch = useFunkStore.getState().sprueche.at(-1)!

    // action is blocked while still ringing
    useFunkStore.getState().executeAction(spruch.id)
    expect(useDispatchStore.getState().auftraege[baseId]!.code).toBe('B3')

    useFunkStore.getState().kommen(spruch.id)
    useFunkStore.getState().executeAction(spruch.id)

    const upgraded = useDispatchStore.getState().auftraege[baseId]!
    expect(upgraded.code).toBe('A4') // same Auftrag, upgraded — no new one
    expect(upgraded.sosi).toBe(true)
    expect(upgraded.severity).toBe('hoch')
    expect(upgraded.infos?.some((i) => i.text.includes('aufgewertet'))).toBe(true)
    expect(useFunkStore.getState().sprueche.find((s) => s.id === spruch.id)!.stage).toBe('quittiert')
  })

  it('Polizei action alarms POL on the existing Auftrag', () => {
    const dispatch = useDispatchStore.getState()
    const id = dispatch.createAuftrag({
      categoryId: 'GEWALT',
      severity: 'hoch',
      ort: { lat: 47.8, lon: 13.04, stadtteil: 'Altstadt', strasse: 'Getreidegasse' },
    })
    const funk = useFunkStore.getState()
    funk.append({
      simSec: 200,
      kind: 'nachforderung-polizei',
      vehicleId: '5.20-201',
      auftragId: id,
      stage: 'ruf',
      pendingMessage: 'Benötigen Polizei.',
      lines: [{ speaker: '20-201', text: 'Leitstelle von 20-201' }],
      action: { type: 'polizei', auftragId: id },
    })
    const spruch = useFunkStore.getState().sprueche.at(-1)!
    useFunkStore.getState().kommen(spruch.id)
    useFunkStore.getState().executeAction(spruch.id)
    expect(useDispatchStore.getState().auftraege[id]!.partnersAlarmed).toContain('POL')
  })
})
