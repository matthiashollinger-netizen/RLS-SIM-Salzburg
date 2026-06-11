import { places } from '../data/index.ts'
import type { Place } from '../data/schemas.ts'

/** Lightweight fuzzy address search over the Orts-Index (places.json). */

export interface AddressHit {
  place: Place
  strasse: string
  score: number
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = normalize(haystack)
  const n = normalize(needle)
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(n)) return 60
  // token overlap
  const hTokens = new Set(h.split(' '))
  const nTokens = n.split(' ')
  const hits = nTokens.filter((t) => t.length > 2 && [...hTokens].some((ht) => ht.startsWith(t)))
  return hits.length > 0 ? 30 + hits.length * 10 : 0
}

/** Search streets and place names; query like "lehen ignaz" or "getreidegasse". */
export function searchAddress(query: string, region?: 'NORD' | 'SUED', limit = 8): AddressHit[] {
  const q = query.trim()
  if (q.length < 2) return []
  const hits: AddressHit[] = []
  for (const place of places) {
    if (region && place.region !== region) continue
    const placeScore = scoreMatch(place.name, q)
    for (const strasse of place.strassen) {
      const sScore = scoreMatch(strasse, q)
      const comboScore = scoreMatch(`${place.name} ${strasse}`, q)
      const score = Math.max(sScore, comboScore, placeScore * 0.6)
      if (score >= 30) hits.push({ place, strasse, score })
    }
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}
