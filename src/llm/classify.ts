/**
 * Map free-text calltaker questions to the structured question catalog so the
 * interview scoring works for typed questions too (Tier 1 fallback + Tier 2
 * answer capture).
 */

const PATTERNS: [RegExp, string][] = [
  [/beruhig|ganz ruhig|ruhig bleiben|atmen sie (mal )?durch/i, 'beruhigen'],
  [/wo (genau|ist|sind|befind)|adresse|stra(ß|ss)e|notfallort|hausnummer|ort\b/i, 'ort'],
  [/was\b.*(passiert|los|geschehen)|erz(ä|ae)hlen sie/i, 'geschehen'],
  [/wie viele|personen|betroffen|verletzte/i, 'personen'],
  [/ansprechbar|bei bewusstsein|reagiert|wach\b/i, 'bewusstsein'],
  [/atmet|atmung|luft (bekommt|kriegt)/i, 'atmung'],
  [/wie alt|alter\b|jahre alt/i, 'alter'],
  [/zug(ä|ae)nglich|t(ü|ue)r|zugang|kommen wir.*(hin|rein)|aufsperren/i, 'zugang'],
  [/r(ü|ue)ckruf|erreichbar|telefonnummer|nummer\b/i, 'rueckruf'],
]

export function classifyFreeText(text: string): string | null {
  for (const [re, id] of PATTERNS) {
    if (re.test(text)) return id
  }
  return null
}

function significantWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-zäöüß ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['eine', 'einer', 'sind', 'wird', 'noch', 'sich'].includes(w)),
  )
}

/**
 * Match free text against the category-specific detail questions of the chosen
 * Hauptbeschwerde (Rework #9) — typed follow-ups like „Ist wer eingeklemmt?"
 * resolve to detail1/detail2 and get a truth-based answer.
 */
export function classifyWithDetails(
  text: string,
  detailFragen?: [string, string],
): string | null {
  const base = classifyFreeText(text)
  if (base) return base
  if (!detailFragen) return null
  const words = significantWords(text)
  let best: { id: string; score: number } | null = null
  detailFragen.forEach((frage, i) => {
    const overlap = [...significantWords(frage)].filter((w) => words.has(w)).length
    if (overlap >= 1 && (!best || overlap > best.score)) {
      best = { id: i === 0 ? 'detail1' : 'detail2', score: overlap }
    }
  })
  return best ? (best as { id: string }).id : null
}
