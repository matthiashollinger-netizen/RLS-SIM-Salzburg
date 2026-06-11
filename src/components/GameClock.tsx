import { useGameStore, type GameSpeed } from '../state/gameStore.ts'
import { formatGameTime } from '../lib/format.ts'
import { weekdayAt } from '../engine/time.ts'
import './game-clock.css'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const SPEEDS: GameSpeed[] = [0, 1, 2, 4]

export function GameClock() {
  const simSec = useGameStore((s) => s.simSec)
  const speed = useGameStore((s) => s.speed)
  const weather = useGameStore((s) => s.weather)
  const startWeekday = useGameStore((s) => s.startWeekday)
  const month = useGameStore((s) => s.month)
  const weekday = weekdayAt(simSec, { startWeekday, month })

  return (
    <div className="game-clock">
      <span className="game-clock-time mono" data-testid="game-clock">
        {WEEKDAYS[weekday - 1]} {formatGameTime(simSec)}
      </span>
      <div className="game-clock-speeds" role="group" aria-label="Spielgeschwindigkeit">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={speed === s ? 'speed-active' : ''}
            aria-pressed={speed === s}
            onClick={() => useGameStore.getState().setSpeed(s)}
          >
            {s === 0 ? '⏸' : `${s}×`}
          </button>
        ))}
      </div>
      <button
        className="weather-toggle"
        title={weather === 'gut' ? 'Wetter: gut (Heli fliegt)' : 'Wetter: schlecht (Heli no-go)'}
        aria-label="Wetter umschalten"
        onClick={() => useGameStore.getState().setWeather(weather === 'gut' ? 'schlecht' : 'gut')}
      >
        {weather === 'gut' ? '☀' : '⛈'}
      </button>
    </div>
  )
}
