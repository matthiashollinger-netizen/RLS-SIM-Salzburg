import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { helicopters, hospitals, stations } from '../data/index.ts'
import './map-panel.css'

/**
 * Dark base map (OpenFreeMap vector style, no key) with raster fallback
 * (Carto dark) per CLAUDE.md §1. Infrastructure markers as DOM markers so
 * design tokens style them and no glyph server is needed.
 */
const VECTOR_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

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

export function MapPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

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

    const markers: maplibregl.Marker[] = []
    for (const s of stations) {
      if (s.type === 'LST') continue
      const el = makeMarkerEl('station', 'W', s.name)
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([s.lon, s.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false }).setText(`${s.name} (${s.funk ?? ''})`))
          .addTo(map),
      )
    }
    for (const h of hospitals) {
      const el = makeMarkerEl('hospital', 'H', h.name)
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([h.lon, h.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false }).setText(h.name))
          .addTo(map),
      )
    }
    for (const heli of helicopters) {
      const el = makeMarkerEl('heli', '✕', `${heli.rufname} — ${heli.basis}`)
      markers.push(
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

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      for (const m of markers) m.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} className="map-panel" data-testid="map-panel" />
}
