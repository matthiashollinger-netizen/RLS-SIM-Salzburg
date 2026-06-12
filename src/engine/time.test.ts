import { describe, expect, it } from 'vitest'
import {
  daylightFactor,
  isDaylight,
  isNight,
  secondsOfDay,
  weekdayAt,
  type SimContext,
} from './time.ts'

const JUNE: SimContext = { startWeekday: 1, month: 6 } // sunrise 5.0, sunset 21.1
const JAN: SimContext = { startWeekday: 1, month: 1 } // sunrise 7.9, sunset 16.8

/** simSec at a decimal hour of day 0 */
const h = (hours: number) => hours * 3600

describe('daylightFactor', () => {
  it('is 0 deep in the night and 1 at noon', () => {
    expect(daylightFactor(h(0), JUNE)).toBe(0)
    expect(daylightFactor(h(12), JUNE)).toBe(1)
    expect(daylightFactor(h(2), JAN)).toBe(0)
    expect(daylightFactor(h(12), JAN)).toBe(1)
  })

  it('ramps over ±45 min around sunrise', () => {
    expect(daylightFactor(h(7.9 - 0.75), JAN)).toBeCloseTo(0, 5)
    expect(daylightFactor(h(7.9), JAN)).toBeCloseTo(0.5, 5)
    expect(daylightFactor(h(7.9 + 0.375), JAN)).toBeCloseTo(0.75, 5)
    expect(daylightFactor(h(7.9 + 0.75), JAN)).toBeCloseTo(1, 5)
  })

  it('ramps over ±45 min around sunset', () => {
    expect(daylightFactor(h(16.8 - 0.75), JAN)).toBeCloseTo(1, 5)
    expect(daylightFactor(h(16.8), JAN)).toBeCloseTo(0.5, 5)
    expect(daylightFactor(h(16.8 + 0.75), JAN)).toBeCloseTo(0, 5)
  })

  it('is monotonic across dawn and clamped to [0, 1]', () => {
    let prev = -1
    for (let t = h(4); t <= h(6.5); t += 300) {
      const f = daylightFactor(t, JUNE)
      expect(f).toBeGreaterThanOrEqual(Math.max(0, prev))
      expect(f).toBeLessThanOrEqual(1)
      prev = f
    }
  })

  it('uses the time of day on later shift days (multi-day simSec)', () => {
    expect(daylightFactor(86400 + h(12), JUNE)).toBe(1)
    expect(daylightFactor(2 * 86400, JUNE)).toBe(0)
  })

  it('falls back to a 06–20 day for unknown months', () => {
    const weird: SimContext = { startWeekday: 1, month: 0 }
    expect(daylightFactor(h(6), weird)).toBeCloseTo(0.5, 5)
    expect(daylightFactor(h(13), weird)).toBe(1)
  })

  it('agrees with isDaylight at full day / full night', () => {
    for (let t = 0; t < 86400; t += 1800) {
      const f = daylightFactor(t, JUNE)
      if (f === 1) expect(isDaylight(t, JUNE)).toBe(true)
      if (f === 0) expect(isDaylight(t, JUNE)).toBe(false)
    }
  })
})

describe('clock helpers', () => {
  it('secondsOfDay wraps multi-day and negative values', () => {
    expect(secondsOfDay(86400 + 90)).toBe(90)
    expect(secondsOfDay(-3600)).toBe(82800)
  })

  it('weekdayAt advances with the day index', () => {
    expect(weekdayAt(h(10), JUNE)).toBe(1)
    expect(weekdayAt(86400 + h(10), JUNE)).toBe(2)
    expect(weekdayAt(6 * 86400 + h(10), JUNE)).toBe(7)
  })

  it('isNight covers 20:00–06:00', () => {
    expect(isNight(h(23))).toBe(true)
    expect(isNight(h(5.9))).toBe(true)
    expect(isNight(h(12))).toBe(false)
  })
})
