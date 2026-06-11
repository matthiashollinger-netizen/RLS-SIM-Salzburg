import { useEffect, useRef } from 'react'
import { WindowFrame } from '../windows/WindowFrame.tsx'
import { Taskbar } from '../windows/Taskbar.tsx'
import { useWindowStore, type WindowId, type WindowRect } from '../windows/windowStore.ts'
import { restoreLayout, startLayoutAutosave } from '../windows/layoutPersistence.ts'
import { WINDOW_DEFS } from '../windows/windowDefs.ts'
import { MapPanel } from '../panels/MapPanel.tsx'
import {
  EinsatzlistePanel,
  FunkfeldPanel,
  ProtokollPanel,
  RessourcenPanel,
} from '../panels/StubPanels.tsx'
import './game-page.css'

function defaultRects(): Record<WindowId, WindowRect> {
  const w = Math.max(window.innerWidth, 1024)
  const h = Math.max(window.innerHeight - 90, 560) // minus footer+taskbar
  return {
    karte: { x: 8, y: 8, w: Math.round(w * 0.55), h: h - 16 },
    einsatzliste: { x: Math.round(w * 0.56), y: 8, w: Math.round(w * 0.43), h: Math.round(h * 0.3) },
    ressourcen: {
      x: Math.round(w * 0.56),
      y: Math.round(h * 0.32) + 8,
      w: Math.round(w * 0.43),
      h: Math.round(h * 0.36),
    },
    funk: {
      x: Math.round(w * 0.56),
      y: Math.round(h * 0.7) + 16,
      w: Math.round(w * 0.21),
      h: Math.round(h * 0.27),
    },
    protokoll: {
      x: Math.round(w * 0.78),
      y: Math.round(h * 0.7) + 16,
      w: Math.round(w * 0.21),
      h: Math.round(h * 0.27),
    },
    anrufe: { x: 40, y: 40, w: 360, h: 320 },
    abfrage: { x: 420, y: 40, w: 460, h: 480 },
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
    for (const def of WINDOW_DEFS) register(def.id, rects[def.id], true)
  }

  useEffect(() => {
    void restoreLayout()
    const stop = startLayoutAutosave()
    return stop
  }, [])

  return (
    <div className="game-page">
      <div className="window-workspace">
        <WindowFrame id="karte" title="Lagekarte">
          <MapPanel />
        </WindowFrame>
        <WindowFrame id="einsatzliste" title="Einsatzliste">
          <EinsatzlistePanel />
        </WindowFrame>
        <WindowFrame id="ressourcen" title="Ressourcen">
          <RessourcenPanel />
        </WindowFrame>
        <WindowFrame id="funk" title="Funkfeld">
          <FunkfeldPanel />
        </WindowFrame>
        <WindowFrame id="protokoll" title="Protokoll">
          <ProtokollPanel />
        </WindowFrame>
      </div>
      <Taskbar defs={WINDOW_DEFS} />
    </div>
  )
}
