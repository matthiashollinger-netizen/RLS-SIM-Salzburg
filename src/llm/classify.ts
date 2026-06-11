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
