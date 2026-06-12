import { haversineKm, type LatLon } from './geo.ts'

/**
 * Street routing (Rework: "Fahrzeuge müssen der Straße folgen").
 * The graph is exported once at build time from OSM (scripts/build-roads.mts)
 * and loaded lazily as a static asset — no routing service at runtime.
 * Ground vehicles route via A*; helicopters keep flying straight lines.
 */

export interface RoadGraphData {
  v: number
  /** packed [lat0, lon0, lat1, lon1, …] */
  nodes: number[]
  /** [aIdx, bIdx, lengthM, classId, [latX,lonX,…] intermediate geometry] */
  edges: [number, number, number, number, number[]][]
}

/** km/h per class id (0 motorway/trunk, 1 primary, 2 secondary, 3 tertiary/unclassified) */
const CLASS_KMH = [100, 80, 65, 50]
const SNAP_LEG_KMH = 30 // straight "last mile" from/to the graph

interface Adj {
  to: number
  timeH: number
  edge: number
  forward: boolean
}

let nodes: Float64Array | null = null
let adjacency: Adj[][] = []
let edges: RoadGraphData['edges'] = []
let grid = new Map<string, number[]>()
const GRID = 0.02 // ~2 km cells

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat / GRID)}:${Math.floor(lon / GRID)}`
}

export function loadRoadGraph(data: RoadGraphData) {
  nodes = Float64Array.from(data.nodes)
  edges = data.edges
  const n = nodes.length / 2
  adjacency = Array.from({ length: n }, () => [])
  data.edges.forEach(([a, b, lengthM, cls], i) => {
    const timeH = lengthM / 1000 / (CLASS_KMH[cls] ?? 50)
    adjacency[a]!.push({ to: b, timeH, edge: i, forward: true })
    adjacency[b]!.push({ to: a, timeH, edge: i, forward: false })
  })
  grid = new Map()
  for (let i = 0; i < n; i++) {
    const key = cellKey(nodes[i * 2]!, nodes[i * 2 + 1]!)
    const cell = grid.get(key)
    if (cell) cell.push(i)
    else grid.set(key, [i])
  }
}

export function isRoadGraphLoaded(): boolean {
  return nodes !== null
}

/** test/reset hook */
export function unloadRoadGraph() {
  nodes = null
  adjacency = []
  edges = []
  grid = new Map()
}

function nodePos(i: number): LatLon {
  return { lat: nodes![i * 2]!, lon: nodes![i * 2 + 1]! }
}

export function nearestNode(p: LatLon): number | null {
  if (!nodes) return null
  for (let ring = 0; ring <= 5; ring++) {
    let best = -1
    let bestD = Infinity
    const cLat = Math.floor(p.lat / GRID)
    const cLon = Math.floor(p.lon / GRID)
    for (let dLat = -ring; dLat <= ring; dLat++) {
      for (let dLon = -ring; dLon <= ring; dLon++) {
        if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== ring) continue
        const cell = grid.get(`${cLat + dLat}:${cLon + dLon}`)
        if (!cell) continue
        for (const i of cell) {
          const d = haversineKm(p, nodePos(i))
          if (d < bestD) {
            bestD = d
            best = i
          }
        }
      }
    }
    if (best >= 0) return best
  }
  return null
}

/** simple binary min-heap on f-score */
class Heap {
  private items: { node: number; f: number }[] = []
  push(node: number, f: number) {
    const a = this.items
    a.push({ node, f })
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p]!.f <= a[i]!.f) break
      ;[a[p], a[i]] = [a[i]!, a[p]!]
      i = p
    }
  }
  pop(): number | undefined {
    const a = this.items
    if (a.length === 0) return undefined
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l]!.f < a[m]!.f) m = l
        if (r < a.length && a[r]!.f < a[m]!.f) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i]!, a[m]!]
        i = m
      }
    }
    return top.node
  }
  get size() {
    return this.items.length
  }
}

export interface RoadRoute {
  /** total driving time in hours along the graph (class speeds, no SoSi) */
  timeH: number
  /** total length in km incl. snap legs */
  km: number
  /** full polyline from -> … -> to */
  path: LatLon[]
}

const MAX_KMH = Math.max(...CLASS_KMH)

/** A* route between two coordinates. Returns null when no graph/route. */
export function routeRoad(from: LatLon, to: LatLon): RoadRoute | null {
  if (!nodes) return null
  const start = nearestNode(from)
  const goal = nearestNode(to)
  if (start === null || goal === null) return null
  const goalPos = nodePos(goal)

  const gScore = new Map<number, number>()
  const cameFrom = new Map<number, { node: number; edge: number; forward: boolean }>()
  const heap = new Heap()
  gScore.set(start, 0)
  heap.push(start, 0)
  const visited = new Set<number>()

  while (heap.size) {
    const current = heap.pop()!
    if (current === goal) break
    if (visited.has(current)) continue
    visited.add(current)
    const g = gScore.get(current)!
    for (const adj of adjacency[current]!) {
      const tentative = g + adj.timeH
      if (tentative < (gScore.get(adj.to) ?? Infinity)) {
        gScore.set(adj.to, tentative)
        cameFrom.set(adj.to, { node: current, edge: adj.edge, forward: adj.forward })
        const h = haversineKm(nodePos(adj.to), goalPos) / MAX_KMH
        heap.push(adj.to, tentative + h)
      }
    }
  }
  if (!gScore.has(goal)) return null

  // rebuild path
  const segments: LatLon[][] = []
  let cur = goal
  while (cur !== start) {
    const step = cameFrom.get(cur)
    if (!step) break
    const [a, b, , , geom] = edges[step.edge]!
    const pts: LatLon[] = [nodePos(a)]
    for (let i = 0; i < geom.length; i += 2) pts.push({ lat: geom[i]!, lon: geom[i + 1]! })
    pts.push(nodePos(b))
    segments.push(step.forward ? pts : [...pts].reverse())
    cur = step.node
  }
  segments.reverse()
  const path: LatLon[] = [from, nodePos(start)]
  for (const seg of segments) for (let i = 1; i < seg.length; i++) path.push(seg[i]!)
  path.push(to)

  let km = 0
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1]!, path[i]!)
  const snapKm = haversineKm(from, nodePos(start)) + haversineKm(nodePos(goal), to)
  const timeH = gScore.get(goal)! + snapKm / SNAP_LEG_KMH
  return { timeH, km, path }
}
