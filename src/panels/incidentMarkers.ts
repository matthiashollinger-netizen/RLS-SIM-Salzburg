import maplibregl from 'maplibre-gl'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useCallStore } from '../state/callStore.ts'
import { geoCircle } from '../engine/geo.ts'
import { alarmtext } from '../engine/auftrag.ts'

/**
 * Incident markers (open Aufträge) + active-call location (AML point with
 * accuracy circle, GAME_DATA §3b Ortungskaskade) on the Lagekarte.
 */

const AML_SOURCE = 'aml-circle'
const AML_LAYER = 'aml-circle-fill'

/** partner forces around the scene (POL/FW/WR/BR — Rework 2, point 10) */
const PARTNER_OFFSETS: Record<string, [number, number]> = {
  POL: [0.0012, 0.0018],
  FW: [-0.0012, 0.0018],
  WR: [0.0012, -0.0018],
  BR: [-0.0012, -0.0018],
}

const PARTNER_TITLES: Record<string, string> = {
  POL: 'Polizei',
  FW: 'Feuerwehr',
  WR: 'Wasserrettung',
  BR: 'Bergrettung',
}

export function attachIncidentMarkers(map: maplibregl.Map): () => void {
  const markers = new Map<string, maplibregl.Marker>()
  const partnerMarkers = new Map<string, maplibregl.Marker>()
  let amlMarker: maplibregl.Marker | null = null

  const syncIncidents = () => {
    const { auftraege } = useDispatchStore.getState()
    for (const a of Object.values(auftraege)) {
      const open = a.state !== 'abgeschlossen'
      const existing = markers.get(a.id)
      if (open && !existing) {
        const el = document.createElement('div')
        el.className = 'map-marker-incident'
        el.textContent = '!'
        el.title = alarmtext(a)
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([a.ort.lon, a.ort.lat])
          .addTo(map)
        el.addEventListener('click', () => useDispatchStore.getState().select(a.id))
        markers.set(a.id, marker)
      } else if (!open && existing) {
        existing.remove()
        markers.delete(a.id)
      }

      // alarmed partner organizations appear beside the scene (Rework 2)
      for (const [partner, [dLat, dLon]] of Object.entries(PARTNER_OFFSETS)) {
        const key = `${a.id}:${partner}`
        const show = open && a.partnersAlarmed.includes(partner as never)
        const pExisting = partnerMarkers.get(key)
        if (show && !pExisting) {
          const el = document.createElement('div')
          el.className = `map-marker-partner map-marker-partner-${partner.toLowerCase()}`
          el.textContent = partner
          const securing = partner === 'POL' && a.lagefreigabe && !a.lageFreigegeben
          el.title = `${PARTNER_TITLES[partner] ?? partner} — ${a.id}${securing ? ' (sichert die Lage)' : ''}`
          partnerMarkers.set(
            key,
            new maplibregl.Marker({ element: el })
              .setLngLat([a.ort.lon + dLon, a.ort.lat + dLat])
              .addTo(map),
          )
        } else if (!show && pExisting) {
          pExisting.remove()
          partnerMarkers.delete(key)
        }
      }
    }
  }

  const ensureAmlLayer = () => {
    if (!map.isStyleLoaded()) return
    if (!map.getSource(AML_SOURCE)) {
      map.addSource(AML_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: AML_LAYER,
        type: 'fill',
        source: AML_SOURCE,
        paint: { 'fill-color': '#5a8df5', 'fill-opacity': 0.18 },
      })
    }
  }

  const syncCall = () => {
    const active = useCallStore.getState().active
    const point = active?.amlPoint
    ensureAmlLayer()
    const source = map.getSource(AML_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (point) {
      source?.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [geoCircle(point, point.radiusM)] },
      })
      if (!amlMarker) {
        const el = document.createElement('div')
        el.className = 'map-marker-aml'
        el.textContent = '📍'
        amlMarker = new maplibregl.Marker({ element: el })
          .setLngLat([point.lon, point.lat])
          .addTo(map)
      } else {
        amlMarker.setLngLat([point.lon, point.lat])
      }
    } else {
      source?.setData({ type: 'FeatureCollection', features: [] })
      if (amlMarker) {
        amlMarker.remove()
        amlMarker = null
      }
    }
  }

  const unsubDispatch = useDispatchStore.subscribe(syncIncidents)
  const unsubCall = useCallStore.subscribe(syncCall)
  map.on('styledata', ensureAmlLayer)
  map.on('load', () => {
    syncIncidents()
    syncCall()
  })

  return () => {
    unsubDispatch()
    unsubCall()
    for (const m of markers.values()) m.remove()
    markers.clear()
    for (const m of partnerMarkers.values()) m.remove()
    partnerMarkers.clear()
    amlMarker?.remove()
  }
}
