import { collectData, mergeData, writeData, type BackupData } from './backup'
import { SYNC_LOCAL_KEYS } from './merge'
import { normalizeBackupData } from './migrate'

const PASS_KEY = 'level-b-sync-pass'
const LAST_KEY = 'level-b-sync-last'
const MIN_PASS = 8

// Drop device-local keys (the live session) so syncing can never resurrect a
// finished session pulled from another device.
function forSync(data: BackupData): BackupData {
  const local: Record<string, string> = {}
  for (const key of SYNC_LOCAL_KEYS) {
    if (data.local[key] != null) local[key] = data.local[key]
  }
  return { ...data, local }
}

export function getSyncPass(): string {
  return localStorage.getItem(PASS_KEY) ?? ''
}

export function setSyncPass(passphrase: string): void {
  if (passphrase) localStorage.setItem(PASS_KEY, passphrase)
  else localStorage.removeItem(PASS_KEY)
}

export function isSyncEnabled(): boolean {
  return getSyncPass().length >= MIN_PASS
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_KEY)
}

/** Human-readable "x ago" for the last successful sync, or a prompt if never. */
export function syncStatusLabel(): string {
  if (!isSyncEnabled()) return '尚未設定 — 進度沒有備份到雲端。'
  const last = getLastSync()
  if (!last) return '已設定通關密語，但尚未同步。'
  const mins = Math.floor((Date.now() - new Date(last).getTime()) / 60000)
  if (mins < 1) return '剛剛同步完成。'
  if (mins < 60) return `上次同步：${mins} 分鐘前。`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `上次同步：${hours} 小時前。`
  return `上次同步：${Math.floor(hours / 24)} 天前。`
}

/**
 * Pull the cloud copy, merge it with local data, save the merge locally, and
 * push the merged result back. Safe to call on load and after each session.
 * Returns whether a remote copy existed.
 *
 * `name` scopes the cloud record alongside the passphrase (see
 * functions/api/sync.js): a short, easy-to-type passphrase collides across
 * strangers, and a collision here silently merges two people's exam history
 * with no warning. Callers should pass the profile name from onboarding
 * (`PROFILE_NAME_KEY`) — this module stays storage-only and does not read it
 * itself.
 */
export async function syncNow(name: string): Promise<{ hadRemote: boolean }> {
  const pass = getSyncPass()
  if (pass.length < MIN_PASS) throw new Error(`請先設定至少 ${MIN_PASS} 個字元的同步通關密語。`)

  // Pull → merge → push, retrying on a version conflict so a concurrent device's
  // write is merged in rather than overwritten.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pull = await fetch('/api/sync', { headers: { 'x-sync-pass': pass, 'x-sync-name': name } })
    if (!pull.ok) {
      const detail = await pull.json().catch(() => null) as { error?: string } | null
      throw new Error(detail?.error ?? '目前無法同步；同步只在正式網址上可用。')
    }
    const { version, data: remote } = await pull.json() as { version: number; data: BackupData | null }

    // Sanitize BOTH sides so a stale session in either copy can never be restored,
    // and normalize both to namespaced question keys so a cloud copy written by an
    // un-migrated device merges (and dedupes) with migrated local data.
    const merged = mergeData(normalizeBackupData(forSync(await collectData())), remote ? normalizeBackupData(forSync(remote)) : null)
    await writeData(merged)

    const push = await fetch('/api/sync', {
      method: 'PUT',
      headers: { 'x-sync-pass': pass, 'x-sync-name': name, 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseVersion: version, data: merged }),
    })
    if (push.ok) {
      localStorage.setItem(LAST_KEY, new Date().toISOString())
      return { hadRemote: !!remote }
    }
    if (push.status === 409) continue // another device wrote first; re-pull and re-merge
    const detail = await push.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? '無法儲存到雲端。')
  }
  throw new Error('同步一直和另一台裝置衝突，請再試一次。')
}
