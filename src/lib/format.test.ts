import { describe, expect, it } from 'vitest'
import { formatCountdown, formatGameTime, shortCallSign } from './format.ts'

describe('formatGameTime', () => {
  it('formats midnight', () => {
    expect(formatGameTime(0)).toBe('00:00:00')
  })
  it('formats afternoon time', () => {
    expect(formatGameTime(13 * 3600 + 5 * 60 + 9)).toBe('13:05:09')
  })
  it('wraps past midnight', () => {
    expect(formatGameTime(86400 + 61)).toBe('00:01:01')
  })
})

describe('formatCountdown', () => {
  it('formats remaining time', () => {
    expect(formatCountdown(15 * 60)).toBe('15:00')
  })
  it('formats overdue time as negative', () => {
    expect(formatCountdown(-75)).toBe('-1:15')
  })
})

describe('shortCallSign', () => {
  // GAME_DATA §10c: spoken short form without "5." prefix
  it('strips the Salzburg prefix', () => {
    expect(shortCallSign('5.20-322')).toBe('20-322')
  })
  it('keeps already-short names', () => {
    expect(shortCallSign('20-322')).toBe('20-322')
  })
})
