import { hospitalById, stationById, balancing } from '../data/index.ts'
import type { DutyWindow, Helicopter, Vehicle, VehicleType } from '../data/schemas.ts'
import { isOnDuty, type DutyContext } from './duty.ts'
import { canTransition, isAvailable, type StatusCode, type VehiclePhase } from './status.ts'
import { routeTravelSec } from './routing.ts'
import { lerpLatLon, type LatLon } from './geo.ts'
import { isDaylight, isNight } from './time.ts'
import { mulberry32, randBetween, type Rng } from './rng.ts'

/**
 * Unit runtime simulation (GAME_DATA §10 lifecycle, §6/§7 duty times,
 * §10b Sonderstatus, §12b NEF-101 rule, §8 helicopter rules).
 * UI-free and deterministic (seeded RNG). Units are ground vehicles or helicopters.
 */

export interface SimUnit {
  id: string
  typ: VehicleType | 'HELI'
  base: LatLon
  stationId: string
  stationName: string
  staffing: 'hauptamtlich' | 'gemischt' | 'ehrenamtlich'
  region: 'NORD' | 'SUED'
  dienstzeiten: DutyWindow[]
  reserve: boolean
  notfallKtw: boolean
  nickname?: string
  specialRule?: string
  rollstuhlgeeignet?: boolean
  /** Helicopters: sunrise–sunset only (GAME_DATA §8) */
  daylightOnly?: boolean
  /** Helicopters: months in service */
  saisonMonate?: number[]
}

export function unitFromVehicle(v: Vehicle): SimUnit {
  const st = stationById.get(v.homeStation)
  if (!st) throw new Error(`vehicle ${v.funkrufname}: unknown station ${v.homeStation}`)
  return {
    id: v.funkrufname,
    typ: v.typ,
    base: { lat: st.lat, lon: st.lon },
    stationId: st.id,
    stationName: st.name,
    staffing: st.staffing,
    region: st.region,
    dienstzeiten: v.dienstzeiten,
    reserve: v.reserve,
    notfallKtw: v.notfallKtw,
    nickname: v.nickname,
    specialRule: v.specialRule,
    rollstuhlgeeignet: v.rollstuhlgeeignet,
  }
}

export function unitFromHelicopter(h: Helicopter): SimUnit {
  return {
    id: h.id,
    typ: 'HELI',
    base: { lat: h.lat, lon: h.lon },
    stationId: h.id,
    stationName: h.basis,
    staffing: 'hauptamtlich',
    region: h.region,
    dienstzeiten: [],
    reserve: false,
    notfallKtw: false,
    nickname: h.rufname,
    daylightOnly: true,
    saisonMonate: h.saisonMonate,
  }
}

export interface AssignmentSpec {
  id: string
  label: string
  einsatzort: LatLon
  sosi: boolean
  transport: boolean
  zielort?: LatLon
  zielName?: string
  onSceneSec?: number
  handoverSec?: number
}

export interface VehicleEvent {
  simSec: number
  vehicleId: string
  type: 'status' | 'spawn' | 'despawn'
  from?: VehiclePhase
  to?: VehiclePhase
  note?: string
  assignmentId?: string
}

export interface VehicleRuntime {
  id: string
  unit: SimUnit
  status: VehiclePhase
  basePos: LatLon
  moveFrom?: LatLon
  moveTo?: LatLon
  moveStart?: number
  moveArrive?: number
  assignment?: AssignmentSpec
  /** Timer for dwell phases: turnout (1), on scene (3), handover (5), pause (6), Sonderstatus */
  phaseUntil?: number
  positionTargetCode?: StatusCode
  positionTargetPos?: LatLon
  /** Reserve vehicles activated manually (GAME_DATA §10b status 94 rule) */
  manualService: boolean
  note?: string
}

const FAHRZEUGCHECK_PROBABILITY = 0.35 // at shift start (GAME_DATA §10b, estimated)
const FOLLOWUP_TURNOUT_SEC = 15 // crew already aboard (7/88/position dispatch)
const STATUS6_PAUSE_SEC = 30

export class VehicleSim {
  private runtimes = new Map<string, VehicleRuntime>()
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: VehicleEvent) => void>()
  private rng: Rng
  version = 0

  constructor(seed = 42, units: SimUnit[]) {
    this.rng = mulberry32(seed)
    for (const unit of units) {
      this.runtimes.set(unit.id, {
        id: unit.id,
        unit,
        status: 'AUS',
        basePos: { ...unit.base },
        manualService: false,
      })
    }
  }

  all(): VehicleRuntime[] {
    return [...this.runtimes.values()]
  }

  get(id: string): VehicleRuntime | undefined {
    return this.runtimes.get(id)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  addEventListener(fn: (e: VehicleEvent) => void): () => void {
    this.eventListeners.add(fn)
    return () => this.eventListeners.delete(fn)
  }

  private notify() {
    this.version++
    for (const fn of this.listeners) fn()
  }

  private emit(e: VehicleEvent) {
    for (const fn of this.eventListeners) fn(e)
  }

  /** Validated status change. AUS transitions are duty-driven, not status-rule-driven. */
  private setStatus(rt: VehicleRuntime, to: VehiclePhase, simSec: number, note?: string) {
    const from = rt.status
    if (from === to) return
    if (from !== 'AUS' && to !== 'AUS' && !canTransition(from, to)) {
      throw new Error(`invalid status transition ${rt.id}: ${from} -> ${to}`)
    }
    rt.status = to
    rt.note = note
    this.emit({
      simSec,
      vehicleId: rt.id,
      type: 'status',
      from,
      to,
      note,
      assignmentId: rt.assignment?.id,
    })
  }

  posOf(rt: VehicleRuntime, simSec: number): LatLon {
    if (
      rt.moveFrom &&
      rt.moveTo &&
      rt.moveStart !== undefined &&
      rt.moveArrive !== undefined &&
      simSec < rt.moveArrive
    ) {
      const t = (simSec - rt.moveStart) / Math.max(1, rt.moveArrive - rt.moveStart)
      return lerpLatLon(rt.moveFrom, rt.moveTo, t)
    }
    return rt.moveTo && rt.moveArrive !== undefined && simSec >= rt.moveArrive
      ? rt.moveTo
      : rt.basePos
  }

  private startMove(rt: VehicleRuntime, to: LatLon, simSec: number, sosi: boolean) {
    const from = this.posOf(rt, simSec)
    const sec = Math.max(20, routeTravelSec(from, to, { typ: rt.unit.typ, sosi }))
    rt.moveFrom = from
    rt.moveTo = to
    rt.moveStart = simSec
    rt.moveArrive = simSec + sec
  }

  private endMove(rt: VehicleRuntime) {
    if (rt.moveTo) rt.basePos = rt.moveTo
    rt.moveFrom = rt.moveTo = undefined
    rt.moveStart = rt.moveArrive = undefined
  }

  /** Turnout time after alarm (GAME_MECHANICS §2 Quittierung & Ausrückzeit). */
  estimateTurnoutSec(id: string, simSec: number): number {
    const rt = this.runtimes.get(id)
    if (!rt) return 0
    return this.turnoutSec(rt, simSec)
  }

  private turnoutSec(rt: VehicleRuntime, simSec: number): number {
    if (rt.status !== '00' && rt.status !== 'AUS') return FOLLOWUP_TURNOUT_SEC
    const t = balancing.turnout
    // GAME_DATA §12b: NEF 101 at night is staffed by hospital personnel
    if (rt.unit.specialRule === 'nef101' && isNight(simSec)) return t.khPersonalNachtSec
    const night = isNight(simSec)
    switch (rt.unit.staffing) {
      case 'hauptamtlich':
        return t.hauptamtlichSec
      case 'gemischt':
        return night ? t.ehrenamtlichTagSec : t.hauptamtlichSec * 1.5
      case 'ehrenamtlich':
        return night ? t.ehrenamtlichNachtSec : t.ehrenamtlichTagSec
    }
  }

  /** Dispatch an assignment. Returns false when the unit cannot take it. */
  dispatch(id: string, spec: AssignmentSpec, simSec: number): boolean {
    const rt = this.runtimes.get(id)
    if (!rt || !isAvailable(rt.status)) return false
    const turnout = this.turnoutSec(rt, simSec)
    this.endMove(rt)
    rt.positionTargetCode = undefined
    rt.positionTargetPos = undefined
    rt.assignment = {
      onSceneSec: Math.round(randBetween(this.rng, 600, 1200)),
      handoverSec: Math.round(randBetween(this.rng, 480, 900)),
      ...spec,
    }
    this.setStatus(rt, '1', simSec, spec.label)
    rt.phaseUntil = simSec + turnout
    this.notify()
    return true
  }

  /** Update transport target while the assignment is running (hospital re-choice). */
  updateAssignmentTarget(id: string, zielort: LatLon, zielName: string): boolean {
    const rt = this.runtimes.get(id)
    if (!rt?.assignment) return false
    if (rt.status === '4' || rt.status === '5') return false // already en route/at target
    rt.assignment.zielort = zielort
    rt.assignment.zielName = zielName
    rt.assignment.transport = true
    return true
  }

  /** Send an available unit to a standby position (status 88 → 08/09/10). */
  sendToPosition(id: string, hospitalId: string, simSec: number): boolean {
    const rt = this.runtimes.get(id)
    const hospital = hospitalById.get(hospitalId)
    if (!rt || !hospital?.positionsCode || !isAvailable(rt.status)) return false
    if (rt.status === '88' || rt.status === hospital.positionsCode) return false
    const pos = { lat: hospital.lat, lon: hospital.lon }
    rt.positionTargetCode = hospital.positionsCode as StatusCode
    rt.positionTargetPos = pos
    this.setStatus(rt, '88', simSec, `Anfahrt Position ${hospital.short}`)
    this.startMove(rt, pos, simSec, false)
    this.notify()
    return true
  }

  /** Abort an assignment — only before transport (status 1/2/3, patient not aboard).
   *  Deliberately bypasses canTransition: abort is an exceptional dispatcher action. */
  cancelAssignment(id: string, simSec: number): boolean {
    const rt = this.runtimes.get(id)
    if (!rt || !rt.assignment) return false
    if (rt.status !== '1' && rt.status !== '2' && rt.status !== '3') return false
    this.endMove(rt)
    const assignmentId = rt.assignment.id
    rt.assignment = undefined
    const from = rt.status
    rt.status = '6'
    rt.phaseUntil = simSec + STATUS6_PAUSE_SEC
    this.emit({
      simSec,
      vehicleId: rt.id,
      type: 'status',
      from,
      to: '6',
      note: 'Einsatzabbruch',
      assignmentId,
    })
    this.notify()
    return true
  }

  /** Manual Sonderstatus (91–95) for an available unit, with block time. */
  setSonderstatus(id: string, code: StatusCode, durationSec: number, simSec: number): boolean {
    const rt = this.runtimes.get(id)
    if (!rt || rt.status === 'AUS' || !canTransition(rt.status as StatusCode, code)) return false
    this.setStatus(rt, code, simSec)
    rt.phaseUntil = simSec + durationSec
    this.notify()
    return true
  }

  /** Activate/deactivate a reserve vehicle (5.80-…, GAME_DATA §7). */
  setReserveActive(id: string, active: boolean, simSec: number): boolean {
    const rt = this.runtimes.get(id)
    if (!rt || !rt.unit.reserve) return false
    rt.manualService = active
    if (!active && rt.status !== 'AUS' && isAvailable(rt.status)) {
      this.emit({ simSec, vehicleId: id, type: 'despawn' })
      rt.status = 'AUS'
    }
    this.notify()
    return true
  }

  /** Mirror a host snapshot (coop guest — no local ticking, M9). */
  applySnapshot(units: { id: string; status: VehiclePhase; lat: number; lon: number }[]) {
    for (const u of units) {
      const rt = this.runtimes.get(u.id)
      if (!rt) continue
      rt.status = u.status
      rt.basePos = { lat: u.lat, lon: u.lon }
      rt.moveFrom = rt.moveTo = undefined
      rt.moveStart = rt.moveArrive = undefined
    }
    this.notify()
  }

  /** Reset every unit to out-of-service (new shift). */
  resetAll() {
    for (const rt of this.runtimes.values()) {
      rt.status = 'AUS'
      rt.assignment = undefined
      rt.basePos = { ...rt.unit.base }
      rt.moveFrom = rt.moveTo = undefined
      rt.moveStart = rt.moveArrive = undefined
      rt.phaseUntil = undefined
      rt.positionTargetCode = undefined
      rt.positionTargetPos = undefined
      rt.manualService = false
    }
    this.notify()
  }

  isInService(rt: VehicleRuntime, simSec: number, ctx: DutyContext): boolean {
    if (rt.unit.reserve) return rt.manualService
    if (rt.unit.daylightOnly) {
      // Helicopter rules (GAME_DATA §8): season months + sunrise–sunset
      const inSeason = rt.unit.saisonMonate?.includes(ctx.month) ?? true
      return inSeason && isDaylight(simSec, ctx)
    }
    return isOnDuty(rt.unit, simSec, ctx)
  }

  tick(simSec: number, ctx: DutyContext) {
    let changed = false
    for (const rt of this.runtimes.values()) {
      changed = this.tickVehicle(rt, simSec, ctx) || changed
    }
    if (changed) this.notify()
  }

  private tickVehicle(rt: VehicleRuntime, simSec: number, ctx: DutyContext): boolean {
    const before = rt.status
    const onDuty = this.isInService(rt, simSec, ctx)

    // Spawn / despawn by duty windows
    if (rt.status === 'AUS') {
      if (onDuty) {
        rt.basePos = { ...rt.unit.base }
        rt.status = '00'
        this.emit({ simSec, vehicleId: rt.id, type: 'spawn' })
        // Fahrzeugcheck at shift start (GAME_DATA §10b status 92) — ground only
        if (rt.unit.typ !== 'HELI' && this.rng() < FAHRZEUGCHECK_PROBABILITY) {
          this.setStatus(rt, '92', simSec, 'Fahrzeugcheck bei Schichtbeginn')
          rt.phaseUntil = simSec + Math.round(randBetween(this.rng, 600, 1200))
        }
      }
      return rt.status !== before
    }

    if (!onDuty && (rt.status === '00' || rt.status === '88' || isPositionCode(rt.status))) {
      // end of duty: unit leaves service (engaged units finish first)
      this.endMove(rt)
      rt.positionTargetCode = undefined
      rt.positionTargetPos = undefined
      this.emit({ simSec, vehicleId: rt.id, type: 'despawn', from: rt.status })
      rt.status = 'AUS'
      rt.basePos = { ...rt.unit.base }
      return true
    }

    const a = rt.assignment
    switch (rt.status) {
      case '91':
      case '92':
      case '93':
      case '94':
      case '95':
        if (rt.phaseUntil !== undefined && simSec >= rt.phaseUntil) {
          rt.phaseUntil = undefined
          this.setStatus(rt, '00', simSec)
        }
        break
      case '1':
        if (a && rt.phaseUntil !== undefined && simSec >= rt.phaseUntil) {
          rt.phaseUntil = undefined
          this.setStatus(rt, '2', simSec)
          this.startMove(rt, a.einsatzort, simSec, a.sosi)
        }
        break
      case '2':
        if (rt.moveArrive !== undefined && simSec >= rt.moveArrive) {
          this.endMove(rt)
          this.setStatus(rt, '3', simSec)
          rt.phaseUntil = simSec + (a?.onSceneSec ?? 900)
        }
        break
      case '3':
        if (rt.phaseUntil !== undefined && simSec >= rt.phaseUntil) {
          rt.phaseUntil = undefined
          if (a?.transport && a.zielort) {
            this.setStatus(rt, '4', simSec, a.zielName)
            this.startMove(rt, a.zielort, simSec, a.sosi)
          } else {
            this.setStatus(rt, '6', simSec, 'kein Transport')
            rt.assignment = undefined
            rt.phaseUntil = simSec + STATUS6_PAUSE_SEC
          }
        }
        break
      case '4':
        if (rt.moveArrive !== undefined && simSec >= rt.moveArrive) {
          this.endMove(rt)
          this.setStatus(rt, '5', simSec, a?.zielName)
          rt.phaseUntil = simSec + (a?.handoverSec ?? 600)
        }
        break
      case '5':
        if (rt.phaseUntil !== undefined && simSec >= rt.phaseUntil) {
          rt.phaseUntil = undefined
          this.setStatus(rt, '6', simSec)
          rt.assignment = undefined
          rt.phaseUntil = simSec + STATUS6_PAUSE_SEC
        }
        break
      case '6':
        if (rt.phaseUntil !== undefined && simSec >= rt.phaseUntil) {
          rt.phaseUntil = undefined
          this.setStatus(rt, '7', simSec)
          this.startMove(rt, { ...rt.unit.base }, simSec, false)
        }
        break
      case '7':
        if (rt.moveArrive !== undefined && simSec >= rt.moveArrive) {
          this.endMove(rt)
          this.setStatus(rt, '00', simSec)
        }
        break
      case '88':
        if (rt.moveArrive !== undefined && simSec >= rt.moveArrive) {
          this.endMove(rt)
          const code = rt.positionTargetCode ?? '08'
          this.setStatus(rt, code, simSec)
          rt.positionTargetCode = undefined
          rt.positionTargetPos = undefined
        }
        break
      default:
        break
    }

    return rt.status !== before
  }
}

function isPositionCode(s: VehiclePhase): boolean {
  return s === '08' || s === '09' || s === '10'
}
