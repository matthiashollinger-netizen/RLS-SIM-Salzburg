import { describe, expect, it } from 'vitest'
import {
  balancing,
  categories,
  codeByCode,
  codes,
  crossValidate,
  helicopters,
  hospitals,
  stations,
  statusDefs,
  vehicles,
} from './index.ts'

describe('data files parse with required fields', () => {
  it('codes: full official set A1–E6 + MANV1–4 (GAME_DATA §4)', () => {
    expect(codes.length).toBe(30)
    for (const cls of ['A', 'B', 'C', 'D', 'E'] as const) {
      const n = codes.filter((c) => c.class === cls).length
      expect(n, `class ${cls}`).toBe(cls === 'A' || cls === 'B' ? 4 : 6)
    }
    expect(codes.filter((c) => c.class === 'MANV').length).toBe(4)
  })

  it('codes: SoSi flags match the official PDF', () => {
    // GAME_DATA §4: A all SoSi, B1/B2 SoSi, B3/B4 not, C1–C4 SoSi, C5/C6 not,
    // D/E never, MANV always
    expect(codeByCode.get('A1')?.sosi).toBe(true)
    expect(codeByCode.get('B2')?.sosi).toBe(true)
    expect(codeByCode.get('B3')?.sosi).toBe(false)
    expect(codeByCode.get('C4')?.sosi).toBe(true)
    expect(codeByCode.get('C5')?.sosi).toBe(false)
    expect(codeByCode.get('D1')?.sosi).toBe(false)
    expect(codeByCode.get('E1')?.sosi).toBe(false)
    expect(codeByCode.get('MANV4')?.sosi).toBe(true)
  })

  it('MANV thresholds are the official ones', () => {
    expect(codeByCode.get('MANV1')?.personsMin).toBe(6)
    expect(codeByCode.get('MANV1')?.personsMax).toBe(10)
    expect(codeByCode.get('MANV2')?.personsMin).toBe(11)
    expect(codeByCode.get('MANV3')?.personsMin).toBe(30)
    expect(codeByCode.get('MANV4')?.personsMin).toBe(50)
  })

  it('categories: all 29 official emergency categories present', () => {
    const emergency = categories.filter((c) => c.group === 'emergency')
    expect(emergency.length).toBe(29)
    const ids = new Set(emergency.map((c) => c.id))
    for (const required of ['STILL', 'ALPIN', 'WASSER', 'VERKEHR', 'GEWALT', 'HOEHLE_GRUBE']) {
      expect(ids.has(required), required).toBe(true)
    }
  })

  it('status: full Salzburg scheme 00–7, 88, 08/09/10 + Sonderstatus (GAME_DATA §10)', () => {
    const codes = statusDefs.map((s) => s.code)
    for (const c of ['00', '1', '2', '3', '4', '5', '6', '7', '88', '08', '09', '10']) {
      expect(codes, c).toContain(c)
    }
    // placeholder special statuses are flagged estimated
    for (const c of ['91', '92', '93', '94', '95']) {
      const def = statusDefs.find((s) => s.code === c)
      expect(def?.estimated, c).toBe(true)
    }
  })

  it('stations: Nord has 10 Dienststellen + Stützpunkt, Süd has 16 (GAME_DATA §2)', () => {
    const nord = stations.filter((s) => s.region === 'NORD' && s.type !== 'LST')
    const sued = stations.filter((s) => s.region === 'SUED' && s.type !== 'LST')
    expect(nord.filter((s) => s.type !== 'STUETZPUNKT').length).toBe(10)
    expect(sued.length).toBe(16)
  })

  it('vehicles: funkrufnamen are unique and match 5.BD-TNN format', () => {
    const names = vehicles.map((v) => v.funkrufname)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n).toMatch(/^5\.\d{2}-\d{3}$/)
  })

  it('vehicles: type matches Typenkreis digit (GAME_DATA §5)', () => {
    // 1XX NEF/NAW, 2XX RTW/ITW, 3XX KTW, 4XX GKTW, 5XX BTW, 6XX MTW, 7XX EL
    const expected: Record<string, string[]> = {
      '1': ['NEF', 'NAW'],
      '2': ['RTW', 'ITW'],
      '3': ['KTW'],
      '4': ['GKTW'],
      '5': ['BTW'],
      '6': ['MTW'],
      '7': ['EL'],
    }
    // 5.10-108 is listed as EL in the Stadt fleet table (GAME_DATA §7) despite
    // the 1XX NEF Typenkreis — kept faithful to the source.
    const exceptions = new Set(['5.10-108'])
    for (const v of vehicles) {
      if (exceptions.has(v.funkrufname)) continue
      const digit = v.funkrufname.split('-')[1]![0]!
      expect(expected[digit], `${v.funkrufname} (${v.typ})`).toContain(v.typ)
    }
  })

  it('vehicles: anomaly fixes from GAME_DATA §5 are applied', () => {
    const names = new Set(vehicles.map((v) => v.funkrufname))
    expect(names.has('5.71-210')).toBe(true) // ITW renumbered
    const itw = vehicles.find((v) => v.funkrufname === '5.71-210')
    expect(itw?.typ).toBe('ITW')
    // 5.10-315 assigned exactly once (Saalbach)
    expect(vehicles.filter((v) => v.funkrufname === '5.10-315').length).toBe(1)
    expect(vehicles.find((v) => v.funkrufname === '5.10-315')?.homeStation).toBe('saalbach')
  })

  it('vehicles: Hof rule — KTW only nights + weekend (GAME_DATA §7)', () => {
    const hof = vehicles.find((v) => v.funkrufname === '5.45-301')
    expect(hof).toBeDefined()
    const weekdayDay = hof!.dienstzeiten.some(
      (w) => w.days.includes(2) && w.from <= '12:00' && w.to > '12:00' && w.to !== '24:00',
    )
    expect(weekdayDay).toBe(false)
  })

  it('vehicles: NEF 101 special rule wired (GAME_DATA §12b)', () => {
    const nef101 = vehicles.find((v) => v.funkrufname === '5.10-101')
    expect(nef101?.specialRule).toBe('nef101')
    const nef106 = vehicles.find((v) => v.funkrufname === '5.10-106')
    expect(nef106?.vorhalteposition).toBe('08')
  })

  it('hospitals: position codes 08/09/10 map to LKH/UKH/CDK (GAME_DATA §10)', () => {
    expect(hospitals.find((h) => h.id === 'lkh')?.positionsCode).toBe('08')
    expect(hospitals.find((h) => h.id === 'ukh')?.positionsCode).toBe('09')
    expect(hospitals.find((h) => h.id === 'cdk')?.positionsCode).toBe('10')
  })

  it('hospitals: Zielklinik-Logik — Stroke nur CDK/Schwarzach (GAME_DATA §9)', () => {
    const strokeHouses = hospitals.filter((h) => h.capabilities.stroke).map((h) => h.id)
    expect(strokeHouses.sort()).toEqual(['cdk', 'ksk'])
  })

  it('helicopters: all five, all daylight-only (GAME_DATA §8)', () => {
    expect(helicopters.length).toBe(5)
    for (const h of helicopters) expect(h.daylightOnly).toBe(true)
    const winter = helicopters.filter((h) => h.saisonMonate.length < 12)
    expect(winter.map((h) => h.id).sort()).toEqual(['martin1', 'martin10', 'martin6'])
  })

  it('balancing: call volumes match GAME_DATA Jahreszahlen-Block', () => {
    expect(balancing.calls.NORD.perDay).toBe(800)
    expect(balancing.calls.NORD.emergenciesPerDay).toBe(160)
    expect(balancing.calls.SUED.perDay).toBe(430)
    expect(balancing.calls.SUED.emergenciesPerDay).toBe(85)
    expect(balancing.hourlyFactors.length).toBe(24)
    expect(balancing.routing.detourFactor).toBe(1.35)
    expect(balancing.hilfsfristMin).toBe(15)
  })

  it('cross-validation finds no problems', () => {
    expect(crossValidate()).toEqual([])
  })

  it('fleet size is in the realistic range (GAME_DATA §2: Nord 95, Süd 80)', () => {
    expect(vehicles.length).toBeGreaterThanOrEqual(120)
  })
})
