import { describe, expect, it } from 'vitest'
import { useDispatchStore } from './dispatchStore.ts'
import { useFunkStore } from './funkStore.ts'
import { vehicleCallsLeitstelle } from '../engine/funk.ts'

describe('funkStore dispatcher actions (integration)', () => {
  it('NA-Nachforderung action creates an A4 Auftrag at the same location', () => {
    const dispatch = useDispatchStore.getState()
    const baseId = dispatch.createAuftrag({
      categoryId: 'STILL',
      severity: 'hoch',
      ort: { lat: 47.8, lon: 13.04, stadtteil: 'Lehen', strasse: 'Ignaz-Harrer-Straße' },
    })

    const funk = useFunkStore.getState()
    funk.append({
      simSec: 100,
      kind: 'nachforderung-na',
      vehicleId: '5.20-201',
      auftragId: baseId,
      lines: vehicleCallsLeitstelle('20-201', 'Laufende CPR, benötigen dringend Notarzt!'),
      requiresAck: true,
      action: { type: 'a4', auftragId: baseId },
    })
    const spruch = useFunkStore.getState().sprueche.at(-1)!
    useFunkStore.getState().executeAction(spruch.id)

    const all = Object.values(useDispatchStore.getState().auftraege)
    const a4 = all.find((a) => a.code === 'A4')
    expect(a4).toBeDefined()
    expect(a4!.ort.strasse).toBe('Ignaz-Harrer-Straße')
    expect(a4!.sosi).toBe(true) // A4 is a SoSi code
    expect(a4!.merkmalskette[0]).toContain(`NA-Nachforderung zu ${baseId}`)
    expect(useFunkStore.getState().sprueche.at(-1)!.acked).toBe(true)
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
      lines: vehicleCallsLeitstelle('20-201', 'Benötigen Polizei.'),
      requiresAck: true,
      action: { type: 'polizei', auftragId: id },
    })
    const spruch = useFunkStore.getState().sprueche.at(-1)!
    useFunkStore.getState().executeAction(spruch.id)
    expect(useDispatchStore.getState().auftraege[id]!.partnersAlarmed).toContain('POL')
  })
})
