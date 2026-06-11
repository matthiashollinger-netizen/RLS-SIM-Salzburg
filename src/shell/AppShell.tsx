import { Outlet } from 'react-router-dom'
import './shell.css'

export function AppShell() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>
          Inoffizielle Simulation. Kein Produkt des Österreichischen Roten Kreuzes.
        </span>
        <span className="app-footer-attribution">
          Kartendaten © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </span>
      </footer>
    </div>
  )
}
