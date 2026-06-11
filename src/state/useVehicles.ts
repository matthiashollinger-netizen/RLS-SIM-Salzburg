import { useSyncExternalStore } from 'react'
import { vehicleSim } from './simulation.ts'

/** Re-render when vehicle statuses change (not on every movement frame). */
export function useVehicleVersion(): number {
  return useSyncExternalStore(
    (cb) => vehicleSim.subscribe(cb),
    () => vehicleSim.version,
  )
}
