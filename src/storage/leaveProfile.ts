import { db } from './db'

const PERSONAL_KEYS = new Set([
  'level-up-profile-name',
  'level-up-onboarding-complete',
  'level-up-active-exam-id',
  'level-up-selected-exam-ids',
  'level-up-target-exam-date',
  'level-b-sync-pass',
  'level-b-sync-last',
  'level-b-active-session',
  'level-b-sequential-index',
])

const PERSONAL_KEY_PREFIXES = [
  'level-b-active-session:',
  'level-b-sequential-index:',
]

export async function clearCurrentProfile(storage: Storage = localStorage): Promise<void> {
  await db.transaction(
    'rw',
    [db.progress, db.attempts, db.results, db.explanations, db.reviewCards, db.reviewLogs],
    async () => {
      await Promise.all([
        db.progress.clear(),
        db.attempts.clear(),
        db.results.clear(),
        db.explanations.clear(),
        db.reviewCards.clear(),
        db.reviewLogs.clear(),
      ])
    },
  )

  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  for (const key of keys) {
    if (!key) continue
    if (PERSONAL_KEYS.has(key) || PERSONAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key)
    }
  }
}
