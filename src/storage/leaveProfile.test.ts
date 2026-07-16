import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearCurrentProfile } from './leaveProfile'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('clearCurrentProfile', () => {
  let storage: Storage

  beforeEach(async () => {
    storage = memoryStorage()
    await db.open()
    await Promise.all([
      db.progress.clear(),
      db.attempts.clear(),
      db.results.clear(),
      db.explanations.clear(),
      db.reviewCards.clear(),
      db.reviewLogs.clear(),
    ])
  })

  it('removes learner data but preserves device appearance preferences', async () => {
    await db.progress.put({
      questionId: 'web-design-b:17300-01-001',
      attempts: 1,
      correct: 0,
      wrong: 1,
      guessed: 0,
      streak: 0,
      bookmarked: false,
      lastSelected: [2],
      lastAnsweredAt: '2026-07-16T00:00:00.000Z',
      nextReviewAt: '2026-07-16T00:00:00.000Z',
      totalElapsedMs: 1000,
      note: '',
    })
    storage.setItem('level-up-profile-name', '考生')
    storage.setItem('level-up-onboarding-complete', 'true')
    storage.setItem('level-up-active-exam-id', 'car-repair-c')
    storage.setItem('level-up-selected-exam-ids', '["car-repair-c"]')
    storage.setItem('level-up-target-exam-date', '2026-11-08')
    storage.setItem('level-b-sync-pass', 'AAAA-BBBB-CCCC')
    storage.setItem('level-b-sync-last', '2026-07-16T00:00:00.000Z')
    storage.setItem('level-b-active-session:car-repair-c', '{}')
    storage.setItem('level-b-sequential-index:car-repair-c', '42')
    storage.setItem('level-b-theme', 'dark')
    storage.setItem('level-b-randomize-options', 'false')

    await clearCurrentProfile(storage)

    expect(await db.progress.count()).toBe(0)
    expect(storage.getItem('level-up-profile-name')).toBeNull()
    expect(storage.getItem('level-up-onboarding-complete')).toBeNull()
    expect(storage.getItem('level-up-active-exam-id')).toBeNull()
    expect(storage.getItem('level-up-selected-exam-ids')).toBeNull()
    expect(storage.getItem('level-up-target-exam-date')).toBeNull()
    expect(storage.getItem('level-b-sync-pass')).toBeNull()
    expect(storage.getItem('level-b-sync-last')).toBeNull()
    expect(storage.getItem('level-b-active-session:car-repair-c')).toBeNull()
    expect(storage.getItem('level-b-sequential-index:car-repair-c')).toBeNull()
    expect(storage.getItem('level-b-theme')).toBe('dark')
    expect(storage.getItem('level-b-randomize-options')).toBe('false')
  })
})
