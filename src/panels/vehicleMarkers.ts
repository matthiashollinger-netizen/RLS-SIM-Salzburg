import maplibregl from 'maplibre-gl'
import { statusByCode, hospitals } from '../data/index.ts'
import { vehicleSim } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'
import { probealarm } from '../state/debugActions.ts'
import { unitDisplayName } from '../lib/format.ts'
import { isAvailable } from '../engine/status.ts'
import type { VehicleRuntime } from '../engine/vehicleSim.ts'

/**
 * Vehicle markers as DOM markers driven by an rAF loop reading the simulation
 * directly — no React re-render per movement frame (CLAUDE.md §5 performance).
 * Light position jitter per vehicle avoids perfectly stacked markers (§3).
 */

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

export function attachVehicleMarkers(map: maplibregl.Map): () => void {
  const markers = new Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>()
  let raf = 0

  const frame = () => {
    const simSec = useGameStore.getState().simSec
    for (const rt of vehicleSim.all()) {
      let entry = markers.get(rt.id)
      if (rt.status === 'AUS') {
        if (entry) {
          entry.marker.remove()
          markers.delete(rt.id)
        }
        continue
      }
      if (!entry) {
        const el = document.createElement('div')
        el.className = 'map-marker-vehicle'
        el.dataset.typ = rt.unit.typ
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([rt.basePos.lon, rt.basePos.lat])
          .setPopup(new maplibregl.Popup({ closeButton: false, maxWidth: '280px' }))
          .addTo(map)
        el.addEventListener('mouseenter', () => {
          el.title = `${unitDisplayName(rt.unit)} ${rt.unit.typ}`
        })
        marker.getPopup().on('open', () => {
          const current = vehicleSim.get(rt.id)
          if (current) marker.getPopup().setDOMContent(popupHtml(current))
        })
        entry = { marker, el }
        markers.set(rt.id, entry)
      }
      const { dLat, dLon } = jitterOf(rt.id)
      const pos = vehicleSim.posOf(rt, simSec)
      entry.marker.setLngLat([pos.lon + dLon, pos.lat + dLat])
      const def = statusByCode.get(rt.status)
      entry.el.style.background = `var(${def?.colorToken ?? '--status-oos'})`
      entry.el.textContent = rt.status
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    for (const { marker } of markers.values()) marker.remove()
    markers.clear()
  }
}
