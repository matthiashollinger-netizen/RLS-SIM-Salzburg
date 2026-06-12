import type { Hospital } from '../data/schemas.ts'

/**
 * Kapazitätsnachweis (Award-Polish): each hospital has a limited number of
 * simultaneous emergency admissions. A delivered patient occupies a slot for
 * OCCUPY_SEC; a full Notaufnahme delays the handover. Capacities per
 * Versorgungsstufe are SCHÄTZUNGEN (ANNAHMEN.md) — real numbers vary by shift.
 */

export function emergencyCapacity(h: Hospital): number {
  switch (h.stufe) {
    case 'ZENTRAL':
      return 8
    case 'SCHWERPUNKT':
      return 5
    case 'SONDER':
      return 3
    case 'PRIVAT':
      return 2
    default:
      return 3 // STANDARD
  }
}

/** one admitted patient blocks a slot for 45 min (estimated) */
export const OCCUPY_SEC = 2700

/** slots still free at simSec given the occupied-until timestamps */
export function freeSlots(capacity: number, occupiedUntil: number[], simSec: number): number {
  const active = occupiedUntil.filter((until) => until > simSec).length
  return Math.max(0, capacity - active)
}
