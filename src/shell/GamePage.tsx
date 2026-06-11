import { useEffect, useRef } from 'react'
import { WindowFrame } from '../windows/WindowFrame.tsx'
import { Taskbar } from '../windows/Taskbar.tsx'
import { useWindowStore, type WindowId, type WindowRect } from '../windows/windowStore.ts'
import { restoreLayout, startLayoutAutosave } from '../windows/layoutPersistence.ts'
import { WINDOW_DEFS } from '../windows/windowDefs.ts'
import { MapPanel } from '../panels/MapPanel.tsx'
import { AnrufQueuePanel } from '../panels/AnrufQueuePanel.tsx'
import { AbfragePanel } from '../panels/AbfragePanel.tsx'
import { EinsatzPanel } from '../panels/EinsatzPanel.tsx'
import { RessourcenPanel } from '../panels/RessourcenPanel.tsx'
import { FunkPanel } from '../panels/FunkPanel.tsx'
import { ProtokollPanel } from '../panels/FeedPanels.tsx'
import { startGameLoop } from '../state/simulation.ts'
import './game-page.css'

function defaultRects(): Record<WindowId, WindowRect> {
  const w = Math.max(window.innerWidth, 1024)
  const h = Math.max(window.innerHeight - 90, 560) // minus footer+taskbar
  return {
    anrufe: { x: 8, y: 8, w: Math.round(w * 0.17), h: Math.round(h * 0.3) },
    abfrage: { x: 8, y: Math.round(h * 0.32) + 8, w: Math.round(w * 0.27), h: Math.round(h * 0.66) },
    karte: {
      x: Math.round(w * 0.28) + 8,
      y: 8,
      w: Math.round(w * 0.27),
      h: Math.round(h * 0.62),
    },
    einsatzliste: { x: Math.round(w * 0.56), y: 8, w: Math.round(w * 0.43), h: Math.round(h * 0.55) },
    ressourcen: {
      x: Math.round(w * 0.56),
      y: Math.round(h * 0.57) + 8,
      w: Math.round(w * 0.43),
      h: Math.round(h * 0.41),
    },
    funk: {
      x: Math.round(w * 0.29),
      y: Math.round(h * 0.65) + 8,
      w: Math.round(w * 0.26),
      h: Math.round(h * 0.33),
    },
    protokoll: { x: Math.round(w * 0.36), y: Math.round(h * 0.4), w: 380, h: 260 },
    khliste: { x: 80, y: 80, w: 420, h: 320 },
    sonderlagen: { x: 120, y: 120, w: 420, h: 320 },
  }
}

export function GamePage() {
  const initialized = useRef(false)
  if (!initialized.current) {
    initialized.current = true
    const rects = defaultRects()
    const { register } = useWindowStore.getState()
    // Protokoll starts closed to keep the default layout uncluttered
    for (const def of WINDOW_DEFS) register(def.id, rects[def.id], def.id !== 'protokoll')
  }

  useEffect(() => {
    void restoreLayout()
    startGameLoop()
    const stop = startLayoutAutosave()
    return stop
  }, [])

  return (
    <div className="game-page">
      <div className="window-workspace">
        <WindowFrame id="anrufe" title="Anrufe">
          <AnrufQueuePanel />
        </WindowFrame>
        <WindowFrame id="abfrage" title="Abfrage">
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
      </div>
      <Taskbar defs={WINDOW_DEFS} />
    </div>
  )
}
