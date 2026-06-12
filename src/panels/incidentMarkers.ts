import maplibregl from 'maplibre-gl'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useCallStore } from '../state/callStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import { geoCircle } from '../engine/geo.ts'
import { alarmtext, type Auftrag } from '../engine/auftrag.ts'

/**
 * Incident markers (open Aufträge) + active-call location (AML point with
 * accuracy circle, GAME_DATA §3b Ortungskaskade) on the Lagekarte.
 *
 * Atmosphere pass: a 1 Hz sync escalates markers via data attributes —
 * urgency (Hilfsfrist countdown) and Auftrag state drive the CSS pulse.
 */

const AML_SOURCE = 'aml-circle'
const AML_LAYER = 'aml-circle-fill'

/** token-colored inline SVG pin (replaces the emoji 📍, themable + crisp) */
const AML_PIN_SVG =
  '<svg viewBox="0 0 24 32" width="18" height="24" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 1C6.5 1 2 5.4 2 10.8 2 18.2 12 31 12 31s10-12.8 10-20.2C22 5.4 17.5 1 12 1z"/>' +
  '<circle cx="12" cy="10.5" r="4" fill="var(--bg-app)"/></svg>'

/** maplibre needs concrete colors — read the token at runtime (single source of truth) */
function tokenColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

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

/** Hilfsfrist escalation: critical below 5 min remaining, over when missed. */
const URGENCY_CRITICAL_SEC = 300

type Urgency = 'normal' | 'critical' | 'over'

function urgencyOf(a: Auftrag, simSec: number): Urgency {
  // the race ends once the first unit is on scene — no further escalation
  if (a.hilfsfristDeadline === undefined || a.firstArrivalSec !== undefined) return 'normal'
  if (simSec > a.hilfsfristDeadline) return 'over'
  if (a.hilfsfristDeadline - simSec < URGENCY_CRITICAL_SEC) return 'critical'
  return 'normal'
}

export function attachIncidentMarkers(map: maplibregl.Map): () => void {
  const markers = new Map<string, maplibregl.Marker>()
  const partnerMarkers = new Map<string, maplibregl.Marker>()
  let amlMarker: maplibregl.Marker | null = null

  /** 1 Hz escalation sync — data attributes only, CSS does the animation */
  const syncUrgency = () => {
    const { auftraege } = useDispatchStore.getState()
    const simSec = useGameStore.getState().simSec
    for (const [id, marker] of markers) {
      const a = auftraege[id]
      if (!a) continue
      const el = marker.getElement()
      const urgency = urgencyOf(a, simSec)
      if (el.dataset.urgency !== urgency) el.dataset.urgency = urgency
      if (el.dataset.state !== a.state) el.dataset.state = a.state
      // MANV scenes get a dominant marker (code can change via override)
      el.classList.toggle('map-marker-incident-manv', a.code.startsWith('MANV'))
      const title = alarmtext(a)
      if (el.title !== title) el.title = title
    }
  }

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
    // freshly created markers get their escalation attributes immediately
    syncUrgency()
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
        paint: { 'fill-color': tokenColor('--info', '#5a8df5'), 'fill-opacity': 0.18 },
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
        el.innerHTML = AML_PIN_SVG
        amlMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
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
  const urgencyTimer = window.setInterval(syncUrgency, 1000)
  map.on('styledata', ensureAmlLayer)
  map.on('load', () => {
    syncIncidents()
    syncCall()
  })

  return () => {
    unsubDispatch()
    unsubCall()
    clearInterval(urgencyTimer)
    for (const m of markers.values()) m.remove()
    markers.clear()
    for (const m of partnerMarkers.values()) m.remove()
    partnerMarkers.clear()
    amlMarker?.remove()
  }
}
