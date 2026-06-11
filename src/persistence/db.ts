import { openDB, type IDBPDatabase } from 'idb'

/**
 * IndexedDB persistence (idb). Stores:
 *  - layouts:  window layout presets (key = preset name, "current" = autosave)
 *  - settings: misc user settings
 *  - history:  shift reports (M8)
 */
const DB_NAME = 'rls-sim-salzburg'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('layouts')) db.createObjectStore('layouts')
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history')
      },
    })
  }
  return dbPromise
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await getDb()
    return (await db.get(store, key)) as T | undefined
  } catch {
    return undefined // private mode / unavailable IndexedDB must not break the game
  }
}

export async function dbSet(store: string, key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb()
    await db.put(store, value, key)
  } catch {
    // ignore — persistence is best-effort
  }
}

export async function dbDelete(store: string, key: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(store, key)
  } catch {
    // ignore
  }
}

export async function dbKeys(store: string): Promise<string[]> {
  try {
    const db = await getDb()
    return (await db.getAllKeys(store)) as string[]
  } catch {
    return []
  }
}
