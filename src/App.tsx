import './styles/fonts.css'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell, LoadingScreen } from './shell/AppShell.tsx'
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
            <Suspense fallback={<LoadingScreen hint="Leitstelle wird geladen…" />}>
              <GamePage />
            </Suspense>
          }
        />
        <Route
          path="editor"
          element={
            <Suspense fallback={<LoadingScreen hint="Editor wird geladen…" />}>
              <EditorPage />
            </Suspense>
          }
        />
        <Route
          path="debug/data"
          element={
            <Suspense fallback={<LoadingScreen hint="Daten werden geladen…" />}>
              <DataBrowser />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
