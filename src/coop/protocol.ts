import type { Auftrag } from '../engine/auftrag.ts'
import type { FunkSpruch } from '../engine/funk.ts'
import type { ShiftReport } from '../engine/scoring.ts'
import type { ActiveCall } from '../state/callStore.ts'
import type { LogEntry } from '../state/eventLog.ts'
import type { PlayerRole, Weather, GameSpeed } from '../state/gameStore.ts'
import type { VehiclePhase } from '../engine/status.ts'

/** Coop wire protocol (M9) — host-authoritative (ARCHITECTURE.md). */

export interface VehicleSnapshot {
  id: string
  status: VehiclePhase
  lat: number
  lon: number
}

export interface SyncPayload {
  simSec: number
  speed: GameSpeed
  running: boolean
  weather: Weather
  auftraege: Record<string, Auftrag>
  order: string[]
  vehicles: VehicleSnapshot[]
  queue: ActiveCall[]
  active: ActiveCall | null
  callStats: { angenommen: number; aufgelegt: number; auftraege: number; zugeordnet: number }
  sprueche: FunkSpruch[]
  logEntries: LogEntry[]
}

/** Whitelisted guest→host actions per store. */
export interface ActionMessage {
  t: 'action'
  store: 'call' | 'dispatch' | 'funk' | 'game'
  method: string
  args: unknown[]
}

export type CoopMessage =
  | { t: 'join' }
  | {
      t: 'welcome'
      guestRole: PlayerRole
      config: { region: string; month: number; startWeekday: number }
    }
  | ({ t: 'sync' } & { payload: SyncPayload })
  | ActionMessage
  | { t: 'report'; report: ShiftReport }

export const ALLOWED_ACTIONS: Record<ActionMessage['store'], string[]> = {
  call: [
    'answer',
    'hangup',
    'ask',
    'askFreeText',
    'chooseHauptbeschwerde',
    'setAnswer',
    'setAdresse',
    'requestOrtungsSms',
    'requestNetzbetreiber',
    'createAuftrag',
    'assignToExisting',
  ],
  dispatch: [
    'createAuftrag',
    'overrideCode',
    'assignVehicle',
    'cancelVehicle',
    'setHospital',
    'togglePartner',
    'closeAuftrag',
  ],
  funk: ['callVehicle', 'callVehicleFreeText', 'quittieren', 'executeAction'],
  game: ['setSpeed', 'setWeather'],
}
