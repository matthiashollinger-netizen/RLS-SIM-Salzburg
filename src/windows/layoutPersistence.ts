import { dbDelete, dbGet, dbKeys, dbSet } from '../persistence/db.ts'
import { useWindowStore, type Layout } from './windowStore.ts'

/** Autosaved layout key; named presets use their own keys. */
export const CURRENT_LAYOUT = 'current'

let saveTimer: ReturnType<typeof setTimeout> | undefined

function scheduleAutosave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void dbSet('layouts', CURRENT_LAYOUT, useWindowStore.getState().serializeLayout())
  }, 250)
}

/** Subscribe to window changes and autosave the current layout. Returns unsubscribe. */
export function startLayoutAutosave(): () => void {
  return useWindowStore.subscribe((state, prev) => {
    if (state.windows !== prev.windows) scheduleAutosave()
  })
}

export async function restoreLayout(name: string = CURRENT_LAYOUT): Promise<boolean> {
  const layout = await dbGet<Layout>('layouts', name)
  if (!layout) return false
  useWindowStore.getState().applyLayout(layout)
  return true
}

export async function savePreset(name: string): Promise<void> {
  await dbSet('layouts', name, useWindowStore.getState().serializeLayout())
}

export async function deletePreset(name: string): Promise<void> {
  await dbDelete('layouts', name)
}

export async function listPresets(): Promise<string[]> {
  const keys = await dbKeys('layouts')
  return keys.filter((k) => k !== CURRENT_LAYOUT).sort()
}
