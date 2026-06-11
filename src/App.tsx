import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell.tsx'
import { HomePage } from './shell/HomePage.tsx'

const GamePage = lazy(() =>
  import('./shell/GamePage.tsx').then((m) => ({ default: m.GamePage })),
)
const EditorPage = lazy(() =>
  import('./shell/EditorPage.tsx').then((m) => ({ default: m.EditorPage })),
)
const DataBrowser = lazy(() =>
  import('./debug/DataBrowser.tsx').then((m) => ({ default: m.DataBrowser })),
)

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route
          path="spiel"
          element={
            <Suspense fallback={<div className="route-loading">Leitstelle wird geladen…</div>}>
              <GamePage />
            </Suspense>
          }
        />
        <Route
          path="editor"
          element={
            <Suspense fallback={<div className="route-loading">Editor wird geladen…</div>}>
              <EditorPage />
            </Suspense>
          }
        />
        <Route
          path="debug/data"
          element={
            <Suspense fallback={<div className="route-loading">Daten werden geladen…</div>}>
              <DataBrowser />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
