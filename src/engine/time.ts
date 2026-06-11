import { balancing } from '../data/index.ts'

/**
 * Simulated time. simSec counts seconds since midnight of "day 0" of the shift.
 * Weekday/month come from the shift configuration.
 */

export interface SimContext {
  /** ISO weekday of day 0 (1 = Monday … 7 = Sunday) */
  startWeekday: number
  /** Month of the shift (1–12), drives season + daylight */
  month: number
}

export function secondsOfDay(simSec: number): number {
  return ((simSec % 86400) + 86400) % 86400
}

export function weekdayAt(simSec: number, ctx: SimContext): number {
  const days = Math.floor(simSec / 86400)
  return ((ctx.startWeekday - 1 + days) % 7) + 1
}

export type Season = 'winter' | 'summer' | 'none'

export function seasonOf(month: number): Season {
  if (balancing.seasons.winterMonths.includes(month)) return 'winter'
  if (balancing.seasons.summerMonths.includes(month)) return 'summer'
  return 'none'
}

/**
 * Approximate sunrise/sunset for Salzburg (47.8°N) per month, local time.
 * GAME_DATA §8: helicopters fly sunrise–sunset only.
 */
const DAYLIGHT_TABLE: Record<number, [number, number]> = {
  1: [7.9, 16.8],
  2: [7.2, 17.6],
  3: [6.2, 18.4],
  4: [6.1, 19.9],
  5: [5.3, 20.7],
  6: [5.0, 21.1],
  7: [5.3, 21.0],
  8: [6.0, 20.2],
  9: [6.8, 19.1],
  10: [7.5, 18.0],
  11: [7.4, 16.4],
  12: [7.9, 16.1],
}

export function isDaylight(simSec: number, ctx: SimContext): boolean {
  const [sunrise, sunset] = DAYLIGHT_TABLE[ctx.month] ?? [6, 20]
  const hour = secondsOfDay(simSec) / 3600
  return hour >= sunrise && hour <= sunset
}

/** Night window for turnout times (volunteers/pager, NEF-101 KH-Personal). */
export function isNight(simSec: number): boolean {
  const hour = secondsOfDay(simSec) / 3600
  return hour >= 20 || hour < 6
}
