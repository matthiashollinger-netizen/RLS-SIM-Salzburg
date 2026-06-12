import { create } from 'zustand'

/** Map UI state (Rework): focus requests + layer visibility (persisted). */

export interface MapLayers {
  wachen: boolean
  kliniken: boolean
  helis: boolean
  /** NEF/NAW/RTW/ITW/HELI + Notfall-KTW */
  einsatzFzg: boolean
  /** KTW/GKTW/BTW/MTW/EL */
  sonstigeFzg: boolean
}

const LAYERS_KEY = 'rls-map-layers-v1'

function loadLayers(): MapLayers {
  const defaults: MapLayers = {
    wachen: true,
    kliniken: true,
    helis: true,
    einsatzFzg: true,
    sonstigeFzg: false, // KTW/BTW clutter off by default — toggleable
  }
  try {
    const raw = localStorage.getItem(LAYERS_KEY)
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<MapLayers>) } : defaults
  } catch {
    return defaults
  }
}

interface MapState {
  /** monotonically increasing token so repeated focus on same point still flies */
  focus: { lat: number; lon: number; zoom: number; token: number } | null
  layers: MapLayers
  focusOn: (lat: number, lon: number, zoom?: number) => void
  toggleLayer: (key: keyof MapLayers) => void
}

let focusToken = 1

export const useMapStore = create<MapState>((set) => ({
  focus: null,
  layers: loadLayers(),
  focusOn: (lat, lon, zoom = 13) => set({ focus: { lat, lon, zoom, token: focusToken++ } }),
  toggleLayer: (key) =>
    set((s) => {
      const layers = { ...s.layers, [key]: !s.layers[key] }
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(layers))
      } catch {
        // best effort
      }
      return { layers }
    }),
}))

/** Vehicle marker category for layer toggles. */
export function vehicleLayerOf(unit: { typ: string; notfallKtw?: boolean }): keyof MapLayers {
  if (
    unit.typ === 'NEF' ||
    unit.typ === 'NAW' ||
    unit.typ === 'RTW' ||
    unit.typ === 'ITW' ||
    unit.typ === 'HELI' ||
    unit.notfallKtw
  )
    return 'einsatzFzg'
  return 'sonstigeFzg'
}
