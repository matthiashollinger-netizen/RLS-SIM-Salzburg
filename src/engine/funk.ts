import type { Auftrag } from './auftrag.ts'
import type { VehicleRuntime } from './vehicleSim.ts'

/**
 * Funkprotokoll Salzburg (GAME_DATA §10c — verbindlich):
 * Rufschema `[GERUFENER] von [RUFER]`, Antwort „kommen", Quittung „Verstanden".
 * Im Sprechfunk Kurzrufnamen ohne 5.-Präfix („20-322", nicht „5.20-322").
 */

export interface FunkLine {
  speaker: string
  text: string
}

export type FunkKind =
  | 'eintreffen'
  | 'lagemeldung'
  | 'nachforderung-na'
  | 'nachforderung-polizei'
  | 'sprechwunsch'
  | 'transport'
  | 'anfrage'
  | 'antwort'

/**
 * Interactive radio stages (Rework #4): the unit CALLS ('ruf'), the player
 * answers „kommen" → the message is spoken ('offen'), the player closes with
 * „Verstanden" ('quittiert'). Player-initiated calls start complete.
 */
export type FunkStage = 'ruf' | 'offen' | 'quittiert'

export interface FunkSpruch {
  id: number
  simSec: number
  kind: FunkKind
  vehicleId?: string
  auftragId?: string
  lines: FunkLine[]
  stage: FunkStage
  /** revealed when the player answers „kommen" */
  pendingMessage?: string
  /** suggested dispatcher action (available once the message is heard) */
  action?: { type: 'a4' | 'polizei'; auftragId: string }
}

export const LEITSTELLE = 'Leitstelle'

/** Vehicle calls the Leitstelle (GAME_DATA §10c example dialog). */
export function vehicleCallsLeitstelle(unitName: string, message: string): FunkLine[] {
  return [
    { speaker: unitName, text: `${LEITSTELLE} von ${unitName}` },
    { speaker: LEITSTELLE, text: 'kommen' },
    { speaker: unitName, text: message },
    { speaker: LEITSTELLE, text: 'Verstanden' },
  ]
}

/** Leitstelle calls a vehicle (active calling). */
export function leitstelleCallsVehicle(
  unitName: string,
  question: string,
  reply: string,
): FunkLine[] {
  return [
    { speaker: LEITSTELLE, text: `${unitName} von ${LEITSTELLE}` },
    { speaker: unitName, text: 'kommen' },
    { speaker: LEITSTELLE, text: question },
    { speaker: unitName, text: reply },
    { speaker: LEITSTELLE, text: 'Verstanden' },
  ]
}

// ---- status-driven crew reports (Tier-1 templates) ----

/** Erstmeldung of the FIRST unit on scene (later arrivals stay silent, Rework #5). */
export function eintreffMeldung(rt: VehicleRuntime): string {
  const variants = [
    'Sind als erstes Mittel am Einsatzort, verschaffen uns einen Überblick.',
    'Am Einsatzort eingetroffen — Erstmeldung folgt nach Sichtung.',
    'Status 3, Lage entspricht bisher der Meldung. Beginnen mit der Versorgung.',
  ]
  return variants[rt.id.length % variants.length]!
}

/**
 * NA-Nachforderung (GAME_DATA §10c Original: „Laufende CPR, benötigen NEF und RTW").
 * Trigger: severe incident, but no NA unit (NEF/NAW/Heli) assigned.
 */
export function needsNaNachforderung(auftrag: Auftrag, assignedTypes: string[]): boolean {
  if (auftrag.severity !== 'hoch') return false
  if (auftrag.code.startsWith('D') || auftrag.code.startsWith('E')) return false
  return !assignedTypes.some((t) => t === 'NEF' || t === 'NAW' || t === 'HELI')
}

export function naNachforderungText(auftrag: Auftrag): string {
  if (auftrag.categoryId === 'STILL') return 'Laufende CPR, benötigen dringend Notarzt!'
  return 'Patient kritisch — benötigen Notarzt nach, bitte A4 auslösen.'
}

/** Polizei-Nachforderung when the category needs POL but it was not alarmed. */
export function needsPolizeiNachforderung(auftrag: Auftrag, partnerSuggested: boolean): boolean {
  return partnerSuggested && !auftrag.partnersAlarmed.includes('POL')
}

export const POLIZEI_NACHFORDERUNG_TEXT = 'Benötigen Polizei an der Einsatzstelle, Lage unruhig.'

// ---- active calling: quick phrases ----

export type QuickPhraseId = 'status' | 'eintreffzeit' | 'abbruch' | 'na-abkoemmlich'

export const QUICK_PHRASES: { id: QuickPhraseId; label: string; question: string }[] = [
  { id: 'status', label: 'Status?', question: 'Frage: aktueller Status?' },
  { id: 'eintreffzeit', label: 'Eintreffzeit?', question: 'Frage: voraussichtliche Eintreffzeit?' },
  { id: 'abbruch', label: 'Abbruch', question: 'Einsatzabbruch — neuer Auftrag folgt.' },
  { id: 'na-abkoemmlich', label: 'NA abkömmlich?', question: 'Frage: ist der Notarzt abkömmlich?' },
]

export interface QuickReplyContext {
  rt: VehicleRuntime
  simSec: number
  statusLabel: string
  /** result of an attempted cancel (abbruch phrase) */
  cancelOk?: boolean
}

export function quickReply(id: QuickPhraseId, ctx: QuickReplyContext): string {
  const { rt, simSec } = ctx
  switch (id) {
    case 'status':
      return `Status ${rt.status === 'AUS' ? 'außer Dienst' : rt.status}${ctx.statusLabel ? ` — ${ctx.statusLabel}` : ''}.`
    case 'eintreffzeit': {
      if (rt.moveArrive !== undefined && rt.moveArrive > simSec) {
        const min = Math.max(1, Math.round((rt.moveArrive - simSec) / 60))
        return `Eintreffen in zirka ${min} Minute${min === 1 ? '' : 'n'}.`
      }
      if (rt.status === '3') return 'Sind bereits am Einsatzort.'
      if (rt.status === '1') return 'Rücken gerade aus.'
      return 'Stehen, kein Fahrziel.'
    }
    case 'abbruch':
      return ctx.cancelOk
        ? 'Verstanden, brechen ab und sind wieder frei.'
        : 'Negativ — Patient bereits an Bord, setzen Transport fort.'
    case 'na-abkoemmlich': {
      if (rt.unit.typ !== 'NEF' && rt.unit.typ !== 'NAW' && rt.unit.typ !== 'HELI')
        return 'Hier ist kein Notarzt an Bord.'
      // deterministic per vehicle+time bucket: roughly half are releasable
      const releasable = (rt.id.length + Math.floor(simSec / 600)) % 2 === 0
      return releasable
        ? 'NA ist abkömmlich, Patient ist versorgt.'
        : 'Negativ, NA wird hier noch benötigt.'
    }
  }
}

/** Sprechwunsch contents once acknowledged (status 5, GAME_DATA §12 Fenster 6). */
export function sprechwunschText(rt: VehicleRuntime): string {
  const variants = [
    `Übergabe verzögert sich, Notaufnahme ist voll. Stehen länger am Zielort.`,
    `Benötigen nach Übergabe kurz Zeit fürs Aufrüsten, dann wieder frei.`,
    `Bitte vormerken: Material muss nach diesem Einsatz ergänzt werden.`,
  ]
  return variants[(rt.id.charCodeAt(rt.id.length - 1) ?? 0) % variants.length]!
}
