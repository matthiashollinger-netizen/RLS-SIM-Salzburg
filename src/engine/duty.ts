import type { DutyWindow } from '../data/schemas.ts'
import { secondsOfDay, weekdayAt, type Season, type SimContext } from './time.ts'

/** Structural subset of Vehicle/SimUnit needed for duty checks. */
export interface DutySchedulable {
  dienstzeiten: DutyWindow[]
  reserve?: boolean
}

/** Parse "HH:MM" (or "24:00") into seconds of day. */
export function parseClock(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 3600 + (m ?? 0) * 60
}

function prevWeekday(d: number): number {
  return d === 1 ? 7 : d - 1
}

/**
 * A window is active when (day matches AND tod within [from,to)) — or, for
 * overnight windows (to < from), when it started yesterday and runs into today.
 * GAME_DATA §6/§7 duty patterns like "19–7" or Hof "nachts + Wochenende".
 */
export function windowActive(
  win: DutyWindow,
  weekday: number,
  tod: number,
  season: Season,
): boolean {
  if (win.season && win.season !== season) return false
  const from = parseClock(win.from)
  const to = parseClock(win.to)
  if (to > from) {
    return win.days.includes(weekday) && tod >= from && tod < to
  }
  if (to === from) return false
  // overnight: e.g. 19:00–07:00
  const startedToday = win.days.includes(weekday) && tod >= from
  const startedYesterday = win.days.includes(prevWeekday(weekday)) && tod < to
  return startedToday || startedYesterday
}

export interface DutyContext extends SimContext {
  season: Season
}

/** True when the vehicle is in service at simSec. Reserve vehicles are never
 *  on duty by schedule (activated manually on status 94 of another unit). */
export function isOnDuty(vehicle: DutySchedulable, simSec: number, ctx: DutyContext): boolean {
  if (vehicle.reserve) return false
  const weekday = weekdayAt(simSec, ctx)
  const tod = secondsOfDay(simSec)
  return vehicle.dienstzeiten.some((w) => windowActive(w, weekday, tod, ctx.season))
}
