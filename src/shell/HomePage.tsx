import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useGameStore,
  type Difficulty,
  type GameMode,
  type PlayerRole,
} from '../state/gameStore.ts'
import { resetWorld } from '../state/simulation.ts'
import type { Region } from '../data/schemas.ts'
import './home.css'

const MONTHS = [
  { value: 1, label: 'Jänner (Winter, Skisaison)' },
  { value: 4, label: 'April (Übergang)' },
  { value: 6, label: 'Juni (Sommer)' },
  { value: 8, label: 'August (Hochsommer, Tourismus)' },
  { value: 12, label: 'Dezember (Winter, Advent)' },
]

export function HomePage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState<Region>('NORD')
  const [mode, setMode] = useState<GameMode>('schicht')
  const [difficulty, setDifficulty] = useState<Difficulty>('realistisch')
  const [role, setRole] = useState<PlayerRole>('voll')
  const [month, setMonth] = useState(6)
  const [startHour, setStartHour] = useState(7)

  const start = async () => {
    await resetWorld()
    useGameStore.getState().startShift({
      region,
      mode,
      difficulty,
      role,
      month,
      startHour,
      startWeekday: 1,
    })
    navigate('/spiel')
  }

  return (
    <div className="home">
      <h1 className="home-title">RLS-SIM Salzburg</h1>
      <p className="home-subtitle">Rettungsleitstellen-Simulator</p>

      <div className="menu-card" data-testid="hauptmenue">
        <div className="menu-row" role="radiogroup" aria-label="Leitstelle">
          <span className="menu-label">Leitstelle</span>
          <button
            className={region === 'NORD' ? 'menu-active' : ''}
            onClick={() => setRegion('NORD')}
          >
            NORD — Salzburg Stadt
          </button>
          <button
            className={region === 'SUED' ? 'menu-active' : ''}
            onClick={() => setRegion('SUED')}
          >
            SÜD — Zell am See
          </button>
        </div>

        <div className="menu-row" role="radiogroup" aria-label="Modus">
          <span className="menu-label">Modus</span>
          <button className={mode === 'schicht' ? 'menu-active' : ''} onClick={() => setMode('schicht')}>
            8h-Schicht
          </button>
          <button className={mode === 'endlos' ? 'menu-active' : ''} onClick={() => setMode('endlos')}>
            Endlos
          </button>
        </div>

        <div className="menu-row" role="radiogroup" aria-label="Rolle">
          <span className="menu-label">Rolle</span>
          <button className={role === 'voll' ? 'menu-active' : ''} onClick={() => setRole('voll')}>
            Vollbetrieb
          </button>
          <button
            className={role === 'calltaker' ? 'menu-active' : ''}
            onClick={() => setRole('calltaker')}
            title="Du nimmst Notrufe an, der KI-Disponent alarmiert."
          >
            Calltaker (KI disponiert)
          </button>
          <button
            className={role === 'disponent' ? 'menu-active' : ''}
            onClick={() => setRole('disponent')}
            title="Der KI-Calltaker erzeugt Aufträge, du disponierst."
          >
            Disponent (KI nimmt an)
          </button>
        </div>

        <div className="menu-row" role="radiogroup" aria-label="Schwierigkeit">
          <span className="menu-label">Schwierigkeit</span>
          <button
            className={difficulty === 'entspannt' ? 'menu-active' : ''}
            onClick={() => setDifficulty('entspannt')}
          >
            Entspannt
          </button>
          <button
            className={difficulty === 'realistisch' ? 'menu-active' : ''}
            onClick={() => setDifficulty('realistisch')}
          >
            Realistisch
          </button>
          <button
            className={difficulty === 'albtraum' ? 'menu-active' : ''}
            onClick={() => setDifficulty('albtraum')}
          >
            Albtraum
          </button>
        </div>

        <div className="menu-row">
          <span className="menu-label">Jahreszeit</span>
          <select aria-label="Monat" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="menu-label">Beginn</span>
          <select
            aria-label="Schichtbeginn"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
          >
            <option value={7}>07:00 (Tagschicht)</option>
            <option value={19}>19:00 (Nachtschicht)</option>
          </select>
        </div>

        <button className="home-start" data-testid="schicht-starten" onClick={() => void start()}>
          Schicht starten
        </button>
      </div>
    </div>
  )
}
