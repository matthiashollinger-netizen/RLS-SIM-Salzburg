import { z } from 'zod'
import { HAUPTBESCHWERDEN } from './abfrage.ts'

/**
 * Szenario-Editor (M10): user-built exercise scenarios, saved/loaded/shared as
 * JSON files. Exercises run as ÜBUNG (GAME_DATA §4 D/E list).
 */

export const editorEinsatzSchema = z.object({
  /** seconds after exercise start when the call comes in */
  atSec: z.number().int().nonnegative(),
  hauptbeschwerdeId: z.string(),
  severity: z.enum(['hoch', 'normal']).default('hoch'),
  personen: z.number().int().positive().default(1),
  placeId: z.string(),
  strasse: z.string(),
  /** optional custom caller opening line */
  lageText: z.string().optional(),
  emotion: z.enum(['ruhig', 'aufgeregt', 'panisch', 'betrunken']).default('aufgeregt'),
  rolle: z
    .enum(['selbst', 'angehoeriger', 'passant', 'fachpersonal', 'kind'])
    .default('angehoeriger'),
  phone: z.enum(['handy', 'festnetz']).default('festnetz'),
})
export type EditorEinsatz = z.infer<typeof editorEinsatzSchema>

export const editorScenarioSchema = z.object({
  /** file format version for forward compatibility */
  version: z.literal(1).default(1),
  name: z.string().min(1),
  region: z.enum(['NORD', 'SUED']).default('NORD'),
  einsaetze: z.array(editorEinsatzSchema).min(1),
})
export type EditorScenario = z.infer<typeof editorScenarioSchema>

export function validHauptbeschwerde(id: string): boolean {
  return HAUPTBESCHWERDEN.some((h) => h.id === id)
}

export function serializeScenario(s: EditorScenario): string {
  return JSON.stringify(s, null, 2)
}

export function parseScenario(json: string): EditorScenario {
  const parsed = editorScenarioSchema.parse(JSON.parse(json))
  for (const e of parsed.einsaetze) {
    if (!validHauptbeschwerde(e.hauptbeschwerdeId)) {
      throw new Error(`Unbekannte Hauptbeschwerde: ${e.hauptbeschwerdeId}`)
    }
  }
  return parsed
}
