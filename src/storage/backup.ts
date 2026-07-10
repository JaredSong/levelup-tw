import { db } from './db'
import type { BackupData } from './merge'
import { normalizeBackupData } from './migrate'

export { mergeData, type BackupData } from './merge'

// localStorage keys worth carrying in a full export. The AI access token and the
// sync passphrase are intentionally excluded so backups never contain a secret.
const LOCAL_KEYS = ['level-b-active-session', 'level-b-sequential-index', 'level-b-ai-provider']

interface BackupFile {
  app: 'level-b-study'
  version: number
  exportedAt: string
  data: BackupData
}

function withoutId<T extends { id?: number }>(record: T): Omit<T, 'id'> {
  const copy = { ...record }
  delete copy.id
  return copy
}

// Snapshot everything currently in this browser.
export async function collectData(): Promise<BackupData> {
  const [progress, attempts, results, explanations] = await Promise.all([
    db.progress.toArray(),
    db.attempts.toArray(),
    db.results.toArray(),
    db.explanations.toArray(),
  ])
  const local: Record<string, string> = {}
  for (const key of LOCAL_KEYS) {
    const value = localStorage.getItem(key)
    if (value != null) local[key] = value
  }
  return { progress, attempts, results, explanations, local }
}

// Replace this browser's data with the given snapshot.
export async function writeData(data: BackupData): Promise<void> {
  await db.transaction('rw', db.progress, db.attempts, db.results, db.explanations, async () => {
    if (data.progress) { await db.progress.clear(); await db.progress.bulkPut(data.progress) }
    // attempts/results use auto-increment ids; strip them so merged rows re-key cleanly.
    if (data.attempts) { await db.attempts.clear(); await db.attempts.bulkAdd(data.attempts.map(withoutId)) }
    if (data.results) { await db.results.clear(); await db.results.bulkAdd(data.results.map(withoutId)) }
    if (data.explanations) { await db.explanations.clear(); await db.explanations.bulkPut(data.explanations) }
  })
  if (data.local) {
    for (const [key, value] of Object.entries(data.local)) {
      if (LOCAL_KEYS.includes(key)) localStorage.setItem(key, value)
    }
  }
}

export async function exportBackup(): Promise<string> {
  const file: BackupFile = {
    app: 'level-b-study',
    // v3 backups store namespaced question keys ("web-design-b:17300-01-001").
    version: 3,
    exportedAt: new Date().toISOString(),
    data: await collectData(),
  }
  return JSON.stringify(file, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json) as Partial<BackupFile>
  if (parsed.app !== 'level-b-study' || !parsed.data) {
    throw new Error('This file is not a Level Up backup.')
  }
  // Old (version <= 2) backups carry bare question ids; normalizing is idempotent,
  // so it is safe to apply to every import.
  await writeData(normalizeBackupData(parsed.data as BackupData))
}
