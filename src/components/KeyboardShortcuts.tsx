import { useEffect, useState } from 'react'
import { useGameStore, type GameSpeed } from '../state/gameStore.ts'
import { jumpToNextEvent } from '../state/simulation.ts'
import { useCallStore } from '../state/callStore.ts'
import './keyboard-shortcuts.css'

/**
 * Global hotkeys (Award-Polish): a dispatcher works hands-on-keyboard.
 * Space pause/resume, 1/2/3 speeds, N jump-to-event, A answer the oldest
 * ringing call, ? overlay. Inputs/textareas/selects are never intercepted.
 */

const SHORTCUTS: [string, string][] = [
  ['Leertaste', 'Pause / Weiter'],
  ['1 / 2 / 3', 'Geschwindigkeit 1× / 2× / 4×'],
  ['N', 'Sprung zum nächsten Ereignis'],
  ['A', 'Ältesten Anruf annehmen'],
  ['?', 'Diese Übersicht'],
]

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    t.isContentEditable
  )
}

export function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const g = useGameStore.getState()
      switch (e.key) {
        case ' ':
          e.preventDefault()
          g.setSpeed(g.speed === 0 ? 1 : 0)
          break
        case '1':
        case '2':
        case '3': {
          const speed = ([1, 2, 4] as GameSpeed[])[Number(e.key) - 1]!
          g.setSpeed(speed)
          break
        }
        case 'n':
        case 'N':
          void jumpToNextEvent()
          break
        case 'a':
        case 'A': {
          const oldest = useCallStore.getState().queue[0]
          if (oldest) useCallStore.getState().answer(oldest.id)
          break
        }
        case '?':
          setShowHelp((s) => !s)
          break
        case 'Escape':
          setShowHelp(false)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!showHelp) return null
  return (
    <div className="shortcuts-overlay" role="dialog" aria-label="Tastaturkürzel" onClick={() => setShowHelp(false)}>
      <div className="shortcuts-card">
        <h3>Tastaturkürzel</h3>
        <table>
          <tbody>
            {SHORTCUTS.map(([key, desc]) => (
              <tr key={key}>
                <td className="mono shortcuts-key">{key}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
