import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="home">
      <h1 className="home-title">RLS-SIM Salzburg</h1>
      <p className="home-subtitle">Rettungsleitstellen-Simulator</p>
      <Link className="home-start" to="/spiel">
        Leitstelle öffnen
      </Link>
    </div>
  )
}
