import { collectData, mergeData, writeData, type BackupData } from './backup'

const PASS_KEY = 'level-b-sync-pass'
const LAST_KEY = 'level-b-sync-last'

export function getSyncPass(): string {
  return localStorage.getItem(PASS_KEY) ?? ''
}

export function setSyncPass(passphrase: string): void {
  if (passphrase) localStorage.setItem(PASS_KEY, passphrase)
  else localStorage.removeItem(PASS_KEY)
}

export function isSyncEnabled(): boolean {
  return getSyncPass().length >= 6
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_KEY)
}

/** Human-readable "x ago" for the last successful sync, or a prompt if never. */
export function syncStatusLabel(): string {
  if (!isSyncEnabled()) return 'Not set — your progress is not backed up to the cloud.'
  const last = getLastSync()
  if (!last) return 'Passphrase set, but not synced yet.'
  const mins = Math.floor((Date.now() - new Date(last).getTime()) / 60000)
  if (mins < 1) return 'Last synced just now.'
  if (mins < 60) return `Last synced ${mins} min ago.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last synced ${hours} h ago.`
  return `Last synced ${Math.floor(hours / 24)} d ago.`
}

/**
 * Pull the cloud copy, merge it with local data, save the merge locally, and
 * push the merged result back. Safe to call on load and after each session.
 * Returns whether a remote copy existed.
 */
export async function syncNow(): Promise<{ hadRemote: boolean }> {
  const pass = getSyncPass()
  if (pass.length < 6) throw new Error('Set a sync passphrase of at least 6 characters first.')

  const pull = await fetch('/api/sync', { headers: { 'x-sync-pass': pass } })
  if (!pull.ok) {
    const detail = await pull.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? 'Sync is unavailable. It only works on the deployed site.')
  }
  const remote = (await pull.json() as { data: BackupData | null }).data

  const merged = mergeData(await collectData(), remote)
  await writeData(merged)

  const push = await fetch('/api/sync', {
    method: 'PUT',
    headers: { 'x-sync-pass': pass, 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  })
  if (!push.ok) {
    const detail = await push.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? 'Could not save to the cloud.')
  }
  localStorage.setItem(LAST_KEY, new Date().toISOString())
  return { hadRemote: !!remote }
}
