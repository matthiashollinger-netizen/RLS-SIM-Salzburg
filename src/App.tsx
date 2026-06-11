import { Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell.tsx'
import { HomePage } from './shell/HomePage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  )
}
