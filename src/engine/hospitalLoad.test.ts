import { describe, expect, it } from 'vitest'
import { emergencyCapacity, freeSlots, OCCUPY_SEC } from './hospitalLoad.ts'
import { hospitals } from '../data/index.ts'

describe('hospitalLoad (Kapazitätsnachweis)', () => {
  it('grades capacity by Versorgungsstufe', () => {
    const byStufe = new Map(hospitals.map((h) => [h.stufe, emergencyCapacity(h)]))
    expect(byStufe.get('ZENTRAL')).toBe(8)
    expect(byStufe.get('STANDARD')).toBe(3)
    // every hospital has at least one slot
    for (const h of hospitals) expect(emergencyCapacity(h)).toBeGreaterThan(0)
  })

  it('counts only still-active admissions', () => {
    const now = 10_000
    const occupied = [now + 100, now + OCCUPY_SEC, now - 1, now - 500]
    expect(freeSlots(3, occupied, now)).toBe(1) // two active, one free
    expect(freeSlots(3, occupied, now + OCCUPY_SEC + 1)).toBe(3) // all expired
    expect(freeSlots(1, [now + 100, now + 200], now)).toBe(0) // never negative
  })
})
