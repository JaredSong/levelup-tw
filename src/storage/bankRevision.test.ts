import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ReviewCard, ReviewLog } from '../core/contracts'
import { createProgress } from '../domain/studyEngine'
import { BANK_REVISIONS } from '../app/bankRevisions'
import { applyBankRevision, archivedExamId, BANK_REVISION_KEY, pendingRevisionIds, type BankRevision } from './bankRevision'
import type { BackupData } from './merge'

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

// 001 was reworded (retired); the old 003 is now numbered 001 (moved).
const REVISION: BankRevision = {
  id: 'r1',
  effectiveFrom: '2027-01-01',
  sets: { s: { retired: ['Q-01-001'], moved: [['Q-01-003', 'Q-01-001']] } },
  exams: { x: { sets: ['s'], kept: 1, moved: 1, retired: 1, added: 1, total: 3 } },
}

function card(key: string, examId: string): ReviewCard {
  return {
    id: `question:${key}`, schemaVersion: 1, profileId: 'local', examId, atomId: `question:${key}`, questionKeys: [key],
    prompt: 'p', answer: 'a', state: 'review', dueAt: '2026-01-01T00:00:00Z', stability: 1, difficulty: 5,
    intervalDays: 1, reps: 1, lapses: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as ReviewCard
}
function log(cardId: string, examId: string): ReviewLog {
  return { id: `log-${cardId}`, profileId: 'local', cardId, examId, rating: 'good', reviewedAt: '2026-01-01T00:00:00Z', elapsedMs: 1, previousDueAt: '2026-01-01T00:00:00Z', nextDueAt: '2026-01-02T00:00:00Z' } as ReviewLog
}
const attempt = (questionId: string) => ({ id: 1, questionId, selected: [1], correct: false, guessed: false, elapsedMs: 1, answeredAt: '2026-01-01T00:00:00Z', mode: 'practice' })

function sample(): BackupData {
  return {
    progress: ['x:Q-01-001', 'x:Q-01-002', 'x:Q-01-003', 'y:Q-01-001'].map((key) => ({ ...createProgress(key), wrong: 1 })),
    attempts: [attempt('x:Q-01-001'), attempt('x:Q-01-003')],
    results: [],
    explanations: [{ questionId: 'x:Q-01-003::style::1::opts::v1', content: 'c', provider: 'p', updatedAt: 'now' }],
    reviewCards: [card('x:Q-01-001', 'x'), card('x:Q-01-003', 'x'), card('y:Q-01-001', 'y')],
    reviewLogs: [log('question:x:Q-01-001', 'x'), log('question:x:Q-01-003', 'x')],
    local: {},
  }
}

describe('applyBankRevision', () => {
  const { data, impact } = applyBankRevision(sample(), REVISION)
  const archive = archivedExamId('x', 'r1')

  it('archives a retired question instead of leaving it on the number that now holds a different question', () => {
    expect(data.progress.map((row) => row.questionId)).toEqual([`${archive}:Q-01-001`, 'x:Q-01-002', 'x:Q-01-001', 'y:Q-01-001'])
    expect(data.attempts.map((row) => row.questionId)).toEqual([`${archive}:Q-01-001`, 'x:Q-01-001'])
  })

  it('moves progress with a question that kept its content under a new number', () => {
    expect(data.explanations[0].questionId).toBe('x:Q-01-001::style::1::opts::v1')
    const moved = data.reviewCards!.find((c) => c.examId === 'x')!
    expect(moved).toMatchObject({ id: 'question:x:Q-01-001', atomId: 'question:x:Q-01-001', questionKeys: ['x:Q-01-001'] })
  })

  it('archives review cards and their logs together', () => {
    const archived = data.reviewCards!.find((c) => c.examId === archive)!
    expect(archived).toMatchObject({ id: `question:${archive}:Q-01-001`, questionKeys: [`${archive}:Q-01-001`] })
    expect(data.reviewLogs!.map((l) => [l.cardId, l.examId])).toEqual([
      [`question:${archive}:Q-01-001`, archive],
      ['question:x:Q-01-001', 'x'],
    ])
  })

  it('leaves other packs alone and leaves exactly one record per live key', () => {
    expect(data.progress.filter((row) => row.questionId === 'x:Q-01-001')).toHaveLength(1)
    expect(data.reviewCards!.find((c) => c.examId === 'y')).toEqual(sample().reviewCards![2])
  })

  it('reports per-pack impact and stamps the revision', () => {
    expect(impact).toEqual({ x: { archived: 1, moved: 1, added: 1 } })
    expect(data.local[BANK_REVISION_KEY]).toBe('r1')
  })
})

describe('pendingRevisionIds', () => {
  it('applies every revision to unmarked data, later ones only after a marker, none after an unknown (newer) marker', () => {
    expect(pendingRevisionIds(['a', 'b'], undefined)).toEqual(['a', 'b'])
    expect(pendingRevisionIds(['a', 'b'], 'a')).toEqual(['b'])
    expect(pendingRevisionIds(['a', 'b'], 'b')).toEqual([])
    expect(pendingRevisionIds(['a', 'b'], 'z')).toEqual([])
  })
})

describe('116-1 revision data', () => {
  it('only moves progress onto ids that exist in the shipped pack, one source per target', async () => {
    const revision = await BANK_REVISIONS[0].load()
    for (const [examId, exam] of Object.entries(revision.exams)) {
      const raw = JSON.parse(readFileSync(`public/data/exams/${examId}/questions.json`, 'utf8'))
      const ids = new Set((Array.isArray(raw) ? raw : raw.questions).map((q: { id: string }) => q.id))
      const moved = exam.sets.flatMap((id) => revision.sets[id].moved)
      const retired = new Set(exam.sets.flatMap((id) => revision.sets[id].retired))
      for (const [from, to] of moved) {
        expect(ids.has(to), `${examId}: ${from} → ${to}`).toBe(true)
        expect(retired.has(from)).toBe(false)
      }
      expect(new Set(moved.map(([, to]) => to)).size).toBe(moved.length)
    }
  })
})

describe('Dexie upgrade to v7', () => {
  it('rewrites an existing v6 database once, before the app reads it, and records the notice', async () => {
    const revision = await BANK_REVISIONS[0].load()
    const [from, to] = revision.sets['90006'].moved[0]
    const retired = revision.sets['90007'].retired[0]

    // Seed a v6 database as the live app would have left it.
    const old = new Dexie('level-b-study')
    old.version(6).stores({
      progress: 'questionId, nextReviewAt, wrong, attempts, bookmarked',
      attempts: '++id, questionId, answeredAt, correct, mode',
      explanations: 'questionId, updatedAt',
      results: '++id, examId, finishedAt, mode',
      reviewCards: 'id, examId, dueAt, state, *questionKeys',
      reviewLogs: 'id, cardId, examId, reviewedAt',
    })
    await old.table('progress').bulkPut([`web-design-b:${from}`, `web-design-b:${retired}`, 'web-design-b:17300-01-001'].map((key) => ({ ...createProgress(key), wrong: 2 })))
    await old.table('reviewCards').put(card(`web-design-b:${retired}`, 'web-design-b'))
    old.close()

    const { db, migrateBankRevisions } = await import('./db')
    const keys = (await db.progress.toArray()).map((row) => row.questionId).sort()
    const archive = archivedExamId('web-design-b', '116-1')
    expect(keys).toEqual([`${archive}:${retired}`, 'web-design-b:17300-01-001', `web-design-b:${to}`].sort())
    expect((await db.reviewCards.toArray())[0].examId).toBe(archive)
    // Every revision applies in order; the marker ends on the newest.
    expect((await db.meta.get(BANK_REVISION_KEY))?.value).toBe(BANK_REVISIONS[BANK_REVISIONS.length - 1].id)
    expect(JSON.parse(localStorage.getItem('level-up-bank-notice')!)).toEqual([
      { revision: '116-1', effectiveFrom: '2027-01-01', exams: { 'web-design-b': { archived: 1, moved: 1, added: revision.exams['web-design-b'].added } } },
      // 116-3 swaps web-design-b's 90011 bank; this learner had no 90011 records.
      { revision: '116-3', effectiveFrom: '2027-01-01', exams: { 'web-design-b': { archived: 0, moved: 0, added: (await BANK_REVISIONS[2].load()).exams['web-design-b'].added } } },
    ])

    // A second open (or a second tab) must not rewrite again.
    expect(await migrateBankRevisions()).toEqual({})
    expect((await db.progress.toArray()).map((row) => row.questionId).sort()).toEqual(keys)
    db.close()
  })
})
