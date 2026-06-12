import maplibregl from 'maplibre-gl'
import { statusByCode, hospitals } from '../data/index.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'
import { useMapStore, vehicleLayerOf } from '../state/mapStore.ts'
import { probealarm } from '../state/debugActions.ts'
import { unitDisplayName } from '../lib/format.ts'
import { isAvailable } from '../engine/status.ts'
import type { VehicleRuntime } from '../engine/vehicleSim.ts'

/**
 * Vehicle markers as DOM markers driven by an rAF loop reading the simulation
 * directly — no React re-render per movement frame (CLAUDE.md §5 performance).
 * Light position jitter per vehicle avoids perfectly stacked markers (§3).
 *
 * Atmosphere pass: smooth 60 fps motion via render-time extrapolation between
 * the 250 ms sim ticks, dirty-checked DOM writes, and a Blaulicht strobe class
 * while units respond/transport with Sondersignal.
 */

/** must match REAL_TICK_MS / 1000 in state/simulation.ts (extrapolation clamp) */
const SIM_TICK_SEC = 0.25
/** DOM update cadence while the clock is paused (~2 fps) */
const PAUSED_FRAME_MS = 500

function jitterOf(id: string): { dLat: number; dLon: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const a = ((h % 100) / 100) * Math.PI * 2
  const r = 0.00035 // ~30 m
  return { dLat: Math.sin(a) * r, dLon: Math.cos(a) * r }
}

function popupHtml(rt: VehicleRuntime): HTMLElement {
  const el = document.createElement('div')
  el.className = 'vehicle-popup'
  const title = document.createElement('div')
  title.className = 'vehicle-popup-title mono'
  title.textContent = `${unitDisplayName(rt.unit)} · ${rt.unit.typ}${rt.unit.nickname && rt.unit.typ !== 'HELI' ? ` „${rt.unit.nickname}"` : ''}`
  el.appendChild(title)
  const statusLine = document.createElement('div')
  statusLine.className = 'vehicle-popup-status'
  const label = rt.status === 'AUS' ? 'außer Dienst' : (statusByCode.get(rt.status)?.label ?? '')
  statusLine.textContent = `Status ${rt.status === 'AUS' ? '—' : rt.status} ${label}`
  el.appendChild(statusLine)
  if (rt.assignment) {
    const a = document.createElement('div')
    a.className = 'vehicle-popup-assignment'
    a.textContent = rt.assignment.label
    el.appendChild(a)
  }
  if (isAvailable(rt.status)) {
    const actions = document.createElement('div')
    actions.className = 'vehicle-popup-actions'
    for (const h of hospitals.filter((h) => h.positionsCode)) {
      const btn = document.createElement('button')
      btn.textContent = `→ ${h.short}`
      btn.addEventListener('click', () =>
        vehicleSim.sendToPosition(rt.id, h.id, useGameStore.getState().simSec),
      )
      actions.appendChild(btn)
    }
    const test = document.createElement('button')
    test.textContent = 'Probealarm'
    test.addEventListener('click', () => probealarm(rt.id))
    actions.appendChild(test)
    el.appendChild(actions)
  }
  return el
}

interface MarkerEntry {
  marker: maplibregl.Marker
  el: HTMLDivElement
  status: HTMLSpanElement
  label: HTMLSpanElement
  /** dirty-check caches — only touch the DOM when a value actually changed */
  lastLon: number
  lastLat: number
  lastStatus: string
  lastEngaged: boolean
  lastSosi: boolean
  lastLabelShown: boolean
}

export function attachVehicleMarkers(map: maplibregl.Map): () => void {
  const markers = new Map<string, MarkerEntry>()
  let raf = 0
  // render-clock extrapolation state (UI code — performance.now allowed here)
  let lastSimSec = Number.NaN
  let lastRealMs = 0
  let lastWorkMs = 0

  const frame = () => {
    raf = requestAnimationFrame(frame)
    if (document.hidden) return
    const now = performance.now()
    const g = useGameStore.getState()
    const paused = !g.running || g.speed === 0
    if (paused && now - lastWorkMs < PAUSED_FRAME_MS) return
    lastWorkMs = now
    if (g.simSec !== lastSimSec) {
      lastSimSec = g.simSec
      lastRealMs = now
    }
    // smooth motion: extrapolate the render clock between 250 ms sim ticks,
    // clamped to +1.5 ticks so a stalled sim loop cannot run ahead
    let renderSimSec = g.simSec
    if (!paused) {
      const extra = ((now - lastRealMs) / 1000) * g.speed
      renderSimSec = g.simSec + Math.min(extra, SIM_TICK_SEC * g.speed * 1.5)
    }
    const layers = useMapStore.getState().layers
    const showLabels = map.getZoom() >= 11
    for (const rt of vehicleSim.all()) {
      let entry = markers.get(rt.id)
      const layer = vehicleLayerOf(rt.unit)
      const engaged = rt.assignment !== undefined
      // engaged units stay visible regardless of layer toggles
      const visible = rt.status !== 'AUS' && (engaged || layers[layer])
      if (!visible) {
        if (entry) {
          entry.marker.remove()
          markers.delete(rt.id)
        }
        continue
      }
      if (!entry) {
        const el = document.createElement('div')
        el.className = `map-marker-vehicle vehicle-layer-${layer}`
        el.dataset.typ = rt.unit.typ
        const status = document.createElement('span')
        status.className = 'map-marker-vehicle-status'
        const label = document.createElement('span')
        label.className = 'map-marker-vehicle-label mono'
        label.textContent = unitDisplayName(rt.unit)
        el.append(status, label)
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([rt.basePos.lon, rt.basePos.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, maxWidth: '280px' }))
          .addTo(map)
        el.title = `${unitDisplayName(rt.unit)} ${rt.unit.typ}`
        marker.getPopup().on('open', () => {
          const current = vehicleSim.get(rt.id)
          if (current) marker.getPopup().setDOMContent(popupHtml(current))
        })
        entry = {
          marker,
          el,
          status,
          label,
          lastLon: Number.NaN,
          lastLat: Number.NaN,
          lastStatus: '',
          lastEngaged: false,
          lastSosi: false,
          lastLabelShown: true,
        }
        markers.set(rt.id, entry)
      }
      const { dLat, dLon } = jitterOf(rt.id)
      const pos = vehicleSim.posOf(rt, renderSimSec)
      const lon = pos.lon + dLon
      const lat = pos.lat + dLat
      if (lon !== entry.lastLon || lat !== entry.lastLat) {
        entry.marker.setLngLat([lon, lat])
        entry.lastLon = lon
        entry.lastLat = lat
      }
      if (rt.status !== entry.lastStatus) {
        const def = statusByCode.get(rt.status)
        entry.status.style.background = `var(${def?.colorToken ?? '--status-oos'})`
        entry.status.textContent = rt.status
        entry.lastStatus = rt.status
      }
      if (engaged !== entry.lastEngaged) {
        entry.el.classList.toggle('vehicle-engaged', engaged)
        entry.lastEngaged = engaged
      }
      // Blaulicht while responding (2) or transporting (4) with Sondersignal
      const sosi = (rt.assignment?.sosi ?? false) && (rt.status === '2' || rt.status === '4')
      if (sosi !== entry.lastSosi) {
        entry.el.classList.toggle('vehicle-sosi', sosi)
        entry.lastSosi = sosi
      }
      if (showLabels !== entry.lastLabelShown) {
        entry.label.style.display = showLabels ? '' : 'none'
        entry.lastLabelShown = showLabels
      }
    }
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    for (const { marker } of markers.values()) marker.remove()
    markers.clear()
  }
}
