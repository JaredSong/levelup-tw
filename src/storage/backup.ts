import { db } from './db'
import type { Progress } from '../domain/studyEngine'
import type { AttemptRecord, ExplanationRecord, SessionResult } from './db'

// localStorage keys worth carrying between devices. The AI access token and the
// sync passphrase are intentionally excluded so backups never contain a secret.
const LOCAL_KEYS = ['level-b-active-session', 'level-b-sequential-index', 'level-b-ai-provider']

export interface BackupData {
  progress: Progress[]
  attempts: AttemptRecord[]
  results: SessionResult[]
  explanations: ExplanationRecord[]
  local: Record<string, string>
}

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

// Merge two snapshots without losing data from either side. `local` wins ties
// for device-specific keys (active session, provider choice).
export function mergeData(local: BackupData, remote: BackupData | null): BackupData {
  if (!remote) return local

  const attempts = new Map<string, AttemptRecord>()
  for (const a of [...(remote.attempts ?? []), ...(local.attempts ?? [])]) {
    attempts.set(`${a.questionId}|${a.answeredAt}`, a)
  }

  const results = new Map<string, SessionResult>()
  for (const r of [...(remote.results ?? []), ...(local.results ?? [])]) {
    results.set(r.sessionId, r)
  }

  const progress = new Map<string, Progress>()
  for (const p of [...(remote.progress ?? []), ...(local.progress ?? [])]) {
    const existing = progress.get(p.questionId)
    // Keep the more-practiced record; OR the bookmarked flag so a bookmark on
    // either device survives.
    if (!existing || (p.attempts ?? 0) >= (existing.attempts ?? 0)) {
      progress.set(p.questionId, { ...p, bookmarked: !!(existing?.bookmarked || p.bookmarked) })
    } else {
      progress.set(p.questionId, { ...existing, bookmarked: !!(existing.bookmarked || p.bookmarked) })
    }
  }

  const explanations = new Map<string, ExplanationRecord>()
  for (const e of [...(remote.explanations ?? []), ...(local.explanations ?? [])]) {
    const existing = explanations.get(e.questionId)
    if (!existing || new Date(e.updatedAt) >= new Date(existing.updatedAt)) explanations.set(e.questionId, e)
  }

  const merged: BackupData = {
    progress: [...progress.values()],
    attempts: [...attempts.values()],
    results: [...results.values()],
    explanations: [...explanations.values()],
    local: { ...(remote.local ?? {}), ...(local.local ?? {}) },
  }
  // Sequential reading position: keep the furthest one reached.
  const furthest = Math.max(
    Number(remote.local?.['level-b-sequential-index'] ?? 0),
    Number(local.local?.['level-b-sequential-index'] ?? 0),
  )
  if (furthest) merged.local['level-b-sequential-index'] = String(furthest)
  return merged
}

export async function exportBackup(): Promise<string> {
  const file: BackupFile = {
    app: 'level-b-study',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: await collectData(),
  }
  return JSON.stringify(file, null, 2)
}

export async function importBackup(json: string): Promise<void> {
  const parsed = JSON.parse(json) as Partial<BackupFile>
  if (parsed.app !== 'level-b-study' || !parsed.data) {
    throw new Error('This file is not a Level B Study backup.')
  }
  await writeData(parsed.data as BackupData)
}
