import { balancing, codeByCode } from '../data/index.ts'
import type { Partner } from '../data/schemas.ts'
import type { LatLon } from './geo.ts'

/** Einsatzauftrag (GAME_DATA §4 ELS-Maske: Klasse+Ziffer+Kategorie+Ort+Merkmalskette). */

export interface AuftragOrt extends LatLon {
  /** Stadtteil/Gemeinde for the Alarmtext */
  stadtteil: string
  strasse: string
}

export type AuftragState = 'offen' | 'disponiert' | 'laufend' | 'abgeschlossen'

export type AssignedState = 'alarmiert' | 'vorort' | 'fertig'

export interface Auftrag {
  id: string
  createdAt: number
  code: string
  categoryId: string
  severity: 'hoch' | 'normal'
  personen: number
  ort: AuftragOrt
  merkmalskette: string[]
  sosi: boolean
  /** simSec deadline (created + 15 min) when the Hilfsfrist applies (GAME_DATA §11) */
  hilfsfristDeadline?: number
  firstArrivalSec?: number
  partnersAlarmed: Partner[]
  lagefreigabe: boolean
  hospitalId?: string
  /** vehicleId → progress */
  assigned: Record<string, AssignedState>
  state: AuftragState
  uebung: boolean
}

/** Alarmtext format `CODE STADTTEIL STRASSE` — exactly as on pager/terminal (GAME_DATA §3a). */
export function alarmtext(a: Pick<Auftrag, 'code' | 'ort'>): string {
  return `${a.code} ${a.ort.stadtteil} ${a.ort.strasse}`
}

/** Hilfsfrist applies to emergency responses: class A, B with SoSi, MANV (GAME_DATA §11). */
export function hilfsfristApplies(code: string): boolean {
  const def = codeByCode.get(code)
  if (!def) return false
  if (def.class === 'A' || def.class === 'MANV') return true
  return def.class === 'B' && def.sosi
}

export function hilfsfristDeadline(code: string, createdAt: number): number | undefined {
  return hilfsfristApplies(code) ? createdAt + balancing.hilfsfristMin * 60 : undefined
}
