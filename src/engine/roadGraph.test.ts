import { afterEach, describe, expect, it } from 'vitest'
import {
  isRoadGraphLoaded,
  loadRoadGraph,
  nearestNode,
  routeRoad,
  unloadRoadGraph,
  type RoadGraphData,
} from './roadGraph.ts'
import { routeGround } from './routing.ts'
import { pathCumulativeKm, pathPosition } from './geo.ts'

/**
 * Synthetic L-shaped network around Salzburg:
 *   A(47.80,13.00) — B(47.80,13.10) — C(47.90,13.10)
 * plus a slow direct detour A — D(47.86,13.03) — C of tertiary class.
 */
const graph: RoadGraphData = {
  v: 1,
  nodes: [47.8, 13.0, 47.8, 13.1, 47.9, 13.1, 47.86, 13.03],
  edges: [
    [0, 1, 7460, 0, []], // A-B motorway ~7.46 km
    [1, 2, 11120, 0, []], // B-C motorway ~11.12 km
    [0, 3, 7200, 3, []], // A-D tertiary
    [3, 2, 6900, 3, []], // D-C tertiary
  ],
}

afterEach(() => unloadRoadGraph())

describe('road graph routing (Rework: Straßen statt Luftlinie)', () => {
  it('routes along edges and prefers fast roads over shorter slow ones', () => {
    loadRoadGraph(graph)
    expect(isRoadGraphLoaded()).toBe(true)
    const route = routeRoad({ lat: 47.8, lon: 13.0 }, { lat: 47.9, lon: 13.1 })
    expect(route).not.toBeNull()
    // motorway A→B→C: 18.58 km / 100 km/h ≈ 0.186 h; tertiary A→D→C: 14.1/50 ≈ 0.28 h
    expect(route!.km).toBeGreaterThan(17)
    // path passes through B (47.80, 13.10)
    expect(route!.path.some((p) => Math.abs(p.lat - 47.8) < 1e-6 && Math.abs(p.lon - 13.1) < 1e-6)).toBe(
      true,
    )
  })

  it('nearestNode snaps to the closest graph node', () => {
    loadRoadGraph(graph)
    expect(nearestNode({ lat: 47.801, lon: 13.001 })).toBe(0)
    expect(nearestNode({ lat: 47.899, lon: 13.099 })).toBe(2)
  })

  it('routeGround returns a street path when the graph is loaded, fallback otherwise', () => {
    const from = { lat: 47.8, lon: 13.0 }
    const to = { lat: 47.9, lon: 13.1 }
    const fallback = routeGround(from, to, { typ: 'RTW', sosi: true })
    expect(fallback.path).toBeUndefined() // no graph → haversine model

    loadRoadGraph(graph)
    const road = routeGround(from, to, { typ: 'RTW', sosi: true })
    expect(road.path).toBeDefined()
    expect(road.path!.length).toBeGreaterThan(2)
    // helicopters NEVER use the graph (Luftlinie nur Heli)
    const heli = routeGround(from, to, { typ: 'HELI', sosi: true })
    expect(heli.path).toBeUndefined()
  })

  it('SoSi shortens street travel time', () => {
    loadRoadGraph(graph)
    const from = { lat: 47.8, lon: 13.0 }
    const to = { lat: 47.9, lon: 13.1 }
    const noSosi = routeGround(from, to, { typ: 'RTW', sosi: false })
    const sosi = routeGround(from, to, { typ: 'RTW', sosi: true })
    expect(sosi.sec).toBeLessThan(noSosi.sec)
  })

  it('pathPosition interpolates along the polyline', () => {
    const path = [
      { lat: 47.8, lon: 13.0 },
      { lat: 47.8, lon: 13.1 },
      { lat: 47.9, lon: 13.1 },
    ]
    const cum = pathCumulativeKm(path)
    const mid = pathPosition(path, cum, 0.5)
    // halfway of ~18.6 km is past the corner? corner at 7.46 of 18.58 → 0.40;
    // 0.5 lies on the second segment heading north
    expect(mid.lon).toBeCloseTo(13.1, 3)
    expect(mid.lat).toBeGreaterThan(47.8)
    expect(pathPosition(path, cum, 0).lat).toBeCloseTo(47.8)
    expect(pathPosition(path, cum, 1).lat).toBeCloseTo(47.9)
  })
})
