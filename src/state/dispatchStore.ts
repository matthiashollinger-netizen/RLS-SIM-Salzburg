import { create } from 'zustand'
import { categoryById, codeByCode, hospitalById } from '../data/index.ts'
import type { Partner } from '../data/schemas.ts'
import {
  alarmtext,
  hilfsfristDeadline,
  type Auftrag,
  type AuftragOrt,
} from '../engine/auftrag.ts'
import { deriveCode, hospitalNeedsFor, type Severity } from '../engine/ao.ts'
import { bestHospital } from '../engine/hospitalMatch.ts'
import type { VehicleEvent } from '../engine/vehicleSim.ts'
import { vehicleSim } from './simulation.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'
import { unitDisplayName } from '../lib/format.ts'

let nextAuftragNr = 1

export interface CreateAuftragInput {
  categoryId: string
  severity?: Severity
  personen?: number
  ort: AuftragOrt
  merkmalskette?: string[]
  code?: string
  uebung?: boolean
}

interface DispatchState {
  auftraege: Record<string, Auftrag>
  order: string[]
  selectedId: string | null
  select: (id: string | null) => void
  createAuftrag: (input: CreateAuftragInput) => string
  overrideCode: (id: string, code: string) => void
  assignVehicle: (id: string, vehicleId: string) => boolean
  cancelVehicle: (id: string, vehicleId: string) => void
  setHospital: (id: string, hospitalId: string) => void
  togglePartner: (id: string, partner: Partner) => void
  closeAuftrag: (id: string) => void
  handleVehicleEvent: (e: VehicleEvent) => void
}

function log(kind: 'einsatz' | 'system', text: string, auftragId?: string) {
  useEventLog.getState().append({
    simSec: useGameStore.getState().simSec,
    kind,
    text,
    auftragId,
  })
}

export const useDispatchStore = create<DispatchState>((set, get) => ({
  auftraege: {},
  order: [],
  selectedId: null,

  select: (id) => set({ selectedId: id }),

  createAuftrag: (input) => {
    const simSec = useGameStore.getState().simSec
    const severity = input.severity ?? 'hoch'
    const personen = input.personen ?? 1
    const category = categoryById.get(input.categoryId)
    if (!category) throw new Error(`unknown category ${input.categoryId}`)
    const code = input.code ?? deriveCode(input.categoryId, { personen, severity })
    const def = codeByCode.get(code)
    const id = `E-${String(nextAuftragNr++).padStart(4, '0')}`
    const auftrag: Auftrag = {
      id,
      createdAt: simSec,
      code,
      categoryId: input.categoryId,
      severity,
      personen,
      ort: input.ort,
      merkmalskette: input.merkmalskette ?? [],
      sosi: def?.sosi ?? false,
      hilfsfristDeadline: hilfsfristDeadline(code, simSec),
      partnersAlarmed: [],
      lagefreigabe: category.lagefreigabe,
      assigned: {},
      state: 'offen',
      uebung: input.uebung ?? false,
    }
    set((s) => ({
      auftraege: { ...s.auftraege, [id]: auftrag },
      order: [id, ...s.order],
      selectedId: id,
    }))
    log('einsatz', `Neuer Auftrag ${id}: ${alarmtext(auftrag)}`, id)
    return id
  },

  overrideCode: (id, code) =>
    set((s) => {
      const a = s.auftraege[id]
      const def = codeByCode.get(code)
      if (!a || !def) return s
      const updated: Auftrag = {
        ...a,
        code,
        sosi: def.sosi,
        hilfsfristDeadline: hilfsfristDeadline(code, a.createdAt),
      }
      log('einsatz', `${id}: Code übersteuert → ${code}`, id)
      return { auftraege: { ...s.auftraege, [id]: updated } }
    }),

  assignVehicle: (id, vehicleId) => {
    const a = get().auftraege[id]
    const rt = vehicleSim.get(vehicleId)
    if (!a || !rt) return false
    const simSec = useGameStore.getState().simSec
    // transport units bring the patient to hospital; NA/EL units stay support
    const isTransport = ['RTW', 'ITW', 'KTW', 'GKTW', 'BTW', 'NAW', 'HELI'].includes(rt.unit.typ)
    const needs = hospitalNeedsFor(a.categoryId, a.severity)
    const hospital = a.hospitalId
      ? hospitalById.get(a.hospitalId)
      : bestHospital(needs, a.ort, a.sosi)?.hospital
    const ok = vehicleSim.dispatch(
      vehicleId,
      {
        id: a.id,
        label: alarmtext(a),
        einsatzort: { lat: a.ort.lat, lon: a.ort.lon },
        sosi: a.sosi,
        transport: isTransport && !!hospital,
        zielort: hospital ? { lat: hospital.lat, lon: hospital.lon } : undefined,
        zielName: hospital?.short,
      },
      simSec,
    )
    if (!ok) return false
    set((s) => {
      const cur = s.auftraege[id]!
      return {
        auftraege: {
          ...s.auftraege,
          [id]: {
            ...cur,
            assigned: { ...cur.assigned, [vehicleId]: 'alarmiert' },
            state: cur.state === 'offen' ? 'disponiert' : cur.state,
          },
        },
      }
    })
    log('einsatz', `${id}: ${unitDisplayName(rt.unit)} alarmiert`, id)
    return true
  },

  cancelVehicle: (id, vehicleId) => {
    const simSec = useGameStore.getState().simSec
    if (vehicleSim.cancelAssignment(vehicleId, simSec)) {
      set((s) => {
        const a = s.auftraege[id]
        if (!a) return s
        const assigned = { ...a.assigned }
        delete assigned[vehicleId]
        return { auftraege: { ...s.auftraege, [id]: { ...a, assigned } } }
      })
      log('einsatz', `${id}: Einsatzabbruch für ${vehicleId}`, id)
    }
  },

  setHospital: (id, hospitalId) => {
    const hospital = hospitalById.get(hospitalId)
    const a = get().auftraege[id]
    if (!hospital || !a) return
    set((s) => ({
      auftraege: { ...s.auftraege, [id]: { ...s.auftraege[id]!, hospitalId } },
    }))
    // re-target running transports
    for (const vehicleId of Object.keys(a.assigned)) {
      vehicleSim.updateAssignmentTarget(
        vehicleId,
        { lat: hospital.lat, lon: hospital.lon },
        hospital.short,
      )
    }
    log('einsatz', `${id}: Zielklinik ${hospital.short}`, id)
  },

  togglePartner: (id, partner) =>
    set((s) => {
      const a = s.auftraege[id]
      if (!a) return s
      const has = a.partnersAlarmed.includes(partner)
      const partnersAlarmed = has
        ? a.partnersAlarmed.filter((p) => p !== partner)
        : [...a.partnersAlarmed, partner]
      log('einsatz', `${id}: ${partner} ${has ? 'storniert' : 'alarmiert'}`, id)
      return { auftraege: { ...s.auftraege, [id]: { ...a, partnersAlarmed } } }
    }),

  closeAuftrag: (id) =>
    set((s) => {
      const a = s.auftraege[id]
      if (!a) return s
      log('einsatz', `${id}: abgeschlossen`, id)
      return {
        auftraege: { ...s.auftraege, [id]: { ...a, state: 'abgeschlossen' } },
        selectedId: s.selectedId === id ? null : s.selectedId,
      }
    }),

  handleVehicleEvent: (e) => {
    if (e.type !== 'status' || !e.assignmentId) return
    const a = get().auftraege[e.assignmentId]
    if (!a || a.assigned[e.vehicleId] === undefined) return
    if (e.to === '3') {
      set((s) => {
        const cur = s.auftraege[a.id]!
        return {
          auftraege: {
            ...s.auftraege,
            [a.id]: {
              ...cur,
              assigned: { ...cur.assigned, [e.vehicleId]: 'vorort' },
              firstArrivalSec: cur.firstArrivalSec ?? e.simSec,
              state: 'laufend',
            },
          },
        }
      })
    } else if (e.to === '6') {
      set((s) => {
        const cur = s.auftraege[a.id]!
        const assigned: Auftrag['assigned'] = { ...cur.assigned, [e.vehicleId]: 'fertig' }
        const allDone = Object.values(assigned).every((v) => v === 'fertig')
        return {
          auftraege: {
            ...s.auftraege,
            [a.id]: {
              ...cur,
              assigned,
              state: allDone && cur.state !== 'offen' ? 'abgeschlossen' : cur.state,
            },
          },
        }
      })
    }
  },
}))

// React to vehicle status changes (assignment progress)
vehicleSim.addEventListener((e) => useDispatchStore.getState().handleVehicleEvent(e))
