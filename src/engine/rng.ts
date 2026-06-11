/** Deterministic, seedable PRNG (mulberry32) — engine logic must be testable. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function pickWeighted<T>(rng: Rng, items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item.value
  }
  return items[items.length - 1]!.value
}
