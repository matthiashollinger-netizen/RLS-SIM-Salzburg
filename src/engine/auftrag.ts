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

/** ELS flow (Rework #8): Mittel werden erst ZUGETEILT, dann gemeinsam ALARMIERT. */
export type AssignedState = 'zugeteilt' | 'alarmiert' | 'vorort' | 'fertig'

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
  /** scoring (M8): scenario truth reference + care tracking */
  truthCategoryId?: string
  truthSeverity?: 'hoch' | 'normal'
  /** Telefonreanimation was instructed during the call */
  tcpr?: boolean
  /** first NA unit (NEF/NAW/Heli) arrival */
  naArrivedSec?: number
  /** chosen hospital was suitable (false ⇒ Fehldispo) */
  hospitalSuitable?: boolean
  outcome?: { survived: boolean; text: string; issues: string[]; quality: number }
  /** dispatcher notes (editable, Rework #10) */
  notiz?: string
  /** timestamped free-text infos like the real ELS Einsatzinfos (Rework 2) */
  infos?: { simSec: number; text: string }[]
  /** code was manually overridden — edits must not re-derive it */
  codeManuell?: boolean
  /** units currently allocated as patient transporters (Rework #6) */
  transporters?: string[]
  /** Lagefreigabe-Mechanik (Rework 2): simSec when POL will report the scene secure */
  lagePolizeiFreiAt?: number
  /** police reported the scene secure (radio message arrived) */
  lageGemeldet?: boolean
  /** dispatcher released the approach — units leave the Bereitstellungsraum */
  lageFreigegeben?: boolean
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
