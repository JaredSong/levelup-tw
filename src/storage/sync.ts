import { collectData, mergeData, writeData, type BackupData } from './backup'

const PASS_KEY = 'level-b-sync-pass'

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
  return { hadRemote: !!remote }
}
