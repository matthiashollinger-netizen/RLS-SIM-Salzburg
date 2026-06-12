import { create } from 'zustand'
import { hospitals } from '../data/index.ts'
import { emergencyCapacity, freeSlots, OCCUPY_SEC } from '../engine/hospitalLoad.ts'
import { vehicleSim } from './simulation.ts'

/**
 * Live Notaufnahme-Belegung (Award-Polish „Kapazitätsnachweis"): every patient
 * delivered (unit reaches status 5 with a transport assignment) occupies a
 * slot at the target hospital. The dispatcher sees free slots per hospital
 * when choosing the Zielklinik — „nächstes ≠ richtiges ≠ freies".
 */

const hospitalByShort = new Map(hospitals.map((h) => [h.short, h]))

interface HospitalLoadState {
  /** hospitalId → simSec timestamps until which a slot stays occupied */
  occupied: Record<string, number[]>
  reset: () => void
  admit: (hospitalId: string, simSec: number) => void
}

export const useHospitalLoad = create<HospitalLoadState>((set) => ({
  occupied: {},

  reset: () => set({ occupied: {} }),

  admit: (hospitalId, simSec) =>
    set((s) => {
      const cur = (s.occupied[hospitalId] ?? []).filter((until) => until > simSec)
      return { occupied: { ...s.occupied, [hospitalId]: [...cur, simSec + OCCUPY_SEC] } }
    }),
}))

/** free emergency slots of a hospital right now */
export function hospitalFreeSlots(hospitalId: string, simSec: number): number {
  const h = hospitals.find((x) => x.id === hospitalId)
  if (!h) return 0
  return freeSlots(emergencyCapacity(h), useHospitalLoad.getState().occupied[hospitalId] ?? [], simSec)
}

// a transport unit arriving at the Zielort (status 5) admits its patient
vehicleSim.addEventListener((e) => {
  if (e.type !== 'status' || e.to !== '5') return
  const rt = vehicleSim.get(e.vehicleId)
  const zielName = rt?.assignment?.zielName
  if (!rt?.assignment?.transport || !zielName) return
  const hospital = hospitalByShort.get(zielName)
  if (!hospital) return
  const wasFree = hospitalFreeSlots(hospital.id, e.simSec) > 0
  useHospitalLoad.getState().admit(hospital.id, e.simSec)
  if (!wasFree && e.assignmentId) {
    // overloaded Notaufnahme: the crew reports the delayed handover
    void import('./dispatchStore.ts').then(({ useDispatchStore }) =>
      useDispatchStore
        .getState()
        .addInfo(e.assignmentId!, `Notaufnahme ${zielName} überlastet — Übergabe verzögert sich`),
    )
  }
})
