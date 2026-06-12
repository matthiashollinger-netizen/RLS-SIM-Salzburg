import { useEffect, useState } from 'react'
import { useWindowStore, type WindowId } from './windowStore.ts'
import { listPresets, restoreLayout, savePreset } from './layoutPersistence.ts'
import type { WindowDef } from './windowDefs.ts'
import { GameClock } from '../components/GameClock.tsx'
import { SettingsDialog } from '../components/SettingsDialog.tsx'
import { CoopDialog } from '../components/CoopDialog.tsx'
import { useCoopStore } from '../state/coopStore.ts'
import { useCallStore } from '../state/callStore.ts'
import { useFunkStore } from '../state/funkStore.ts'
import { useDispatchStore } from '../state/dispatchStore.ts'
import { useGameStore } from '../state/gameStore.ts'
import './windows.css'

/** Open Aufträge past their Hilfsfrist deadline without a first arrival. */
function countOverdueAuftraege(): number {
  const simSec = useGameStore.getState().simSec
  const { auftraege } = useDispatchStore.getState()
  let n = 0
  for (const a of Object.values(auftraege)) {
    if (a.state === 'abgeschlossen') continue
    if (a.hilfsfristDeadline !== undefined && a.firstArrivalSec === undefined && simSec > a.hilfsfristDeadline)
      n++
  }
  return n
}

/**
 * Per-window pending counts for attention badges. Calls/radio come from
 * narrow numeric selectors; overdue Aufträge are polled at 1 Hz via
 * getState() (NOT a 4 Hz simSec subscription re-rendering the taskbar).
 */
function usePendingCounts(): Partial<Record<WindowId, number>> {
  const anrufe = useCallStore((s) => s.queue.length)
  const funk = useFunkStore(
    (s) => s.sprueche.filter((sp) => sp.stage === 'ruf' || sp.stage === 'offen').length,
  )
  const [einsatzliste, setEinsatzliste] = useState(0)

  useEffect(() => {
    setEinsatzliste(countOverdueAuftraege())
    const t = setInterval(() => setEinsatzliste(countOverdueAuftraege()), 1000)
    return () => clearInterval(t)
  }, [])

  return { anrufe, funk, einsatzliste }
}

export function Taskbar({ defs }: { defs: WindowDef[] }) {
  const windows = useWindowStore((s) => s.windows)
  const setOpen = useWindowStore((s) => s.setOpen)
  const focus = useWindowStore((s) => s.focus)
  const [presets, setPresets] = useState<string[]>([])
  const [presetName, setPresetName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showCoop, setShowCoop] = useState(false)
  const coopMode = useCoopStore((s) => s.mode)
  const coopConnected = useCoopStore((s) => s.connected)
  const coopDialogRequested = useCoopStore((s) => s.dialogRequested)
  const pending = usePendingCounts()

  useEffect(() => {
    void listPresets().then(setPresets)
  }, [])

  // main menu „Coop" entry lands here with the dialog pre-requested
  useEffect(() => {
    if (coopDialogRequested) {
      setShowCoop(true)
      useCoopStore.getState().clearDialogRequest()
    }
  }, [coopDialogRequested])

  return (
    <div className="taskbar">
      <GameClock />
      <div className="taskbar-windows" role="toolbar" aria-label="Fenster">
        {defs.map((def) => {
          const win = windows[def.id]
          const open = win?.open ?? false
          const count = pending[def.id] ?? 0
          // attention badge only when the window cannot show its content
          const showBadge = count > 0 && (!open || (win?.minimized ?? false))
          return (
            <button
              key={def.id}
              className={open ? 'taskbar-win-open' : 'taskbar-win-closed'}
              aria-pressed={open}
              onClick={() => {
                if (!open) setOpen(def.id, true)
                else if (win && win.z !== useWindowStore.getState().maxZ) focus(def.id)
                else setOpen(def.id, false)
              }}
            >
              {def.title}
              {showBadge && (
                <span className="taskbar-badge" aria-label={`${count} ausstehend`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="taskbar-layouts">
        <input
          aria-label="Layout-Name"
          placeholder="Layout-Name…"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <button
          onClick={() => {
            const name = presetName.trim()
            if (!name) return
            void savePreset(name).then(() => {
              void listPresets().then(setPresets)
              setPresetName('')
            })
          }}
        >
          Layout speichern
        </button>
        <select
          aria-label="Layout laden"
          value=""
          onChange={(e) => {
            if (e.target.value) void restoreLayout(e.target.value)
          }}
        >
          <option value="">Layout laden…</option>
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          aria-label="Coop"
          title="Coop (2 Spieler)"
          className={coopMode !== 'off' ? (coopConnected ? 'coop-on' : 'coop-waiting') : ''}
          onClick={() => setShowCoop(true)}
        >
          👥
        </button>
        <button aria-label="Einstellungen" title="Einstellungen" onClick={() => setShowSettings(true)}>
          ⚙
        </button>
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showCoop && <CoopDialog onClose={() => setShowCoop(false)} />}
    </div>
  )
}
