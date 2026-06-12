import { create } from 'zustand'

/**
 * Window manager state (GAME_DATA §12: freely movable/resizable/hideable windows
 * with persistable layouts). UI-free logic — components live in WindowFrame/Manager.
 */

export type WindowId =
  | 'karte'
  | 'einsatzliste'
  | 'ressourcen'
  | 'funk'
  | 'protokoll'
  | 'anrufe'
  | 'gespraech'
  | 'abfrage'
  | 'khliste'
  | 'sonderlagen'

export interface WindowRect {
  x: number
  y: number
  w: number
  h: number
}

export interface WindowState extends WindowRect {
  id: WindowId
  open: boolean
  minimized: boolean
  z: number
}

export type Layout = Record<string, Omit<WindowState, 'id'>>

/** Snap grid in px — mirrors --window-snap-grid in design/tokens.css */
export const SNAP_GRID = 8
/** Minimum window size — mirrors --window-min-w/h tokens */
export const MIN_W = 220
export const MIN_H = 140

export function snap(v: number): number {
  return Math.round(v / SNAP_GRID) * SNAP_GRID
}

interface WindowsStore {
  windows: Partial<Record<WindowId, WindowState>>
  maxZ: number
  register: (id: WindowId, defaults: WindowRect, open?: boolean) => void
  focus: (id: WindowId) => void
  move: (id: WindowId, x: number, y: number) => void
  resize: (id: WindowId, rect: WindowRect) => void
  setOpen: (id: WindowId, open: boolean) => void
  toggleMinimized: (id: WindowId) => void
  serializeLayout: () => Layout
  applyLayout: (layout: Layout) => void
}

export const useWindowStore = create<WindowsStore>((set, get) => ({
  windows: {},
  maxZ: 100,

  register: (id, defaults, open = true) =>
    set((s) => {
      if (s.windows[id]) return s
      const z = s.maxZ + 1
      return {
        windows: {
          ...s.windows,
          [id]: { id, ...defaults, open, minimized: false, z },
        },
        maxZ: z,
      }
    }),

  focus: (id) =>
    set((s) => {
      const win = s.windows[id]
      if (!win || win.z === s.maxZ) return s
      const z = s.maxZ + 1
      return { windows: { ...s.windows, [id]: { ...win, z } }, maxZ: z }
    }),

  move: (id, x, y) =>
    set((s) => {
      const win = s.windows[id]
      if (!win) return s
      return {
        windows: {
          ...s.windows,
          [id]: { ...win, x: snap(Math.max(-win.w + 80, x)), y: snap(Math.max(0, y)) },
        },
      }
    }),

  resize: (id, rect) =>
    set((s) => {
      const win = s.windows[id]
      if (!win) return s
      return {
        windows: {
          ...s.windows,
          [id]: {
            ...win,
            x: snap(rect.x),
            y: snap(Math.max(0, rect.y)),
            w: snap(Math.max(MIN_W, rect.w)),
            h: snap(Math.max(MIN_H, rect.h)),
          },
        },
      }
    }),

  setOpen: (id, open) =>
    set((s) => {
      const win = s.windows[id]
      if (!win) return s
      const z = open ? s.maxZ + 1 : win.z
      return {
        windows: { ...s.windows, [id]: { ...win, open, minimized: false, z } },
        maxZ: Math.max(s.maxZ, z),
      }
    }),

  toggleMinimized: (id) =>
    set((s) => {
      const win = s.windows[id]
      if (!win) return s
      return { windows: { ...s.windows, [id]: { ...win, minimized: !win.minimized } } }
    }),

  serializeLayout: () => {
    const out: Layout = {}
    for (const win of Object.values(get().windows)) {
      const { id, ...rest } = win
      out[id] = rest
    }
    return out
  },

  applyLayout: (layout) =>
    set((s) => {
      const windows = { ...s.windows }
      let maxZ = s.maxZ
      for (const [id, data] of Object.entries(layout)) {
        const win = windows[id as WindowId]
        if (!win) continue
        windows[id as WindowId] = { ...win, ...data, id: win.id }
        maxZ = Math.max(maxZ, data.z)
      }
      return { windows, maxZ }
    }),
}))
