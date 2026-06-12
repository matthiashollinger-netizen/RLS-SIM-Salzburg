import { useEffect, useRef } from 'react'
import { WindowFrame } from '../windows/WindowFrame.tsx'
import { Taskbar } from '../windows/Taskbar.tsx'
import { useWindowStore, type WindowId, type WindowRect } from '../windows/windowStore.ts'
import { restoreLayout, startLayoutAutosave } from '../windows/layoutPersistence.ts'
import { WINDOW_DEFS } from '../windows/windowDefs.ts'
import { MapPanel } from '../panels/MapPanel.tsx'
import { AnrufQueuePanel } from '../panels/AnrufQueuePanel.tsx'
import { GespraechPanel } from '../panels/GespraechPanel.tsx'
import { AbfragePanel } from '../panels/AbfragePanel.tsx'
import { EinsatzPanel } from '../panels/EinsatzPanel.tsx'
import { RessourcenPanel } from '../panels/RessourcenPanel.tsx'
import { FunkPanel } from '../panels/FunkPanel.tsx'
import { ProtokollPanel } from '../panels/FeedPanels.tsx'
import { LagebildPanel } from '../panels/LagebildPanel.tsx'
import { startGameLoop, stopGameLoop } from '../state/simulation.ts'
import { useGameStore } from '../state/gameStore.ts'
import { resetKpi, startKpiSampling } from '../state/kpiStore.ts'
import { startAmbient, stopAmbient } from '../audio/sounds.ts'
import { ShiftReportDialog } from '../components/ShiftReportDialog.tsx'
import { TutorialOverlay } from '../components/TutorialOverlay.tsx'
import { KeyboardShortcuts } from '../components/KeyboardShortcuts.tsx'
import { AchievementToast } from '../components/AchievementToast.tsx'
import { ToastHost } from '../components/ToastHost.tsx'
import { LageTicker } from '../components/LageTicker.tsx'
import './game-page.css'

function defaultRects(): Record<WindowId, WindowRect> {
  const w = Math.max(window.innerWidth, 1024)
  const h = Math.max(window.innerHeight - 90, 560) // minus footer+taskbar
  return {
    anrufe: { x: 8, y: 8, w: Math.round(w * 0.15), h: Math.round(h * 0.3) },
    gespraech: {
      x: 8,
      y: Math.round(h * 0.32) + 8,
      w: Math.round(w * 0.15),
      h: Math.round(h * 0.66),
    },
    abfrage: {
      x: Math.round(w * 0.16) + 8,
      y: 8,
      w: Math.round(w * 0.22),
      h: h - 8,
    },
    karte: {
      x: Math.round(w * 0.39) + 8,
      y: 8,
      w: Math.round(w * 0.2),
      h: Math.round(h * 0.6),
    },
    funk: {
      x: Math.round(w * 0.39) + 8,
      y: Math.round(h * 0.62) + 8,
      w: Math.round(w * 0.2),
      h: Math.round(h * 0.36),
    },
    einsatzliste: { x: Math.round(w * 0.6), y: 8, w: Math.round(w * 0.39), h: Math.round(h * 0.55) },
    ressourcen: {
      x: Math.round(w * 0.6),
      y: Math.round(h * 0.57) + 8,
      w: Math.round(w * 0.39),
      h: Math.round(h * 0.41),
    },
    protokoll: { x: Math.round(w * 0.36), y: Math.round(h * 0.4), w: 380, h: 260 },
    khliste: { x: 80, y: 80, w: 460, h: 340 },
    sonderlagen: { x: 120, y: 120, w: 460, h: 340 },
  }
}

/** windows that start closed to keep the default layout uncluttered */
const CLOSED_BY_DEFAULT: ReadonlySet<WindowId> = new Set(['protokoll', 'sonderlagen'])

export function GamePage() {
  const initialized = useRef(false)
  if (!initialized.current) {
    initialized.current = true
    const rects = defaultRects()
    const { register } = useWindowStore.getState()
    for (const def of WINDOW_DEFS) register(def.id, rects[def.id], !CLOSED_BY_DEFAULT.has(def.id))
  }

  useEffect(() => {
    void restoreLayout()
    startGameLoop()
    resetKpi()
    startKpiSampling()
    startAmbient()
    const stop = startLayoutAutosave()
    return () => {
      stopAmbient()
      stop()
      // leaving the game route (browser back) must not keep the world
      // ticking — gongs/toasts would otherwise fire into the main menu
      stopGameLoop()
    }
  }, [])

  const paused = useGameStore((s) => s.speed === 0)

  return (
    <div className="game-page">
      <div className={`window-workspace${paused ? ' workspace-paused' : ''}`}>
        <WindowFrame id="anrufe" title="Anrufe">
          <AnrufQueuePanel />
        </WindowFrame>
        <WindowFrame id="gespraech" title="Gespräch">
          <GespraechPanel />
        </WindowFrame>
        <WindowFrame id="abfrage" title="Abfrageschema">
          <AbfragePanel />
        </WindowFrame>
        <WindowFrame id="karte" title="Lagekarte">
          <MapPanel />
        </WindowFrame>
        <WindowFrame id="einsatzliste" title="Einsatzliste">
          <EinsatzPanel />
        </WindowFrame>
        <WindowFrame id="ressourcen" title="Ressourcen">
          <RessourcenPanel />
        </WindowFrame>
        <WindowFrame id="funk" title="Funkfeld">
          <FunkPanel />
        </WindowFrame>
        <WindowFrame id="protokoll" title="Protokoll">
          <ProtokollPanel />
        </WindowFrame>
        <WindowFrame id="sonderlagen" title="Lagebild">
          <LagebildPanel />
        </WindowFrame>
      </div>
      <LageTicker />
      <Taskbar defs={WINDOW_DEFS} />
      <ShiftReportDialog />
      <TutorialOverlay />
      <AchievementToast />
      <ToastHost />
      <KeyboardShortcuts />
    </div>
  )
}
