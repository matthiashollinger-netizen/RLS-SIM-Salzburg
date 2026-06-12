/**
 * Transport allocation (Rework #6): exactly ONE transport unit per patient.
 * When a helicopter and an RTW are both on scene, the helicopter takes the
 * patient (alpine reality); the RTW stays support. Extra units assist.
 */

export interface TransportUnit {
  id: string
  typ: string
  notfallKtw?: boolean
}

const TRANSPORT_CAPABLE = new Set(['RTW', 'ITW', 'KTW', 'GKTW', 'BTW', 'NAW', 'HELI'])

export function isTransportCapable(typ: string): boolean {
  return TRANSPORT_CAPABLE.has(typ)
}

/** Lower = takes the patient first. */
function priority(u: TransportUnit): number {
  switch (u.typ) {
    case 'HELI':
      return 0
    case 'ITW':
      return 1
    case 'NAW':
      return 2
    case 'RTW':
      return 3
    case 'KTW':
      return u.notfallKtw ? 4 : 5
    case 'GKTW':
      return 6
    case 'BTW':
      return 7
    default:
      return 99
  }
}

/**
 * Pick which assigned units transport: at most `personen` transporters,
 * ordered by capability priority (stable for equal priority).
 */
export function allocateTransports(units: TransportUnit[], personen: number): Set<string> {
  const capable = units
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => isTransportCapable(u.typ))
    .sort((a, b) => priority(a.u) - priority(b.u) || a.i - b.i)
  return new Set(capable.slice(0, Math.max(1, personen)).map(({ u }) => u.id))
}
