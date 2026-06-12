import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { helicopters, hospitals, stations } from '../data/index.ts'
import { daylightFactor } from '../engine/time.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useMapStore, type MapLayers } from '../state/mapStore.ts'
import { attachVehicleMarkers } from './vehicleMarkers.ts'
import { attachIncidentMarkers } from './incidentMarkers.ts'
import { attachRouteLayer } from './routeLayer.ts'
import { attachWeatherOverlay } from './weatherOverlay.ts'
import './map-panel.css'

/**
 * Dark base map (OpenFreeMap vector style, no key) with raster fallback
 * (Carto dark) per CLAUDE.md §1. Infrastructure markers as DOM markers so
 * design tokens style them and no glyph server is needed.
 *
 * Atmosphere pass: day/night tint over the basemap canvas (markers stay
 * bright), weather particle overlay, collapsible map legend.
 */
const VECTOR_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

/** night-tint refresh cadence — a 5 s timer is plenty for a ±45 min dusk ramp */
const NIGHT_TINT_MS = 5000

const RASTER_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto-dark', type: 'raster', source: 'carto-dark' }],
}

function makeMarkerEl(kind: 'station' | 'hospital' | 'heli', label: string, title: string) {
  const el = document.createElement('div')
  el.className = `map-marker map-marker-${kind}`
  el.textContent = label
  el.title = title
  return el
}

const STATUS_LEGEND: { token: string; label: string }[] = [
  { token: '--status-00', label: '00/7 frei / Rückfahrt' },
  { token: '--status-1', label: '1/2 alarmiert / Anfahrt' },
  { token: '--status-3', label: '3 am Einsatzort' },
  { token: '--status-4', label: '4/5 Transport / am Ziel' },
  { token: '--status-6', label: '6 abgeschlossen' },
  { token: '--status-88', label: '88 / Position' },
  { token: '--status-oos', label: '91–95 außer Betrieb' },
]

export function MapPanel() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const wrap = wrapRef.current
    if (!container || !wrap) return

    const map = new maplibregl.Map({
      container,
      style: VECTOR_DARK_STYLE,
      center: [13.1, 47.55],
      zoom: 8,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Day/night tint: dims only the basemap canvas — DOM markers are appended
    // to the same canvas container LATER, so they stay bright above the tint.
    const nightEl = document.createElement('div')
    nightEl.className = 'map-night-overlay'
    nightEl.style.opacity = '0'
    map.getCanvasContainer().appendChild(nightEl)
    const applyNight = () => {
      const g = useGameStore.getState()
      const next = (1 - daylightFactor(g.simSec, g)).toFixed(2)
      if (nightEl.style.opacity !== next) nightEl.style.opacity = next
    }
    applyNight()
    const nightTimer = window.setInterval(applyNight, NIGHT_TINT_MS)

    // Style fetch failed (offline/CI) → switch to raster fallback once.
    let styleLoaded = false
    let fallbackApplied = false
    map.on('styledata', () => {
      styleLoaded = true
    })
    map.on('error', (e) => {
      if (!styleLoaded && !fallbackApplied) {
        fallbackApplied = true
        map.setStyle(RASTER_FALLBACK_STYLE)
      } else if (!fallbackApplied) {
        // tile errors are non-fatal
        console.warn('map error', e.error?.message)
      }
    })

    // infrastructure markers grouped per layer for the toggle control
    const infra: Record<'wachen' | 'kliniken' | 'helis', maplibregl.Marker[]> = {
      wachen: [],
      kliniken: [],
      helis: [],
    }
    for (const s of stations) {
      if (s.type === 'LST') continue
      const el = makeMarkerEl('station', 'W', `${s.name} (${s.funk ?? ''})`)
      infra.wachen.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([s.lon, s.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false }).setText(`${s.name} (${s.funk ?? ''})`))
          .addTo(map),
      )
    }
    for (const h of hospitals) {
      const el = makeMarkerEl('hospital', 'H', h.name)
      infra.kliniken.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([h.lon, h.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false }).setText(h.name))
          .addTo(map),
      )
    }
    for (const heli of helicopters) {
      const el = makeMarkerEl('heli', 'X', `${heli.rufname} — ${heli.basis}`)
      infra.helis.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([heli.lon, heli.lat])
          .setPopup(
            new maplibregl.Popup({ closeButton: false }).setText(
              `${heli.rufname} (${heli.maschine})`,
            ),
          )
          .addTo(map),
      )
    }

    const applyInfraLayers = (layers: MapLayers) => {
      for (const key of ['wachen', 'kliniken', 'helis'] as const) {
        for (const m of infra[key]) {
          m.getElement().style.display = layers[key] ? '' : 'none'
        }
      }
    }
    applyInfraLayers(useMapStore.getState().layers)
    const unsubLayers = useMapStore.subscribe((s, prev) => {
      if (s.layers !== prev.layers) applyInfraLayers(s.layers)
    })

    // focus requests (double-click in lists, new incidents)
    const unsubFocus = useMapStore.subscribe((s, prev) => {
      if (s.focus && s.focus !== prev.focus) {
        map.flyTo({ center: [s.focus.lon, s.focus.lat], zoom: s.focus.zoom, duration: 700 })
      }
    })

    const detachVehicles = attachVehicleMarkers(map)
    const detachIncidents = attachIncidentMarkers(map)
    const detachRoutes = attachRouteLayer(map)
    const detachWeather = attachWeatherOverlay(wrap)

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      unsubLayers()
      unsubFocus()
      detachVehicles()
      detachIncidents()
      detachRoutes()
      detachWeather()
      window.clearInterval(nightTimer)
      nightEl.remove()
      for (const list of Object.values(infra)) for (const m of list) m.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  const layers = useMapStore((s) => s.layers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const layerDefs: { key: keyof MapLayers; label: string }[] = [
    { key: 'einsatzFzg', label: 'Einsatzfzg.' },
    { key: 'sonstigeFzg', label: 'KTW/BTW/…' },
    { key: 'wachen', label: 'Wachen' },
    { key: 'kliniken', label: 'Kliniken' },
    { key: 'helis', label: 'Heli-Basen' },
  ]

  return (
    <div ref={wrapRef} className="map-panel-wrap">
      <div ref={containerRef} className="map-panel" data-testid="map-panel" />
      <div className="map-layer-control" role="group" aria-label="Kartenebenen und Legende">
        <button
          type="button"
          className="map-legend-toggle"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((o) => !o)}
        >
          <span aria-hidden="true">{legendOpen ? '▾' : '▸'}</span> Legende
        </button>
        {legendOpen && (
          <div className="map-legend-body">
            <div className="map-legend-section">
              <div className="map-legend-heading">Ebenen</div>
              {layerDefs.map((l) => (
                <label key={l.key}>
                  <input
                    type="checkbox"
                    checked={layers[l.key]}
                    onChange={() => toggleLayer(l.key)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
            <div className="map-legend-section">
              <div className="map-legend-heading">Fahrzeug-Status</div>
              {STATUS_LEGEND.map((s) => (
                <div key={s.token} className="map-legend-row">
                  <span className="map-legend-chip" style={{ background: `var(${s.token})` }} />
                  {s.label}
                </div>
              ))}
            </div>
            <div className="map-legend-section">
              <div className="map-legend-heading">Symbole</div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-pill" />
                RTW/KTW (rund)
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-square" />
                NEF/NAW (eckig)
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-heli" />
                Hubschrauber
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-incident" />
                Einsatzort (pulsierend)
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-over" />
                Hilfsfrist überschritten
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-station" />
                Wache
              </div>
              <div className="map-legend-row">
                <span className="map-legend-shape map-legend-shape-hospital" />
                Klinik
              </div>
            </div>
            <div className="map-legend-section">
              <div className="map-legend-heading">Routen</div>
              <div className="map-legend-row">
                <span className="map-legend-line map-legend-line-sosi" />
                Anfahrt mit Sondersignal
              </div>
              <div className="map-legend-row">
                <span className="map-legend-line map-legend-line-normal" />
                Anfahrt / Transport
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
