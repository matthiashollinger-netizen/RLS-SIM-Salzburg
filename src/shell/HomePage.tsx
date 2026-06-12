import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useGameStore,
  type Difficulty,
  type GameMode,
  type PlayerRole,
} from '../state/gameStore.ts'
import { resetWorld } from '../state/simulation.ts'
import { useTutorialStore } from '../state/tutorialStore.ts'
import { uiTick } from '../audio/sounds.ts'
import type { Region } from '../data/schemas.ts'
import './home.css'

const MONTHS = [
  { value: 1, label: 'Jänner (Winter, Skisaison)' },
  { value: 4, label: 'April (Übergang)' },
  { value: 6, label: 'Juni (Sommer)' },
  { value: 8, label: 'August (Hochsommer, Tourismus)' },
  { value: 12, label: 'Dezember (Winter, Advent)' },
]

type StartKind = 'schicht' | 'tutorial' | 'coop'

// Duration of the .home fade-out (matches --t-normal-ish exit in home.css).
const FADE_OUT_MS = 320

/** Resolves after the menu fade-out has played (instant under reduced motion). */
function fadeOutDelay(): Promise<void> {
  const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : FADE_OUT_MS
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// Decorative dispatch-grid dots (status colors, staggered pulse). Coordinates
// live in the 1200x800 viewBox of the background SVG.
const SCENE_DOTS: ReadonlyArray<{ cx: number; cy: number; token: string; delay: string }> = [
  { cx: 245, cy: 195, token: '--status-00', delay: '0s' },
  { cx: 905, cy: 160, token: '--status-2', delay: '0.5s' },
  { cx: 1050, cy: 420, token: '--status-00', delay: '1.1s' },
  { cx: 150, cy: 510, token: '--status-88', delay: '1.7s' },
  { cx: 700, cy: 640, token: '--status-3', delay: '0.9s' },
  { cx: 420, cy: 110, token: '--status-6', delay: '2.2s' },
  { cx: 980, cy: 660, token: '--status-00', delay: '1.4s' },
  { cx: 330, cy: 690, token: '--status-4', delay: '2.6s' },
  { cx: 560, cy: 250, token: '--status-88', delay: '0.3s' },
  { cx: 800, cy: 330, token: '--status-2', delay: '1.9s' },
  { cx: 120, cy: 130, token: '--status-00', delay: '2.9s' },
  { cx: 1110, cy: 220, token: '--status-3', delay: '0.7s' },
]

/** Animated "Leitstelle wird verbunden…" label for pending start buttons. */
function PendingLabel() {
  return (
    <span className="pending-label">
      Leitstelle wird verbunden
      <span className="pending-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  )
}

/** Decorative menu backdrop: grid, radar rings, pulsing status dots, sweep, vignette. */
function HomeScene() {
  return (
    <div className="home-scene" aria-hidden="true">
      <div className="home-grid-lines" />
      <svg
        className="home-radar"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g className="radar-rings" fill="none" stroke="var(--border-subtle)" strokeWidth="1">
          <circle cx="600" cy="400" r="150" />
          <circle cx="600" cy="400" r="290" />
          <circle cx="600" cy="400" r="430" />
          <circle cx="600" cy="400" r="570" />
          <line x1="0" y1="400" x2="1200" y2="400" />
          <line x1="600" y1="0" x2="600" y2="800" />
        </g>
        {SCENE_DOTS.map((d) => (
          <circle
            key={`${d.cx}-${d.cy}`}
            className="scene-dot"
            cx={d.cx}
            cy={d.cy}
            r="4"
            fill={`var(${d.token})`}
            style={{ animationDelay: d.delay }}
          />
        ))}
      </svg>
      <div className="home-sweep" />
      <div className="home-vignette" />
    </div>
  )
}

/** Helper for the staggered entrance delay (`--i` consumed in home.css). */
const enter = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties

export function HomePage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState<Region>('NORD')
  const [mode, setMode] = useState<GameMode>('schicht')
  const [difficulty, setDifficulty] = useState<Difficulty>('realistisch')
  const [role, setRole] = useState<PlayerRole>('voll')
  const [month, setMonth] = useState(6)
  const [startHour, setStartHour] = useState(7)
  const [starting, setStarting] = useState<StartKind | null>(null)

  // Warm up the heavy lazy chunks while the user reads the menu: the GamePage
  // route module and the map library (own chunk via vite manualChunks).
  useEffect(() => {
    void import('./GamePage.tsx')
    void import('maplibre-gl')
  }, [])

  const pick = (apply: () => void) => () => {
    uiTick()
    apply()
  }

  const start = async (kind: StartKind = 'schicht') => {
    if (starting) return
    setStarting(kind)
    await Promise.all([resetWorld(), fadeOutDelay()])
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

  // Coop (M9/Rework 2 point 11): start a shift and open the connection dialog
  const startCoop = async () => {
    if (starting) return
    const { useCoopStore } = await import('../state/coopStore.ts')
    useCoopStore.getState().requestDialog()
    await start('coop')
  }

  const startTutorial = async () => {
    if (starting) return
    setStarting('tutorial')
    await Promise.all([resetWorld(), fadeOutDelay()])
    useGameStore.getState().startShift({
      region: 'NORD',
      mode: 'endlos',
      difficulty: 'entspannt',
      role: 'voll',
      month: 6,
      startHour: 8,
      startWeekday: 1,
    })
    useGameStore.getState().setCallsEnabled(false) // only the guided call
    useTutorialStore.getState().start()
    navigate('/spiel')
  }

  return (
    <div className={starting ? 'home home-leaving' : 'home'}>
      <HomeScene />
      <h1 className="home-title" style={enter(0)}>
        RLS-SIM Salzburg
      </h1>
      <p className="home-subtitle" style={enter(1)}>
        Rettungsleitstellen-Simulator
      </p>

      <div className="menu-card" data-testid="hauptmenue">
        <div className="menu-row" role="group" aria-label="Leitstelle" style={enter(2)}>
          <span className="menu-label">Leitstelle</span>
          <button
            className={region === 'NORD' ? 'menu-active' : ''}
            aria-pressed={region === 'NORD'}
            onClick={pick(() => setRegion('NORD'))}
          >
            NORD — Salzburg Stadt
          </button>
          <button
            className={region === 'SUED' ? 'menu-active' : ''}
            aria-pressed={region === 'SUED'}
            onClick={pick(() => setRegion('SUED'))}
          >
            SÜD — Zell am See
          </button>
        </div>

        <div className="menu-row" role="group" aria-label="Modus" style={enter(3)}>
          <span className="menu-label">Modus</span>
          <button
            className={mode === 'schicht' ? 'menu-active' : ''}
            aria-pressed={mode === 'schicht'}
            onClick={pick(() => setMode('schicht'))}
          >
            8h-Schicht
          </button>
          <button
            className={mode === 'endlos' ? 'menu-active' : ''}
            aria-pressed={mode === 'endlos'}
            onClick={pick(() => setMode('endlos'))}
          >
            Endlos
          </button>
        </div>

        <div className="menu-row" role="group" aria-label="Rolle" style={enter(4)}>
          <span className="menu-label">Rolle</span>
          <button
            className={role === 'voll' ? 'menu-active' : ''}
            aria-pressed={role === 'voll'}
            onClick={pick(() => setRole('voll'))}
          >
            Vollbetrieb
          </button>
          <button
            className={role === 'calltaker' ? 'menu-active' : ''}
            aria-pressed={role === 'calltaker'}
            onClick={pick(() => setRole('calltaker'))}
            title="Du nimmst Notrufe an, der KI-Disponent alarmiert."
          >
            Calltaker (KI disponiert)
          </button>
          <button
            className={role === 'disponent' ? 'menu-active' : ''}
            aria-pressed={role === 'disponent'}
            onClick={pick(() => setRole('disponent'))}
            title="Der KI-Calltaker erzeugt Aufträge, du disponierst."
          >
            Disponent (KI nimmt an)
          </button>
        </div>

        <div className="menu-row" role="group" aria-label="Schwierigkeit" style={enter(5)}>
          <span className="menu-label">Schwierigkeit</span>
          <button
            className={difficulty === 'entspannt' ? 'menu-active' : ''}
            aria-pressed={difficulty === 'entspannt'}
            onClick={pick(() => setDifficulty('entspannt'))}
          >
            Entspannt
          </button>
          <button
            className={difficulty === 'realistisch' ? 'menu-active' : ''}
            aria-pressed={difficulty === 'realistisch'}
            onClick={pick(() => setDifficulty('realistisch'))}
          >
            Realistisch
          </button>
          <button
            className={difficulty === 'albtraum' ? 'menu-active' : ''}
            aria-pressed={difficulty === 'albtraum'}
            onClick={pick(() => setDifficulty('albtraum'))}
          >
            Albtraum
          </button>
        </div>

        <div className="menu-row" style={enter(6)}>
          <span className="menu-label">Jahreszeit</span>
          <select
            aria-label="Monat"
            value={month}
            onChange={(e) => {
              uiTick()
              setMonth(Number(e.target.value))
            }}
          >
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
            onChange={(e) => {
              uiTick()
              setStartHour(Number(e.target.value))
            }}
          >
            <option value={7}>07:00 (Tagschicht)</option>
            <option value={19}>19:00 (Nachtschicht)</option>
          </select>
        </div>

        <button
          className={starting === 'schicht' ? 'home-start is-pending' : 'home-start'}
          data-testid="schicht-starten"
          disabled={starting !== null}
          style={enter(7)}
          onClick={() => void start('schicht')}
        >
          {starting === 'schicht' ? <PendingLabel /> : 'Schicht starten'}
        </button>

        <div className="menu-secondary" style={enter(8)}>
          <button
            data-testid="tutorial-starten"
            className={starting === 'tutorial' ? 'is-pending' : ''}
            disabled={starting !== null}
            onClick={() => void startTutorial()}
          >
            {starting === 'tutorial' ? <PendingLabel /> : 'Tutorial (geführte erste Schicht)'}
          </button>
          <button
            disabled={starting !== null}
            onClick={() => {
              uiTick()
              navigate('/editor')
            }}
          >
            Szenario-Editor
          </button>
          <button
            data-testid="coop-starten"
            className={starting === 'coop' ? 'is-pending' : ''}
            disabled={starting !== null}
            title="Zu zweit spielen: Rollensplit Calltaker/Disponent (Host simuliert)"
            onClick={() => void startCoop()}
          >
            {starting === 'coop' ? <PendingLabel /> : 'Coop (2 Spieler)'}
          </button>
        </div>
      </div>
    </div>
  )
}
