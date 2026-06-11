/**
 * Salzburg status scheme (GAME_DATA §10, Insider — landesweit):
 * lifecycle 00 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 00, positions 88 → 08/09/10,
 * Sonderstatus 91–95 (placeholder digits, GAME_DATA §10b).
 */

export type StatusCode =
  | '00'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '88'
  | '08'
  | '09'
  | '10'
  | '91'
  | '92'
  | '93'
  | '94'
  | '95'

/** Off-duty pseudo-phase (vehicle outside its duty window — not a real status). */
export type VehiclePhase = StatusCode | 'AUS'

export const POSITION_CODES: StatusCode[] = ['08', '09', '10']

/** Statuses in which a vehicle counts as dispatchable (status.json `available`). */
export const AVAILABLE_STATUSES: ReadonlySet<StatusCode> = new Set([
  '00',
  '6',
  '7',
  '88',
  '08',
  '09',
  '10',
])

/**
 * Allowed transitions. Core lifecycle is exact per GAME_DATA §10; extras:
 *  - 3 → 6: no transport (Fehleinsatz/Storno/Behandlung vor Ort)
 *  - 6/7/88/positions → 1: direct follow-up assignment without returning home
 *  - 00 → 88: send to standby position; 88 → 08/09/10 on arrival
 *  - available → 91–95 Sonderstatus, back to 00
 */
const TRANSITIONS: Record<StatusCode, StatusCode[]> = {
  '00': ['1', '88', '91', '92', '93', '94', '95'],
  '1': ['2'],
  '2': ['3'],
  '3': ['4', '6'],
  '4': ['5'],
  '5': ['6'],
  '6': ['7', '1', '88'],
  '7': ['00', '1', '88'],
  '88': ['08', '09', '10', '1'],
  '08': ['1', '88', '91', '92', '93', '94'],
  '09': ['1', '88', '91', '92', '93', '94'],
  '10': ['1', '88', '91', '92', '93', '94'],
  '91': ['00'],
  '92': ['00'],
  '93': ['00'],
  '94': ['00'],
  '95': ['00'],
}

export function canTransition(from: StatusCode, to: StatusCode): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isAvailable(status: VehiclePhase): boolean {
  return status !== 'AUS' && AVAILABLE_STATUSES.has(status)
}

/** The exact happy-path order for reference and tests (GAME_DATA §10). */
export const LIFECYCLE_ORDER: StatusCode[] = ['00', '1', '2', '3', '4', '5', '6', '7', '00']
