import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { createProgress, type Progress } from '../domain/studyEngine'
import type { AttemptRecord, ExplanationRecord, SessionResult } from './db'
import type { BackupData } from './merge'
import { mergeData } from './merge'
import {
  LEGACY_EXAM_ID,
  migrateTablesToQuestionKeys,
  namespaceExplanationKey,
  namespaceQuestionId,
  normalizeBackupData,
} from './migrate'

// The storage layer touches localStorage (backup/export key lists); vitest runs
// in node, so provide a minimal stub before ./backup is imported.
beforeAll(() => {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size },
  } as Storage
})

type TestDb = Dexie & {
  progress: Dexie.Table<Progress, string>
  attempts: Dexie.Table<AttemptRecord, number>
  explanations: Dexie.Table<ExplanationRecord, string>
  results: Dexie.Table<SessionResult, number>
}

// Mirror the schema history in db.ts, stopping at v2 (pre-migration).
function openV2(name: string): TestDb {
  const db = new Dexie(name) as TestDb
  db.version(1).stores({
    progress: 'questionId, nextReviewAt, wrong, attempts, bookmarked',
    attempts: '++id, questionId, answeredAt, correct, mode',
    explanations: 'questionId, updatedAt',
  })
  db.version(2).stores({ results: '++id, finishedAt, mode' })
  return db
}

function openV3(name: string): TestDb {
  const db = openV2(name)
  db.version(3).upgrade((tx) => migrateTablesToQuestionKeys(tx))
  return db
}

function attempt(questionId: string, answeredAt: string): AttemptRecord {
  return { questionId, selected: [1], correct: true, guessed: false, elapsedMs: 1000, answeredAt, mode: 'random' }
}

describe('dexie v3 upgrade', () => {
  it('rewrites bare ids to namespaced keys without losing data', async () => {
    const name = 'migrate-test-basic'
    const v2 = openV2(name)
    await v2.progress.bulkPut([
      { ...createProgress('17300-01-001'), attempts: 3, correct: 2, wrong: 1, bookmarked: true, note: 'tricky' },
      { ...createProgress('90006-01-050'), attempts: 1, correct: 1 },
    ])
    await v2.attempts.bulkAdd([
      attempt('17300-01-001', '2026-07-01T00:00:00.000Z'),
      attempt('90006-01-050', '2026-07-02T00:00:00.000Z'),
    ])
    await v2.explanations.bulkPut([
      { questionId: '17300-01-001::default::1::a¦b::v17', content: 'because', provider: 'ai', updatedAt: '2026-07-01T00:00:00.000Z' },
      { questionId: '17300-01-001', content: 'plain', provider: 'ai', updatedAt: '2026-07-01T00:00:00.000Z' },
    ])
    await v2.results.add({ sessionId: 's1', mode: 'mock', title: 'Official mock', finishedAt: '2026-07-01T01:00:00.000Z', answered: 80, correct: 60, score: 70, maxScore: 100, passed: true, durationMs: 1 })
    v2.close()

    const v3 = openV3(name)
    const progress = await v3.progress.toArray()
    expect(progress.map((row) => row.questionId).sort()).toEqual([
      'web-design-b:17300-01-001',
      'web-design-b:90006-01-050',
    ])
    const migrated = progress.find((row) => row.questionId.endsWith('17300-01-001'))
    expect(migrated).toMatchObject({ attempts: 3, correct: 2, wrong: 1, bookmarked: true, note: 'tricky' })

    const attempts = await v3.attempts.toArray()
    expect(attempts.map((row) => row.id)).toEqual([1, 2]) // auto-increment ids survive
    expect(attempts.map((row) => row.questionId).sort()).toEqual([
      'web-design-b:17300-01-001',
      'web-design-b:90006-01-050',
    ])

    const explanationKeys = (await v3.explanations.toArray()).map((row) => row.questionId).sort()
    expect(explanationKeys).toEqual([
      'web-design-b:17300-01-001',
      'web-design-b:17300-01-001::default::1::a¦b::v17',
    ])

    expect(await v3.results.count()).toBe(1)
    v3.close()
  })

  it('handles a partially-namespaced state without double-prefixing or duplicating', async () => {
    const name = 'migrate-test-mixed'
    const v2 = openV2(name)
    // A bare row and its namespaced twin (e.g. restored from a mixed backup).
    await v2.progress.bulkPut([
      { ...createProgress('17300-01-001'), attempts: 2 },
      { ...createProgress('web-design-b:17300-01-001'), attempts: 5 },
      { ...createProgress('web-design-b:90006-01-050'), attempts: 1 },
    ])
    await v2.attempts.bulkAdd([
      attempt('17300-01-001', '2026-07-01T00:00:00.000Z'),
      attempt('web-design-b:17300-01-001', '2026-07-03T00:00:00.000Z'),
    ])
    await v2.explanations.put({ questionId: 'web-design-b:17300-01-001::cue::::a::v17', content: 'cached', provider: 'ai', updatedAt: '2026-07-01T00:00:00.000Z' })
    v2.close()

    const v3 = openV3(name)
    const progressKeys = (await v3.progress.toArray()).map((row) => row.questionId).sort()
    expect(progressKeys).toEqual(['web-design-b:17300-01-001', 'web-design-b:90006-01-050'])
    const attemptKeys = (await v3.attempts.toArray()).map((row) => row.questionId)
    expect(attemptKeys).toEqual(['web-design-b:17300-01-001', 'web-design-b:17300-01-001'])
    expect((await v3.explanations.toArray()).map((row) => row.questionId)).toEqual([
      'web-design-b:17300-01-001::cue::::a::v17', // untouched — already namespaced
    ])
    for (const key of [...progressKeys, ...attemptKeys]) {
      expect(key).not.toContain('web-design-b:web-design-b:')
    }
    v3.close()
  })
})

describe('namespacing helpers', () => {
  it('namespaces bare ids and passes namespaced keys through', () => {
    expect(namespaceQuestionId('17300-01-001')).toBe('web-design-b:17300-01-001')
    expect(namespaceQuestionId('web-design-b:17300-01-001')).toBe('web-design-b:17300-01-001')
    expect(namespaceQuestionId('other-exam:x-1')).toBe('other-exam:x-1')
  })

  it('treats composite explanation keys by their id part, not by containing ":"', () => {
    expect(namespaceExplanationKey('17300-01-001::default::1::a¦b::v17'))
      .toBe('web-design-b:17300-01-001::default::1::a¦b::v17')
    expect(namespaceExplanationKey('web-design-b:17300-01-001::default::1::a¦b::v17'))
      .toBe('web-design-b:17300-01-001::default::1::a¦b::v17')
    expect(namespaceExplanationKey('17300-01-001')).toBe('web-design-b:17300-01-001')
  })
})

describe('normalizeBackupData', () => {
  const bare: BackupData = {
    progress: [createProgress('17300-01-001')],
    attempts: [attempt('17300-01-001', '2026-07-01T00:00:00.000Z')],
    results: [],
    explanations: [{ questionId: '17300-01-001::default::1::a::v17', content: 'x', provider: 'ai', updatedAt: '2026-07-01T00:00:00.000Z' }],
    local: {},
  }

  it('is idempotent', () => {
    const once = normalizeBackupData(bare)
    const twice = normalizeBackupData(once)
    expect(twice).toEqual(once)
    expect(once.progress[0].questionId).toBe('web-design-b:17300-01-001')
    expect(once.attempts[0].questionId).toBe('web-design-b:17300-01-001')
    expect(once.explanations[0].questionId).toBe('web-design-b:17300-01-001::default::1::a::v17')
  })

  it('keeps absent sections absent so writeData guards still apply', () => {
    const partial = { local: {} } as BackupData
    const normalized = normalizeBackupData(partial)
    expect(normalized.progress).toBeUndefined()
    expect(normalized.attempts).toBeUndefined()
    expect(normalized.explanations).toBeUndefined()
  })

  it('dedupes an old-device bare attempt against its namespaced twin in a merge', () => {
    const oldDevice: BackupData = {
      progress: [{ ...createProgress('17300-01-001'), bookmarked: true }],
      attempts: [attempt('17300-01-001', '2026-07-01T00:00:00.000Z')],
      results: [],
      explanations: [],
      local: {},
    }
    const migratedDevice: BackupData = {
      progress: [createProgress('web-design-b:17300-01-001')],
      attempts: [attempt('web-design-b:17300-01-001', '2026-07-01T00:00:00.000Z')],
      results: [],
      explanations: [],
      local: {},
    }
    const merged = mergeData(normalizeBackupData(migratedDevice), normalizeBackupData(oldDevice))
    expect(merged.attempts).toHaveLength(1)
    expect(merged.attempts[0].questionId).toBe('web-design-b:17300-01-001')
    expect(merged.progress).toHaveLength(1)
    expect(merged.progress[0].questionId).toBe('web-design-b:17300-01-001')
    expect(merged.progress[0].bookmarked).toBe(true) // snapshot-only data survives
  })

  it(`defaults the namespace to the legacy exam (${LEGACY_EXAM_ID})`, () => {
    expect(LEGACY_EXAM_ID).toBe('web-design-b')
  })
})

describe('backup round trip', () => {
  it('imports an old version-2 backup and normalizes it; exports version 3', async () => {
    // Imported lazily so the localStorage stub is installed first.
    const { exportBackup, importBackup } = await import('./backup')
    const { db } = await import('./db')

    const v2File = {
      app: 'level-b-study',
      version: 2,
      exportedAt: '2026-07-01T00:00:00.000Z',
      data: {
        progress: [{ ...createProgress('17300-01-001'), attempts: 1, correct: 1 }],
        attempts: [attempt('17300-01-001', '2026-07-01T00:00:00.000Z')],
        results: [],
        explanations: [],
      },
    }
    await importBackup(JSON.stringify(v2File))

    expect((await db.progress.toArray()).map((row) => row.questionId)).toEqual(['web-design-b:17300-01-001'])
    expect((await db.attempts.toArray()).map((row) => row.questionId)).toEqual(['web-design-b:17300-01-001'])

    const exported = JSON.parse(await exportBackup()) as { version: number; data: BackupData }
    expect(exported.version).toBe(3)
    expect(exported.data.progress[0].questionId).toBe('web-design-b:17300-01-001')
  })
})
