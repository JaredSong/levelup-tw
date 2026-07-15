// Ask the browser not to evict the study log.
//
// Everything a learner has done lives in IndexedDB on their device, and browsers
// treat that as disposable cache by default: Safari clears it after ~7 days
// without a visit, and Chrome may evict under storage pressure. Neither warns.
// For an app whose whole promise is offline-first local data, that is the real
// data-loss risk — a sync banner nags about it, `persist()` actually prevents it.
//
// Granting is at the browser's discretion and mostly tracks engagement (an
// installed PWA, bookmarks, repeat visits), so this asks once there is progress
// worth keeping rather than on first paint, when it is likeliest to be refused.

/** Attempts before asking. Enough engagement for the browser to say yes, and enough progress for the answer to matter. */
export const PERSIST_AFTER_ATTEMPTS = 10

export type PersistenceState = 'persisted' | 'best-effort' | 'unsupported'

export async function getPersistenceState(): Promise<PersistenceState> {
  if (!navigator.storage?.persisted) return 'unsupported'
  return await navigator.storage.persisted() ? 'persisted' : 'best-effort'
}

/**
 * True when the browser has committed to keeping the data. Safe to call repeatedly:
 * it re-checks first, and a refusal is not final — engagement may change the answer
 * later, so a later call can still succeed.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist || !navigator.storage?.persisted) return false
  if (await navigator.storage.persisted()) return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Whether it is worth asking yet: no point spending the request before there is anything to lose. */
export function shouldRequestPersistence(attempts: number): boolean {
  return attempts >= PERSIST_AFTER_ATTEMPTS
}
