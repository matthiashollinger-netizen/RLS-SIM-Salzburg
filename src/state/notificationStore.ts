import { create } from 'zustand'
import { alarmtext } from '../engine/auftrag.ts'
import { hilfsfristAlert } from '../audio/sounds.ts'
import { useEventLog } from './eventLog.ts'
import { useGameStore } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'

/**
 * Generic notification toasts (game-feel pass): max 3 stacked top-right,
 * auto-dismiss after 6 s, enter/exit animations via a `leaving` flag.
 * Feeders live HERE as module-level subscriptions (no other store edited);
 * they activate when ToastHost imports this module.
 */

export type ToastKind = 'info' | 'ok' | 'warn' | 'danger'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  text: string
  /** exit animation running — removed shortly after */
  leaving?: boolean
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 6000
/** keep in sync with toast-exit duration in toast-host.css */
const EXIT_MS = 220

interface NotificationState {
  toasts: Toast[]
  push: (t: { kind: ToastKind; title: string; text: string }) => void
  dismiss: (id: number) => void
}

let nextToastId = 1

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],

  push: ({ kind, title, text }) => {
    const toast: Toast = { id: nextToastId++, kind, title, text }
    set((s) => {
      const toasts = [...s.toasts, toast]
      // max 3 stacked — the oldest is dropped immediately
      return { toasts: toasts.length > MAX_TOASTS ? toasts.slice(-MAX_TOASTS) : toasts }
    })
    setTimeout(() => get().dismiss(toast.id), AUTO_DISMISS_MS)
  },

  dismiss: (id) => {
    const toast = get().toasts.find((t) => t.id === id)
    if (!toast || toast.leaving) return
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), EXIT_MS)
  },
}))

// ---------------------------------------------------------------------------
// Feeder (a): event log → toasts.
// 'system' entries starting with "Debriefing" → danger;
// entries starting with "SONDERLAGE" → warn (emitted by the world layer).
// ---------------------------------------------------------------------------
let lastLogId = 0
useEventLog.subscribe((s) => {
  for (const e of s.entries) {
    if (e.id <= lastLogId) continue
    lastLogId = e.id
    if (e.kind === 'system' && e.text.startsWith('Debriefing')) {
      useNotificationStore.getState().push({ kind: 'danger', title: 'Debriefing', text: e.text })
    } else if (e.text.startsWith('SONDERLAGE')) {
      useNotificationStore.getState().push({ kind: 'warn', title: 'Sonderlage', text: e.text })
    }
  }
})

// ---------------------------------------------------------------------------
// Feeder (b): Hilfsfrist watcher — first-time threshold crossings only.
// warn when < 240 s remain without arrival, danger (+ alert sound) on breach.
// ---------------------------------------------------------------------------
const hilfsfristWarned = new Set<string>()
const hilfsfristBreached = new Set<string>()
let lastSimSec = -1

useGameStore.subscribe((s) => {
  if (s.simSec === lastSimSec) return
  lastSimSec = s.simSec
  const { auftraege } = useDispatchStore.getState()
  for (const a of Object.values(auftraege)) {
    if (a.state === 'abgeschlossen') continue
    if (a.hilfsfristDeadline === undefined || a.firstArrivalSec !== undefined) continue
    const remaining = a.hilfsfristDeadline - s.simSec
    if (remaining <= 0) {
      if (hilfsfristBreached.has(a.id)) continue
      hilfsfristBreached.add(a.id)
      hilfsfristWarned.add(a.id)
      hilfsfristAlert()
      useNotificationStore.getState().push({
        kind: 'danger',
        title: 'Hilfsfrist überschritten!',
        text: `${alarmtext(a)} — noch kein Mittel am Einsatzort.`,
      })
    } else if (remaining < 240 && !hilfsfristWarned.has(a.id)) {
      hilfsfristWarned.add(a.id)
      useNotificationStore.getState().push({
        kind: 'warn',
        title: 'Hilfsfrist läuft ab',
        text: `${alarmtext(a)} — noch ${Math.ceil(remaining / 60)} min, kein Mittel vor Ort.`,
      })
    }
  }
})
