/**
 * One-time build-time road graph export (CLAUDE.md §2 allows OSM exports at
 * build time — never a live API at runtime). Downloads the major road network
 * of Land Salzburg (+ margin) from Overpass, collapses it into an
 * intersection graph with simplified edge geometry and writes
 * public/roads-sbg.json for the in-game A* router.
 *
 * Usage: npx tsx scripts/build-roads.mts
 */
import { writeFileSync } from 'node:fs'

const BBOX = '46.90,12.05,48.08,14.05' // south,west,north,east — Land Salzburg + margin
const CLASSES = 'motorway|trunk|primary|secondary|tertiary|unclassified'
const QUERY = `
[out:json][timeout:300];
way["highway"~"^(${CLASSES})(_link)?$"](${BBOX});
out geom;
`

interface OverpassWay {
  type: 'way'
  id: number
  nodes: number[]
  geometry: { lat: number; lon: number }[]
  tags: { highway: string }
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Douglas-Peucker simplification (epsilon in meters, approximated). */
function simplify(pts: { lat: number; lon: number }[], epsM: number): { lat: number; lon: number }[] {
  if (pts.length <= 2) return pts
  const sqDist = (p: { lat: number; lon: number }, a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    // planar approx in meters
    const mPerLat = 111320
    const mPerLon = 111320 * Math.cos((a.lat * Math.PI) / 180)
    const ax = a.lon * mPerLon, ay = a.lat * mPerLat
    const bx = b.lon * mPerLon, by = b.lat * mPerLat
    const px = p.lon * mPerLon, py = p.lat * mPerLat
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const cx = ax + t * dx, cy = ay + t * dy
    return (px - cx) ** 2 + (py - cy) ** 2
  }
  const keep = new Array(pts.length).fill(false)
  keep[0] = keep[pts.length - 1] = true
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = 0
    let maxI = -1
    for (let i = s + 1; i < e; i++) {
      const d = sqDist(pts[i]!, pts[s]!, pts[e]!)
      if (d > maxD) {
        maxD = d
        maxI = i
      }
    }
    if (maxD > epsM * epsM && maxI > 0) {
      keep[maxI] = true
      stack.push([s, maxI], [maxI, e])
    }
  }
  return pts.filter((_, i) => keep[i])
}

console.error('Querying Overpass…')
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: `data=${encodeURIComponent(QUERY)}`,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'RLS-SIM-Salzburg build-time road graph export (one-shot)',
  },
})
if (!res.ok) {
  console.error(`Overpass failed: ${res.status}`)
  process.exit(1)
}
const data = (await res.json()) as { elements: OverpassWay[] }
const ways = data.elements.filter((e) => e.type === 'way' && e.geometry?.length > 1)
console.error(`ways: ${ways.length}`)

// intersection nodes = OSM node ids referenced by >1 way, plus way endpoints
const usage = new Map<number, number>()
for (const w of ways) for (const n of w.nodes) usage.set(n, (usage.get(n) ?? 0) + 1)

type ClassId = 0 | 1 | 2 | 3 // 0=motorway/trunk 1=primary 2=secondary 3=tertiary/unclassified
function classOf(hw: string): ClassId {
  if (hw.startsWith('motorway') || hw.startsWith('trunk')) return 0
  if (hw.startsWith('primary')) return 1
  if (hw.startsWith('secondary')) return 2
  return 3
}

const nodeIndex = new Map<number, number>() // osm id → packed index
const nodeCoords: number[] = [] // lat,lon pairs (5 decimals)
function packNode(osmId: number, lat: number, lon: number): number {
  let idx = nodeIndex.get(osmId)
  if (idx === undefined) {
    idx = nodeCoords.length / 2
    nodeIndex.set(osmId, idx)
    nodeCoords.push(Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5)
  }
  return idx
}

// edges: [a, b, lengthM, class, geometry (deltas, only intermediate points)]
const edges: [number, number, number, number, number[]][] = []
for (const w of ways) {
  const cls = classOf(w.tags.highway)
  let segStart = 0
  for (let i = 1; i < w.nodes.length; i++) {
    const isCut = i === w.nodes.length - 1 || (usage.get(w.nodes[i]!) ?? 0) > 1
    if (!isCut) continue
    const slice = w.geometry.slice(segStart, i + 1)
    let lengthM = 0
    for (let j = 1; j < slice.length; j++) lengthM += haversineM(slice[j - 1]!, slice[j]!)
    if (lengthM >= 1) {
      const a = packNode(w.nodes[segStart]!, slice[0]!.lat, slice[0]!.lon)
      const b = packNode(w.nodes[i]!, slice[slice.length - 1]!.lat, slice[slice.length - 1]!.lon)
      const mid = simplify(slice, 25).slice(1, -1)
      const geom: number[] = []
      for (const p of mid) geom.push(Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5)
      edges.push([a, b, Math.round(lengthM), cls, geom])
    }
    segStart = i
  }
}

const out = { v: 1, nodes: nodeCoords, edges }
writeFileSync('public/roads-sbg.json', JSON.stringify(out))
console.error(
  `nodes: ${nodeCoords.length / 2}, edges: ${edges.length}, size: ${(JSON.stringify(out).length / 1e6).toFixed(1)} MB`,
)
