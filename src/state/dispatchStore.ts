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
import { findUnits } from '../engine/dispatchSearch.ts'
import { bestHospital, matchHospitals } from '../engine/hospitalMatch.ts'
import { computeOutcome } from '../engine/outcome.ts'
import { isAvailable } from '../engine/status.ts'
import { allocateTransports } from '../engine/transport.ts'
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
  truthCategoryId?: string
  truthSeverity?: Severity
  tcpr?: boolean
}

export interface AuftragPatch {
  categoryId?: string
  severity?: Severity
  personen?: number
  ort?: AuftragOrt
  notiz?: string
}

interface DispatchState {
  auftraege: Record<string, Auftrag>
  order: string[]
  selectedId: string | null
  reset: () => void
  select: (id: string | null) => void
  createAuftrag: (input: CreateAuftragInput) => string
  overrideCode: (id: string, code: string) => void
  /** Stufe 1: Mittel zuteilen (ELS-Flow) */
  assignVehicle: (id: string, vehicleId: string) => boolean
  removeStagedVehicle: (id: string, vehicleId: string) => void
  /** Stufe 2: alle zugeteilten Mittel alarmieren */
  alarmieren: (id: string) => boolean
  updateAuftrag: (id: string, patch: AuftragPatch) => void
  /** timestamped Einsatzinfo (Rework 2) */
  addInfo: (id: string, text: string) => void
  /** Umdisponieren: pull a unit from its current Auftrag to another (Rework 2) */
  redirectVehicle: (vehicleId: string, toAuftragId: string) => boolean
  cancelVehicle: (id: string, vehicleId: string) => void
  setHospital: (id: string, hospitalId: string) => void
  togglePartner: (id: string, partner: Partner) => void
  /** dispatcher releases the approach after POL secured the scene (Rework 2) */
  freigabeLage: (id: string) => void
  /** sim-clock driven checks (police Lagefreigabe report) */
  tick: (simSec: number) => void
  closeAuftrag: (id: string) => void
  handleVehicleEvent: (e: VehicleEvent) => void
}

/** Police needs ~4 min from alarm to secure the scene (ANNAHMEN.md, estimated). */
const POLIZEI_SICHERUNG_SEC = 240

/** Staging point ≈500 m north of the scene — units wait here until released. */
function bereitstellungsraum(ort: { lat: number; lon: number }) {
  return { lat: ort.lat + 0.0045, lon: ort.lon }
}

function log(kind: 'einsatz' | 'system', text: string, auftragId?: string) {
  useEventLog.getState().append({
    simSec: useGameStore.getState().simSec,
    kind,
    text,
    auftragId,
  })
}

/** Outcome + harsh debriefing on completion (GAME_MECHANICS decision #3/#8, M8). */
function finalize(a: Auftrag): Auftrag {
  if (a.outcome || a.uebung) return a
  const isEmergency = !a.code.startsWith('D') && !a.code.startsWith('E')
  if (!isEmergency) return a
  const naRequired = a.severity === 'hoch'
  const hospitalSuitable = a.hospitalSuitable ?? true
  const outcome = computeOutcome({
    auftragId: a.id,
    categoryId: a.categoryId,
    severity: a.severity,
    createdAt: a.createdAt,
    firstArrivalSec: a.firstArrivalSec,
    naArrivalSec: a.naArrivedSec,
    tcpr: a.tcpr,
    hospitalSuitable,
    naRequired,
  })
  // debriefing messages — hard and concrete (CLAUDE.md M8)
  if (a.hilfsfristDeadline !== undefined) {
    if (a.firstArrivalSec === undefined) {
      log('system', `Debriefing ${a.id}: Es ist NIE ein Rettungsmittel eingetroffen.`, a.id)
    } else if (a.firstArrivalSec > a.hilfsfristDeadline) {
      const overMin = Math.round((a.firstArrivalSec - a.hilfsfristDeadline) / 60)
      log('system', `Debriefing ${a.id}: Hilfsfrist um ${overMin} min überschritten.`, a.id)
    }
  }
  for (const issue of outcome.issues) {
    log('system', `Debriefing ${a.id}: ${issue}`, a.id)
  }
  log('system', `${a.id}: ${outcome.text}`, a.id)
  return { ...a, outcome, hospitalSuitable }
}

export const useDispatchStore = create<DispatchState>((set, get) => ({
  auftraege: {},
  order: [],
  selectedId: null,

  reset: () => set({ auftraege: {}, order: [], selectedId: null }),

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
      truthCategoryId: input.truthCategoryId,
      truthSeverity: input.truthSeverity,
      tcpr: input.tcpr,
    }
    set((s) => ({
      auftraege: { ...s.auftraege, [id]: auftrag },
      order: [id, ...s.order],
      selectedId: id,
    }))
    log('einsatz', `Neuer Auftrag ${id}: ${alarmtext(auftrag)}`, id)
    // Ort bekannt → sofort auf der Karte zeigen (Rework #7)
    void import('./mapStore.ts').then(({ useMapStore }) =>
      useMapStore.getState().focusOn(auftrag.ort.lat, auftrag.ort.lon, 12.5),
    )
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
        codeManuell: true,
        sosi: def.sosi,
        hilfsfristDeadline: hilfsfristDeadline(code, a.createdAt),
      }
      log('einsatz', `${id}: Code übersteuert → ${code}`, id)
      return { auftraege: { ...s.auftraege, [id]: updated } }
    }),

  // Stufe 1 (ELS-Flow, Rework #8): Mittel dem Auftrag ZUTEILEN — noch keine Alarmierung
  assignVehicle: (id, vehicleId) => {
    const a = get().auftraege[id]
    const rt = vehicleSim.get(vehicleId)
    if (!a || !rt || a.assigned[vehicleId]) return false
    if (!isAvailable(rt.status)) return false
    set((s) => {
      const cur = s.auftraege[id]!
      return {
        auftraege: {
          ...s.auftraege,
          [id]: { ...cur, assigned: { ...cur.assigned, [vehicleId]: 'zugeteilt' } },
        },
      }
    })
    log('einsatz', `${id}: ${unitDisplayName(rt.unit)} zugeteilt`, id)
    return true
  },

  /** Remove a staged (not yet alarmed) unit. */
  removeStagedVehicle: (id, vehicleId) =>
    set((s) => {
      const a = s.auftraege[id]
      if (!a || a.assigned[vehicleId] !== 'zugeteilt') return s
      const assigned = { ...a.assigned }
      delete assigned[vehicleId]
      return { auftraege: { ...s.auftraege, [id]: { ...a, assigned } } }
    }),

  // Stufe 2: ALARMIEREN — alle zugeteilten Mittel gleichzeitig (Pager-Gong)
  alarmieren: (id) => {
    const a = get().auftraege[id]
    if (!a) return false
    const staged = Object.entries(a.assigned)
      .filter(([, st]) => st === 'zugeteilt')
      .map(([vid]) => vid)
    if (staged.length === 0) return false
    const simSec = useGameStore.getState().simSec
    const needs = hospitalNeedsFor(a.categoryId, a.severity)
    const hospital = a.hospitalId
      ? hospitalById.get(a.hospitalId)
      : bestHospital(needs, a.ort, a.sosi)?.hospital

    // one transporter per patient across ALL units of this Auftrag (Rework #6)
    const allUnits = Object.keys(a.assigned)
      .map((vid) => vehicleSim.get(vid))
      .filter((rt): rt is NonNullable<typeof rt> => !!rt)
      .map((rt) => ({ id: rt.id, typ: rt.unit.typ, notfallKtw: rt.unit.notfallKtw }))
    const transporters = allocateTransports(allUnits, a.personen)

    // Lagefreigabe (Rework 2): unsecured POL scene → units only approach the
    // Bereitstellungsraum until the dispatcher releases them (GAME_DATA §4 D/E)
    const mustHold = a.lagefreigabe && !a.lageFreigegeben
    const holdAt = mustHold ? bereitstellungsraum(a.ort) : undefined

    const alarmed: string[] = []
    for (const vid of staged) {
      const isTransporter = transporters.has(vid) && !!hospital
      const ok = vehicleSim.dispatch(
        vid,
        {
          id: a.id,
          label: alarmtext(a),
          einsatzort: { lat: a.ort.lat, lon: a.ort.lon },
          sosi: a.sosi,
          transport: isTransporter,
          zielort: hospital && isTransporter ? { lat: hospital.lat, lon: hospital.lon } : undefined,
          zielName: isTransporter ? hospital?.short : undefined,
          holdAt,
        },
        simSec,
      )
      if (ok) alarmed.push(vid)
    }
    // already-running units: keep transport roles consistent
    for (const vid of Object.keys(a.assigned)) {
      if (staged.includes(vid)) continue
      const isTransporter = transporters.has(vid) && !!hospital
      vehicleSim.setTransportRole(
        vid,
        isTransporter,
        hospital ? { lat: hospital.lat, lon: hospital.lon } : undefined,
        hospital?.short,
      )
    }
    if (alarmed.length === 0) return false
    set((s) => {
      const cur = s.auftraege[id]!
      const assigned = { ...cur.assigned }
      for (const vid of alarmed) assigned[vid] = 'alarmiert'
      // staged units that failed dispatch (became unavailable) drop out
      for (const vid of staged) if (!alarmed.includes(vid)) delete assigned[vid]
      return {
        auftraege: {
          ...s.auftraege,
          [id]: {
            ...cur,
            assigned,
            transporters: [...transporters],
            state: cur.state === 'offen' ? 'disponiert' : cur.state,
          },
        },
      }
    })
    const names = alarmed
      .map((vid) => {
        const rt = vehicleSim.get(vid)
        return rt ? unitDisplayName(rt.unit) : vid
      })
      .join(', ')
    log('einsatz', `${id}: ALARMIERUNG — ${names}`, id)

    // unsecured scene: police secures, dispatcher releases later (Rework 2)
    if (mustHold) {
      const cur = get().auftraege[id]!
      if (!cur.partnersAlarmed.includes('POL')) {
        get().togglePartner(id, 'POL')
        get().addInfo(id, 'Polizei mitalarmiert — Lagefreigabe erforderlich')
      }
      if (cur.lagePolizeiFreiAt === undefined) {
        set((s) => ({
          auftraege: {
            ...s.auftraege,
            [id]: { ...s.auftraege[id]!, lagePolizeiFreiAt: simSec + POLIZEI_SICHERUNG_SEC },
          },
        }))
        get().addInfo(
          id,
          'Anfahrt NUR bis Bereitstellungsraum — Einsatzort erst nach Lagefreigabe der Polizei anfahren!',
        )
      }
    }

    // „Kein NA verfügbar" (Rework 2): severe emergency alarmed without NA and
    // none findable → the RTW crew must manage incl. transport
    const after = get().auftraege[id]!
    const isEmergency = !after.code.startsWith('D') && !after.code.startsWith('E')
    if (isEmergency && after.severity === 'hoch') {
      const hasNa = Object.keys(after.assigned).some((vid) => {
        const typ = vehicleSim.get(vid)?.unit.typ
        return typ === 'NEF' || typ === 'NAW' || typ === 'HELI'
      })
      if (!hasNa) {
        const g = useGameStore.getState()
        const naAvailable = findUnits(
          vehicleSim,
          ['NEF', 'NAW', 'HELI'],
          after.ort,
          true,
          {
            simSec,
            weather: g.weather,
            startWeekday: g.startWeekday,
            month: g.month,
            season: g.season,
          },
          1,
        )
        if (naAvailable.length === 0) {
          get().addInfo(
            id,
            'KEIN Notarzt verfügbar — RTW-Besatzung übernimmt Versorgung und Transport!',
          )
        }
      }
    }
    return true
  },

  addInfo: (id, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const simSec = useGameStore.getState().simSec
    set((s) => {
      const a = s.auftraege[id]
      if (!a) return s
      return {
        auftraege: {
          ...s.auftraege,
          [id]: { ...a, infos: [...(a.infos ?? []), { simSec, text: trimmed }] },
        },
      }
    })
    log('einsatz', `${id}: Info — ${trimmed}`, id)
  },

  redirectVehicle: (vehicleId, toAuftragId) => {
    const rt = vehicleSim.get(vehicleId)
    const target = get().auftraege[toAuftragId]
    if (!rt || !target || target.state === 'abgeschlossen') return false
    const simSec = useGameStore.getState().simSec
    // pull from the current Auftrag (only before transport)
    if (rt.assignment) {
      const fromId = rt.assignment.id
      if (rt.status === '4' || rt.status === '5') return false
      if (get().auftraege[fromId]) {
        get().cancelVehicle(fromId, vehicleId)
        get().addInfo(fromId, `${unitDisplayName(rt.unit)} umdisponiert zu ${toAuftragId}`)
      } else {
        vehicleSim.cancelAssignment(vehicleId, simSec)
      }
    }
    // direct dispatch to the new Auftrag (Umdisponierung = sofortiger Funkbefehl)
    const ok = get().assignVehicle(toAuftragId, vehicleId) && get().alarmieren(toAuftragId)
    if (ok) log('einsatz', `${toAuftragId}: ${unitDisplayName(rt.unit)} umdisponiert`, toAuftragId)
    return ok
  },

  /** Auftrag bearbeiten (Rework #10): Ort/Kategorie/Schwere/Personen/Notiz. */
  updateAuftrag: (id, patch) => {
    const a = get().auftraege[id]
    if (!a) return
    const simSec = useGameStore.getState().simSec
    const categoryId = patch.categoryId ?? a.categoryId
    const severity = patch.severity ?? a.severity
    const personen = patch.personen ?? a.personen
    const ort = patch.ort ?? a.ort
    const category = categoryById.get(categoryId)
    if (!category) return
    // re-derive the code unless it was manually overridden
    const code = a.codeManuell ? a.code : deriveCode(categoryId, { personen, severity })
    const def = codeByCode.get(code)
    const updated: Auftrag = {
      ...a,
      categoryId,
      severity,
      personen,
      ort,
      notiz: patch.notiz !== undefined ? patch.notiz : a.notiz,
      code,
      sosi: def?.sosi ?? a.sosi,
      hilfsfristDeadline: a.codeManuell
        ? a.hilfsfristDeadline
        : hilfsfristDeadline(code, a.createdAt),
      lagefreigabe: category.lagefreigabe,
    }
    set((s) => ({ auftraege: { ...s.auftraege, [id]: updated } }))
    if (patch.ort) {
      // units still approaching follow the corrected location
      for (const vid of Object.keys(a.assigned)) {
        vehicleSim.updateEinsatzort(vid, { lat: ort.lat, lon: ort.lon }, simSec)
      }
      void import('./mapStore.ts').then(({ useMapStore }) =>
        useMapStore.getState().focusOn(ort.lat, ort.lon, 12.5),
      )
      log('einsatz', `${id}: Einsatzort korrigiert → ${ort.strasse}, ${ort.stadtteil}`, id)
    }
    if (patch.categoryId || patch.severity || patch.personen) {
      log('einsatz', `${id}: Auftrag aktualisiert (${code} ${category.label}, ${personen} Pers.)`, id)
    }
  },

  cancelVehicle: (id, vehicleId) => {
    const a = get().auftraege[id]
    if (!a) return
    if (a.assigned[vehicleId] === 'zugeteilt') {
      get().removeStagedVehicle(id, vehicleId)
      return
    }
    const simSec = useGameStore.getState().simSec
    if (vehicleSim.cancelAssignment(vehicleId, simSec)) {
      set((s) => {
        const cur = s.auftraege[id]
        if (!cur) return s
        const assigned = { ...cur.assigned }
        delete assigned[vehicleId]
        return { auftraege: { ...s.auftraege, [id]: { ...cur, assigned } } }
      })
      log('einsatz', `${id}: Einsatzabbruch für ${vehicleId}`, id)
      // a canceled transporter hands the patient to the next capable unit
      if (a.transporters?.includes(vehicleId)) {
        const rest = get().auftraege[id]
        if (!rest) return
        const needs = hospitalNeedsFor(rest.categoryId, rest.severity)
        const hospital = rest.hospitalId
          ? hospitalById.get(rest.hospitalId)
          : bestHospital(needs, rest.ort, rest.sosi)?.hospital
        const units = Object.keys(rest.assigned)
          .map((vid) => vehicleSim.get(vid))
          .filter((rt): rt is NonNullable<typeof rt> => !!rt)
          .map((rt) => ({ id: rt.id, typ: rt.unit.typ, notfallKtw: rt.unit.notfallKtw }))
        const transporters = allocateTransports(units, rest.personen)
        for (const vid of Object.keys(rest.assigned)) {
          vehicleSim.setTransportRole(
            vid,
            transporters.has(vid) && !!hospital,
            hospital ? { lat: hospital.lat, lon: hospital.lon } : undefined,
            hospital?.short,
          )
        }
        set((s) => ({
          auftraege: {
            ...s.auftraege,
            [id]: { ...s.auftraege[id]!, transporters: [...transporters] },
          },
        }))
      }
    }
  },

  setHospital: (id, hospitalId) => {
    const hospital = hospitalById.get(hospitalId)
    const a = get().auftraege[id]
    if (!hospital || !a) return
    const needs = hospitalNeedsFor(a.categoryId, a.severity)
    const suitable =
      matchHospitals(needs, a.ort, a.sosi).find((c) => c.hospital.id === hospitalId)?.suitable ??
      true
    set((s) => ({
      auftraege: {
        ...s.auftraege,
        [id]: { ...s.auftraege[id]!, hospitalId, hospitalSuitable: suitable },
      },
    }))
    // re-target running transports (transporters only)
    for (const vehicleId of a.transporters ?? []) {
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

  freigabeLage: (id) => {
    const a = get().auftraege[id]
    if (!a || !a.lagefreigabe || a.lageFreigegeben) return
    const simSec = useGameStore.getState().simSec
    set((s) => ({
      auftraege: {
        ...s.auftraege,
        [id]: { ...s.auftraege[id]!, lageFreigegeben: true, lageGemeldet: true },
      },
    }))
    vehicleSim.releaseHold(id, simSec)
    get().addInfo(id, 'LAGEFREIGABE — Anfahrt zum Einsatzort frei')
  },

  tick: (simSec) => {
    for (const a of Object.values(get().auftraege)) {
      if (a.state === 'abgeschlossen' || !a.lagefreigabe) continue
      if (a.lageGemeldet || a.lageFreigegeben) continue
      if (a.lagePolizeiFreiAt === undefined || simSec < a.lagePolizeiFreiAt) continue
      set((s) => ({
        auftraege: { ...s.auftraege, [a.id]: { ...s.auftraege[a.id]!, lageGemeldet: true } },
      }))
      log('einsatz', `${a.id}: Polizei meldet — Lage gesichert`, a.id)
      // police radios the clearance; the dispatcher confirms via funk action
      void import('./funkStore.ts').then(({ useFunkStore }) =>
        useFunkStore.getState().append({
          simSec,
          kind: 'lagemeldung',
          auftragId: a.id,
          stage: 'offen',
          lines: [
            {
              speaker: 'Polizei',
              text: `Lage ${a.ort.strasse} ist gesichert — Zufahrt für Rettung frei.`,
            },
          ],
          action: { type: 'lagefreigabe', auftragId: a.id },
        }),
      )
    }
  },

  closeAuftrag: (id) =>
    set((s) => {
      const a = s.auftraege[id]
      if (!a) return s
      log('einsatz', `${id}: abgeschlossen`, id)
      return {
        auftraege: { ...s.auftraege, [id]: finalize({ ...a, state: 'abgeschlossen' }) },
        selectedId: s.selectedId === id ? null : s.selectedId,
      }
    }),

  handleVehicleEvent: (e) => {
    if (e.type !== 'status' || !e.assignmentId) return
    const a = get().auftraege[e.assignmentId]
    if (!a || a.assigned[e.vehicleId] === undefined) return
    if (e.to === '3') {
      const unitTyp = vehicleSim.get(e.vehicleId)?.unit.typ
      const isNa = unitTyp === 'NEF' || unitTyp === 'NAW' || unitTyp === 'HELI'
      set((s) => {
        const cur = s.auftraege[a.id]!
        return {
          auftraege: {
            ...s.auftraege,
            [a.id]: {
              ...cur,
              assigned: { ...cur.assigned, [e.vehicleId]: 'vorort' },
              firstArrivalSec: cur.firstArrivalSec ?? e.simSec,
              naArrivedSec: cur.naArrivedSec ?? (isNa ? e.simSec : undefined),
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
        const done = allDone && cur.state !== 'offen'
        const next: Auftrag = { ...cur, assigned, state: done ? 'abgeschlossen' : cur.state }
        return {
          auftraege: { ...s.auftraege, [a.id]: done ? finalize(next) : next },
        }
      })
    }
  },
}))

// React to vehicle status changes (assignment progress)
vehicleSim.addEventListener((e) => useDispatchStore.getState().handleVehicleEvent(e))
