import { describe, expect, it } from 'vitest'
import { allocateTransports, isTransportCapable } from './transport.ts'

describe('transport allocation — one transporter per patient (Rework #6)', () => {
  it('heli takes the patient when RTW and heli are both assigned', () => {
    const result = allocateTransports(
      [
        { id: 'rtw', typ: 'RTW' },
        { id: 'c6', typ: 'HELI' },
        { id: 'nef', typ: 'NEF' },
      ],
      1,
    )
    expect([...result]).toEqual(['c6'])
  })

  it('NEF never transports', () => {
    expect(isTransportCapable('NEF')).toBe(false)
    expect(isTransportCapable('EL')).toBe(false)
    expect(isTransportCapable('RTW')).toBe(true)
  })

  it('allocates one transporter per patient, by priority', () => {
    const result = allocateTransports(
      [
        { id: 'ktw', typ: 'KTW' },
        { id: 'rtw1', typ: 'RTW' },
        { id: 'rtw2', typ: 'RTW' },
      ],
      2,
    )
    expect(result.size).toBe(2)
    expect(result.has('rtw1')).toBe(true)
    expect(result.has('rtw2')).toBe(true)
    expect(result.has('ktw')).toBe(false)
  })

  it('Notfall-KTW outranks plain KTW', () => {
    const result = allocateTransports(
      [
        { id: 'ktw', typ: 'KTW' },
        { id: 'nktw', typ: 'KTW', notfallKtw: true },
      ],
      1,
    )
    expect([...result]).toEqual(['nktw'])
  })

  it('at least one transporter even with personen = 0 input', () => {
    const result = allocateTransports([{ id: 'rtw', typ: 'RTW' }], 0)
    expect(result.size).toBe(1)
  })

  it('extra patients without extra units: all capable units transport', () => {
    const result = allocateTransports(
      [
        { id: 'rtw', typ: 'RTW' },
        { id: 'nef', typ: 'NEF' },
      ],
      5,
    )
    expect([...result]).toEqual(['rtw'])
  })
})
