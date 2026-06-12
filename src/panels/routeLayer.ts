import maplibregl from 'maplibre-gl'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'

/** Live route polylines for engaged units (street routing, Rework). */

const SOURCE = 'unit-routes'
const LAYER = 'unit-routes-line'

export function attachRouteLayer(map: maplibregl.Map): () => void {
  const ensure = () => {
    if (!map.isStyleLoaded() || map.getSource(SOURCE)) return
    map.addSource(SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: LAYER,
      type: 'line',
      source: SOURCE,
      paint: {
        'line-color': ['case', ['get', 'sosi'], '#ef4352', '#5a8df5'],
        'line-width': 2,
        'line-opacity': 0.55,
        'line-dasharray': [2, 1.5],
      },
    })
  }

  const sync = () => {
    ensure()
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return
    const simSec = useGameStore.getState().simSec
    const features: GeoJSON.Feature[] = []
    for (const rt of vehicleSim.all()) {
      if (!rt.assignment) continue
      const rest = vehicleSim.remainingPath(rt, simSec)
      if (!rest) continue
      features.push({
        type: 'Feature',
        properties: { sosi: rt.assignment.sosi },
        geometry: { type: 'LineString', coordinates: rest.map((p) => [p.lon, p.lat]) },
      })
    }
    source.setData({ type: 'FeatureCollection', features })
  }

  const timer = setInterval(sync, 1000)
  map.on('styledata', ensure)
  map.on('load', sync)

  return () => {
    clearInterval(timer)
  }
}
