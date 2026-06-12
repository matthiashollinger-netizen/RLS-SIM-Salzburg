import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CHANGELOG } from '../data/changelog.ts'
import './shell.css'

// Rotating flavour lines for the branded route-loading screen (German per CLAUDE.md rule 7).
const LOADING_LINES = [
  'Funkkreis wird geöffnet…',
  'Fahrzeuge melden Status 00…',
  'Einsatzmittel werden geprüft…',
  'Karte wird kalibriert…',
  'Hilfsfrist-Uhren werden gestellt…',
] as const

// Stylized EKG trace: flat baseline with two QRS-like complexes.
const EKG_PATH =
  'M0 32 L54 32 L62 25 L68 32 L104 32 L112 32 L119 9 L129 53 L137 32 L190 32 L198 26 L204 32 L242 32 L250 32 L257 9 L267 53 L275 32 L320 32'

/** Branded Suspense fallback: wordmark + animated EKG line + rotating status lines. */
export function LoadingScreen({ hint }: { hint: string }) {
  const [lineIdx, setLineIdx] = useState(0)

  useEffect(() => {
    // JS-driven rotation pauses under prefers-reduced-motion (first line stays).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setLineIdx((i) => (i + 1) % LOADING_LINES.length)
    }, 1500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="route-loading loading-screen" role="status">
      <div className="loading-wordmark">
        RLS-SIM <span className="loading-wordmark-sub">Salzburg</span>
      </div>
      <svg className="loading-ekg" viewBox="0 0 320 60" aria-hidden="true">
        <path pathLength={100} d={EKG_PATH} />
      </svg>
      <div className="loading-hint">{hint}</div>
      <div className="loading-status" aria-hidden="true">
        {LOADING_LINES[lineIdx % LOADING_LINES.length] ?? ''}
      </div>
    </div>
  )
}

export function AppShell() {
  const [changelogOpen, setChangelogOpen] = useState(false)

  useEffect(() => {
    if (!changelogOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChangelogOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changelogOpen])

  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span className="app-footer-left">
          Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes.
          <span className="app-version-wrap">
            <button
              type="button"
              className="app-version"
              aria-expanded={changelogOpen}
              aria-haspopup="dialog"
              title="Änderungsprotokoll anzeigen"
              onClick={() => setChangelogOpen((o) => !o)}
            >
              v{__APP_VERSION__}
            </button>
            {changelogOpen && (
              <div className="changelog-popover" role="dialog" aria-label="Änderungsprotokoll">
                <div className="changelog-head">
                  <span className="changelog-title">Änderungsprotokoll</span>
                  <button
                    type="button"
                    className="changelog-close"
                    aria-label="Schließen"
                    onClick={() => setChangelogOpen(false)}
                  >
                    ×
                  </button>
                </div>
                {CHANGELOG.map((entry) => (
                  <section key={entry.phase} className="changelog-entry">
                    <h3>
                      {entry.titel} <span className="changelog-phase">{entry.phase}</span>
                    </h3>
                    <ul>
                      {entry.punkte.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </span>
        </span>
        <span className="app-footer-attribution">
          Kartendaten © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </span>
      </footer>
    </div>
  )
}
