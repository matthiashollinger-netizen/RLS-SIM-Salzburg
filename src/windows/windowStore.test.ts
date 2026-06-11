import { beforeEach, describe, expect, it } from 'vitest'
import { MIN_H, MIN_W, SNAP_GRID, snap, useWindowStore } from './windowStore.ts'

function reset() {
  useWindowStore.setState({ windows: {}, maxZ: 100 })
}

describe('windowStore', () => {
  beforeEach(reset)

  it('snaps values to the grid', () => {
    expect(snap(0)).toBe(0)
    expect(snap(11)).toBe(8)
    expect(snap(13)).toBe(16)
    expect(snap(-5)).toBe(-8)
  })

  it('register creates a window once with increasing z', () => {
    const { register } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    register('funk', { x: 10, y: 10, w: 300, h: 200 })
    register('karte', { x: 99, y: 99, w: 99, h: 99 }) // ignored, already exists
    const s = useWindowStore.getState()
    expect(s.windows.karte?.x).toBe(0)
    expect(s.windows.funk!.z).toBeGreaterThan(s.windows.karte!.z)
  })

  it('focus raises the window to the top', () => {
    const { register, focus } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    register('funk', { x: 10, y: 10, w: 300, h: 200 })
    focus('karte')
    const s = useWindowStore.getState()
    expect(s.windows.karte!.z).toBe(s.maxZ)
    expect(s.windows.karte!.z).toBeGreaterThan(s.windows.funk!.z)
  })

  it('move snaps to grid and keeps the titlebar reachable', () => {
    const { register, move } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    move('karte', 101, 53)
    let win = useWindowStore.getState().windows.karte!
    expect(win.x % SNAP_GRID).toBe(0)
    expect(win.y % SNAP_GRID).toBe(0)
    move('karte', -2000, -50)
    win = useWindowStore.getState().windows.karte!
    expect(win.y).toBe(0)
    expect(win.x).toBeGreaterThanOrEqual(-400 + 80 - SNAP_GRID)
  })

  it('resize enforces minimum sizes', () => {
    const { register, resize } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    resize('karte', { x: 0, y: 0, w: 10, h: 10 })
    const win = useWindowStore.getState().windows.karte!
    expect(win.w).toBeGreaterThanOrEqual(MIN_W)
    expect(win.h).toBeGreaterThanOrEqual(MIN_H)
  })

  it('layout round-trips through serialize/apply', () => {
    const { register, move, serializeLayout } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    register('funk', { x: 16, y: 16, w: 300, h: 200 })
    move('karte', 240, 120)
    const layout = serializeLayout()

    reset()
    const s2 = useWindowStore.getState()
    s2.register('karte', { x: 0, y: 0, w: 1, h: 1 })
    s2.register('funk', { x: 0, y: 0, w: 1, h: 1 })
    s2.applyLayout(layout)
    const after = useWindowStore.getState().windows
    expect(after.karte!.x).toBe(240)
    expect(after.karte!.y).toBe(120)
    expect(after.funk!.w).toBe(300)
  })

  it('minimize toggles and close keeps state for reopening', () => {
    const { register, toggleMinimized, setOpen } = useWindowStore.getState()
    register('karte', { x: 0, y: 0, w: 400, h: 300 })
    toggleMinimized('karte')
    expect(useWindowStore.getState().windows.karte!.minimized).toBe(true)
    setOpen('karte', false)
    expect(useWindowStore.getState().windows.karte!.open).toBe(false)
    setOpen('karte', true)
    const win = useWindowStore.getState().windows.karte!
    expect(win.open).toBe(true)
    expect(win.minimized).toBe(false)
    expect(win.z).toBe(useWindowStore.getState().maxZ)
  })
})
