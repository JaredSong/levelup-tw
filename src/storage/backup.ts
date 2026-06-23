import { db } from './db'

// localStorage keys worth carrying between devices. The AI access token is
// intentionally excluded so backups never contain a secret.
const LOCAL_KEYS = ['level-b-active-session', 'level-b-sequential-index', 'level-b-ai-provider']

interface BackupFile {
  app: 'level-b-study'
  version: number
  exportedAt: string
  data: {
    progress: unknown[]
    attempts: unknown[]
    results: unknown[]
    explanations: unknown[]
    local: Record<string, string>
  }
}

export async function exportBackup(): Promise<string> {
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
  const file: BackupFile = {
    app: 'level-b-study',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: { progress, attempts, results, explanations, local },
  }
  return JSON.stringify(file, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json) as Partial<BackupFile>
  if (parsed.app !== 'level-b-study' || !parsed.data) {
    throw new Error('This file is not a Level B Study backup.')
  }
  const { progress, attempts, results, explanations, local } = parsed.data
  await db.transaction('rw', db.progress, db.attempts, db.results, db.explanations, async () => {
    if (progress) { await db.progress.clear(); await db.progress.bulkPut(progress as never) }
    if (attempts) { await db.attempts.clear(); await db.attempts.bulkPut(attempts as never) }
    if (results) { await db.results.clear(); await db.results.bulkPut(results as never) }
    if (explanations) { await db.explanations.clear(); await db.explanations.bulkPut(explanations as never) }
  })
  if (local) {
    for (const [key, value] of Object.entries(local)) {
      if (LOCAL_KEYS.includes(key)) localStorage.setItem(key, value)
    }
  }
}
