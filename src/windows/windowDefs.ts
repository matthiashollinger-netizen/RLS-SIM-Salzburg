import type { WindowId } from './windowStore.ts'

export interface WindowDef {
  id: WindowId
  title: string
}

/** GAME_DATA §12 — the dispatch workspace windows (M2 set, extended later) */
export const WINDOW_DEFS: WindowDef[] = [
  { id: 'karte', title: 'Lagekarte' },
  { id: 'einsatzliste', title: 'Einsatzliste' },
  { id: 'ressourcen', title: 'Ressourcen' },
  { id: 'funk', title: 'Funkfeld' },
  { id: 'protokoll', title: 'Protokoll' },
]
