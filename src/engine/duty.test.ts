import { describe, expect, it } from 'vitest'
import { isOnDuty, parseClock, windowActive } from './duty.ts'
import { vehicleByFunkrufname } from '../data/index.ts'
import type { DutyContext } from './duty.ts'

const ctx: DutyContext = { startWeekday: 1, month: 6, season: 'summer' }

/** simSec for day-index (0 = Monday with startWeekday 1) and clock time */
function at(day: number, clock: string): number {
  return day * 86400 + parseClock(clock)
}

describe('windowActive', () => {
  it('handles normal day windows', () => {
    const w = { days: [1, 2, 3, 4, 5], from: '07:00', to: '17:00' }
    expect(windowActive(w, 1, parseClock('08:00'), 'none')).toBe(true)
    expect(windowActive(w, 1, parseClock('17:00'), 'none')).toBe(false)
    expect(windowActive(w, 6, parseClock('08:00'), 'none')).toBe(false)
  })

  it('handles overnight windows across the day boundary', () => {
    const w = { days: [1, 2, 3, 4, 5], from: '19:00', to: '07:00' }
    expect(windowActive(w, 1, parseClock('20:00'), 'none')).toBe(true)
    // Tue 03:00 belongs to Monday's window
    expect(windowActive(w, 2, parseClock('03:00'), 'none')).toBe(true)
    // Sat 03:00 belongs to Friday's window
    expect(windowActive(w, 6, parseClock('03:00'), 'none')).toBe(true)
    // Mon 03:00 would belong to Sunday — Sunday not in days
    expect(windowActive(w, 1, parseClock('03:00'), 'none')).toBe(false)
    expect(windowActive(w, 1, parseClock('12:00'), 'none')).toBe(false)
  })

  it('respects 24h windows and season filters', () => {
    const all = { days: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '24:00' }
    expect(windowActive(all, 7, parseClock('03:30'), 'none')).toBe(true)
    const winter = { days: [6, 7], from: '00:00', to: '24:00', season: 'winter' as const }
    expect(windowActive(winter, 6, parseClock('12:00'), 'winter')).toBe(true)
    expect(windowActive(winter, 6, parseClock('12:00'), 'summer')).toBe(false)
  })
})

describe('isOnDuty with real fleet data', () => {
  it('Hof rule: KTW 5.45-301 off weekday daytime, on at night + weekend (GAME_DATA §7)', () => {
    const hof = vehicleByFunkrufname.get('5.45-301')!
    expect(isOnDuty(hof, at(1, '12:00'), ctx)).toBe(false) // Tue noon
    expect(isOnDuty(hof, at(1, '22:00'), ctx)).toBe(true) // Tue night
    expect(isOnDuty(hof, at(2, '03:00'), ctx)).toBe(true) // Wed early (Tue window)
    expect(isOnDuty(hof, at(5, '12:00'), ctx)).toBe(true) // Saturday noon
    expect(isOnDuty(hof, at(6, '12:00'), ctx)).toBe(true) // Sunday noon
  })

  it('24h NEF is always on duty', () => {
    const nef = vehicleByFunkrufname.get('5.10-107')!
    expect(isOnDuty(nef, at(0, '03:00'), ctx)).toBe(true)
    expect(isOnDuty(nef, at(6, '23:59'), ctx)).toBe(true)
  })

  it('reserve vehicles are never scheduled', () => {
    const res = vehicleByFunkrufname.get('5.80-202')!
    expect(isOnDuty(res, at(0, '12:00'), ctx)).toBe(false)
  })

  it('winter-only windows activate only in winter (5.68-202)', () => {
    const winterRtw = vehicleByFunkrufname.get('5.68-202')!
    const winterCtx: DutyContext = { startWeekday: 1, month: 1, season: 'winter' }
    expect(isOnDuty(winterRtw, at(0, '12:00'), winterCtx)).toBe(true)
    expect(isOnDuty(winterRtw, at(0, '12:00'), ctx)).toBe(false)
  })

  it('split shifts (5.71-301: 8–17:30 and 19–7) leave a gap', () => {
    const ktw = vehicleByFunkrufname.get('5.71-301')!
    expect(isOnDuty(ktw, at(0, '10:00'), ctx)).toBe(true)
    expect(isOnDuty(ktw, at(0, '18:00'), ctx)).toBe(false) // gap
    expect(isOnDuty(ktw, at(0, '20:00'), ctx)).toBe(true)
    expect(isOnDuty(ktw, at(1, '05:00'), ctx)).toBe(true) // overnight part
  })
})
