import { create } from 'zustand'
import {
  ALLOWED_ACTIONS,
  type ActionMessage,
  type CoopMessage,
  type SyncPayload,
} from '../coop/protocol.ts'
import type { Transport } from '../coop/transport.ts'
import { vehicleSim } from './simulation.ts'
import { useGameStore, type PlayerRole } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useCallStore } from './callStore.ts'
import { useFunkStore } from './funkStore.ts'
import { useEventLog } from './eventLog.ts'
import { useShiftStore } from './shiftStore.ts'

/**
 * Coop session (M9): the HOST runs the authoritative simulation; the guest
 * mirrors state (Aufträge, Status, Uhr — CLAUDE.md M9) and sends whitelisted
 * actions. Roles are split Calltaker/Disponent (GAME_MECHANICS §5).
 */

export type CoopMode = 'off' | 'host' | 'guest'

interface CoopState {
  mode: CoopMode
  connected: boolean
  hostRole: PlayerRole
  /** main menu „Coop" entry → game page opens the dialog right away */
  dialogRequested: boolean
  requestDialog: () => void
  clearDialogRequest: () => void
  startHost: (transport: Transport, hostRole: PlayerRole) => void
  startGuest: (transport: Transport) => void
  stop: () => void
}

let transportRef: Transport | null = null
let syncTimer: ReturnType<typeof setInterval> | null = null
let guestOriginals: Record<string, Record<string, unknown>> | null = null
let reportUnsub: (() => void) | null = null

function buildSync(): SyncPayload {
  const g = useGameStore.getState()
  const d = useDispatchStore.getState()
  const c = useCallStore.getState()
  const f = useFunkStore.getState()
  return {
    simSec: g.simSec,
    speed: g.speed,
    running: g.running,
    weather: g.weather,
    auftraege: d.auftraege,
    order: d.order,
    vehicles: vehicleSim.all().map((rt) => {
      const pos = vehicleSim.posOf(rt, g.simSec)
      return { id: rt.id, status: rt.status, lat: pos.lat, lon: pos.lon }
    }),
    queue: c.queue,
    active: c.active,
    callStats: c.stats,
    sprueche: f.sprueche,
    logEntries: useEventLog.getState().entries.slice(-120),
  }
}

function applySync(p: SyncPayload) {
  useGameStore.setState({
    simSec: p.simSec,
    speed: p.speed,
    running: p.running,
    weather: p.weather,
  })
  useDispatchStore.setState({ auftraege: p.auftraege, order: p.order })
  useCallStore.setState({ queue: p.queue, active: p.active, stats: p.callStats })
  useFunkStore.setState({ sprueche: p.sprueche })
  useEventLog.setState({ entries: p.logEntries })
  vehicleSim.applySnapshot(p.vehicles)
}

function hostApplyAction(msg: ActionMessage) {
  if (!ALLOWED_ACTIONS[msg.store]?.includes(msg.method)) return
  const stores = {
    call: useCallStore,
    dispatch: useDispatchStore,
    funk: useFunkStore,
    game: useGameStore,
  } as const
  const state = stores[msg.store].getState() as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >
  try {
    state[msg.method]?.(...msg.args)
  } catch (err) {
    console.warn('coop action failed', msg, err)
  }
}

function makeSender(store: ActionMessage['store'], method: string) {
  return (...args: unknown[]) => {
    transportRef?.send({ t: 'action', store, method, args } satisfies ActionMessage)
    // optimistic neutral return for boolean/string-returning actions
    return method === 'createAuftrag' ? null : true
  }
}

/** Replace mutating guest-store methods with senders (originals restored on stop). */
function installGuestOverrides() {
  guestOriginals = { call: {}, dispatch: {}, funk: {}, game: {} }
  const stores = {
    call: useCallStore,
    dispatch: useDispatchStore,
    funk: useFunkStore,
    game: useGameStore,
  } as const
  for (const [key, methods] of Object.entries(ALLOWED_ACTIONS)) {
    const store = stores[key as ActionMessage['store']]
    const patch: Record<string, unknown> = {}
    for (const m of methods) {
      guestOriginals[key]![m] = (store.getState() as unknown as Record<string, unknown>)[m]
      patch[m] = makeSender(key as ActionMessage['store'], m)
    }
    ;(store.setState as (p: object) => void)(patch)
  }
}

function restoreGuestOverrides() {
  if (!guestOriginals) return
  const stores = {
    call: useCallStore,
    dispatch: useDispatchStore,
    funk: useFunkStore,
    game: useGameStore,
  } as const
  for (const [key, methods] of Object.entries(guestOriginals)) {
    ;(stores[key as ActionMessage['store']].setState as (p: object) => void)(methods)
  }
  guestOriginals = null
}

export const useCoopStore = create<CoopState>((set, get) => ({
  mode: 'off',
  connected: false,
  hostRole: 'disponent',
  dialogRequested: false,
  requestDialog: () => set({ dialogRequested: true }),
  clearDialogRequest: () => set({ dialogRequested: false }),

  startHost: (transport, hostRole) => {
    get().stop()
    transportRef = transport
    set({ mode: 'host', hostRole })
    const guestRole: PlayerRole = hostRole === 'disponent' ? 'calltaker' : 'disponent'
    // host keeps full sim; player role limited to hostRole
    useGameStore.setState({ role: 'voll' })

    transport.onMessage((data) => {
      const msg = data as CoopMessage
      if (msg.t === 'join') {
        const g = useGameStore.getState()
        transport.send({
          t: 'welcome',
          guestRole,
          config: { region: g.region, month: g.month, startWeekday: g.startWeekday },
        } satisfies CoopMessage)
      } else if (msg.t === 'action') {
        hostApplyAction(msg)
      }
    })
    transport.onOpen(() => set({ connected: true }))
    transport.onClose(() => set({ connected: false }))

    syncTimer = setInterval(() => {
      if (get().connected) {
        transport.send({ t: 'sync', payload: buildSync() } satisfies CoopMessage)
      }
    }, 1000)

    // share the final report (Team-Score)
    reportUnsub = useShiftStore.subscribe((s, prev) => {
      if (s.report && s.report !== prev.report) {
        transport.send({ t: 'report', report: s.report } satisfies CoopMessage)
      }
    })
  },

  startGuest: (transport) => {
    get().stop()
    transportRef = transport
    set({ mode: 'guest' })
    installGuestOverrides()
    useGameStore.setState({ callsEnabled: false })

    transport.onMessage((data) => {
      const msg = data as CoopMessage
      if (msg.t === 'welcome') {
        useGameStore.setState({
          role: msg.guestRole,
          region: msg.config.region as never,
          month: msg.config.month,
          startWeekday: msg.config.startWeekday,
        })
        set({ connected: true })
      } else if (msg.t === 'sync') {
        applySync(msg.payload)
      } else if (msg.t === 'report') {
        useShiftStore.setState({ report: msg.report, showReport: true })
      }
    })
    transport.onOpen(() => {
      transport.send({ t: 'join' } satisfies CoopMessage)
    })
    transport.onClose(() => set({ connected: false }))
  },

  stop: () => {
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
    reportUnsub?.()
    reportUnsub = null
    restoreGuestOverrides()
    transportRef?.close()
    transportRef = null
    set({ mode: 'off', connected: false })
  },
}))

/** Guest clients must not tick the local simulation. */
export function isCoopGuest(): boolean {
  return useCoopStore.getState().mode === 'guest'
}
