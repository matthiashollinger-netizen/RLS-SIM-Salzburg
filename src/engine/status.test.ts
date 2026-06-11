import { describe, expect, it } from 'vitest'
import { canTransition, isAvailable, LIFECYCLE_ORDER, type StatusCode } from './status.ts'

describe('status transitions (GAME_DATA §10)', () => {
  it('allows the exact happy-path lifecycle 00→1→2→3→4→5→6→7→00', () => {
    for (let i = 0; i < LIFECYCLE_ORDER.length - 1; i++) {
      const from = LIFECYCLE_ORDER[i]!
      const to = LIFECYCLE_ORDER[i + 1]!
      expect(canTransition(from, to), `${from}→${to}`).toBe(true)
    }
  })

  it('allows position flow 00→88→08/09/10→1', () => {
    expect(canTransition('00', '88')).toBe(true)
    expect(canTransition('88', '08')).toBe(true)
    expect(canTransition('88', '09')).toBe(true)
    expect(canTransition('88', '10')).toBe(true)
    expect(canTransition('08', '1')).toBe(true)
  })

  it('allows no-transport shortcut 3→6 and follow-up dispatch 6/7→1', () => {
    expect(canTransition('3', '6')).toBe(true)
    expect(canTransition('6', '1')).toBe(true)
    expect(canTransition('7', '1')).toBe(true)
  })

  it('forbids skipping steps', () => {
    const forbidden: [StatusCode, StatusCode][] = [
      ['00', '3'],
      ['1', '3'],
      ['2', '4'],
      ['4', '6'],
      ['5', '7'],
      ['2', '00'],
      ['4', '00'],
    ]
    for (const [from, to] of forbidden) {
      expect(canTransition(from, to), `${from}→${to}`).toBe(false)
    }
  })

  it('Sonderstatus only from/to ready states', () => {
    expect(canTransition('00', '92')).toBe(true)
    expect(canTransition('92', '00')).toBe(true)
    expect(canTransition('2', '92')).toBe(false)
  })

  it('availability matches status.json semantics', () => {
    for (const s of ['00', '6', '7', '88', '08', '09', '10'] as StatusCode[]) {
      expect(isAvailable(s), s).toBe(true)
    }
    for (const s of ['1', '2', '3', '4', '5', '91', '94'] as StatusCode[]) {
      expect(isAvailable(s), s).toBe(false)
    }
    expect(isAvailable('AUS')).toBe(false)
  })
})
