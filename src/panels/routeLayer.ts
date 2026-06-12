import maplibregl from 'maplibre-gl'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'

/**
 * Live route polylines for engaged units (street routing, Rework).
 *
 * Atmosphere pass: the dash pattern cycles through pre-shifted phase arrays
 * (~8 fps) so the routes appear to flow toward the destination — maplibre
 * cannot animate line-dasharray natively. Colors are read from design tokens
 * at runtime because maplibre paint needs concrete color values.
 */

const SOURCE = 'unit-routes'
const LAYER = 'unit-routes-line'
/** trail sync cadence — keeps the route glued to the extrapolated marker */
const SYNC_MS = 250
/** dash-phase animation cadence (~8 fps) */
const DASH_MS = 125

/**
 * Dash pattern (dash 2 / gap 1.5, period 3.5) pre-shifted in quarter-period
 * steps. Cycling these in order moves the dashes from the unit toward its
 * destination. Decomposition: phase p ⇒ [remaining dash, gap, wrapped dash, 0]
 * or [0, remaining gap, dash, wrapped gap].
 */
const DASH_PHASES: number[][] = [
  [2, 1.5],
  [0, 0.875, 2, 0.625],
  [0.25, 1.5, 1.75, 0],
  [1.125, 1.5, 0.875, 0],
]

/** maplibre needs concrete colors — read tokens at runtime (single source of truth) */
function tokenColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function attachRouteLayer(map: maplibregl.Map): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let dashPhase = 0
  /** cheap change fingerprint — skip setData (and GPU re-upload) when idle */
  let lastFingerprint = ''
  let hasFeatures = false

  const ensure = () => {
    if (!map.isStyleLoaded() || map.getSource(SOURCE)) return
    const sosiColor = tokenColor('--sosi', '#ef4352')
    const routeColor = tokenColor('--info', '#5a8df5')
    map.addSource(SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: LAYER,
      type: 'line',
      source: SOURCE,
      paint: {
        'line-color': ['case', ['get', 'sosi'], sosiColor, routeColor],
        'line-width': 2,
        'line-opacity': 0.55,
        'line-dasharray': DASH_PHASES[0]!,
      },
    })
  }

  const sync = () => {
    ensure()
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return
    const simSec = useGameStore.getState().simSec
    const features: GeoJSON.Feature[] = []
    let fingerprint = ''
    for (const rt of vehicleSim.all()) {
      if (!rt.assignment) continue
      const rest = vehicleSim.remainingPath(rt, simSec)
      if (!rest) continue
      const head = rest[0]
      fingerprint += `${rt.id}:${rest.length}:${head ? head.lat.toFixed(5) : ''};`
      features.push({
        type: 'Feature',
        properties: { sosi: rt.assignment.sosi },
        geometry: { type: 'LineString', coordinates: rest.map((p) => [p.lon, p.lat]) },
      })
    }
    if (fingerprint === lastFingerprint) return // idle map: no re-upload
    lastFingerprint = fingerprint
    hasFeatures = features.length > 0
    source.setData({ type: 'FeatureCollection', features })
  }

  const animateDash = () => {
    // reduced motion ⇒ static dashes; hidden tab/empty map ⇒ no GPU work
    if (reduced.matches || document.visibilityState !== 'visible') return
    if (!hasFeatures || !map.getLayer(LAYER)) return
    dashPhase = (dashPhase + 1) % DASH_PHASES.length
    map.setPaintProperty(LAYER, 'line-dasharray', DASH_PHASES[dashPhase]!)
  }

  const timer = setInterval(sync, SYNC_MS)
  const dashTimer = setInterval(animateDash, DASH_MS)
  map.on('styledata', ensure)
  map.on('load', sync)

  return () => {
    clearInterval(timer)
    clearInterval(dashTimer)
    map.off('styledata', ensure)
    map.off('load', sync)
  }
}
