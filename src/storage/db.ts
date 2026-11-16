import Dexie, { type EntityTable } from 'dexie'
import type { ReviewCard, ReviewLog } from '../core/contracts'
import type { Progress } from '../domain/studyEngine'
import { applyBankRevision, BANK_REVISION_KEY, type BankRevisionImpact } from './bankRevision'
import { BANK_REVISION_ORDER, loadBankRevisions, pendingRevisionIds, recordBankNotice } from './bankRevisionRunner'
import {
  archiveEmploymentServiceA19Tables,
  EMPLOYMENT_SERVICE_CURRENT_REVISION,
  EMPLOYMENT_SERVICE_REVISION_KEY,
  migrateTablesToQuestionKeys,
} from './migrate'

export interface AttemptRecord {
  id?: number
  questionId: string
  selected: number[]
  correct: boolean
  guessed: boolean
  elapsedMs: number
  answeredAt: string
  mode: string
}

export interface ExplanationRecord {
  questionId: string
  content: string
  provider: string
  updatedAt: string
}

export interface SessionResult {
  id?: number
  examId: string
  sessionId: string
  mode: string
  title: string
  finishedAt: string
  answered: number
  correct: number
  /** Weighted score (mock: single=1, multiple=2, max 100); other modes: correct count. */
  score: number
  maxScore: number
  passed: boolean
  durationMs: number
}

export interface MetaRecord {
  key: string
  value: string
}

export const db = new Dexie('level-b-study') as Dexie & {
  meta: EntityTable<MetaRecord, 'key'>
  progress: EntityTable<Progress, 'questionId'>
  attempts: EntityTable<AttemptRecord, 'id'>
  explanations: EntityTable<ExplanationRecord, 'questionId'>
  results: EntityTable<SessionResult, 'id'>
  reviewCards: EntityTable<ReviewCard, 'id'>
  reviewLogs: EntityTable<ReviewLog, 'id'>
}

db.version(1).stores({
  progress: 'questionId, nextReviewAt, wrong, attempts, bookmarked',
  attempts: '++id, questionId, answeredAt, correct, mode',
  explanations: 'questionId, updatedAt',
})

db.version(2).stores({
  results: '++id, finishedAt, mode',
})

// v3 keeps the schema but rewrites bare question ids ("17300-01-001") to
// namespaced question keys ("web-design-b:17300-01-001") so storage is
// multi-exam-safe. See docs/level-up-public-app-plan.md rollout step 2.
db.version(3).upgrade((tx) => migrateTablesToQuestionKeys(tx))

// v4 adds the Phase 2 memory layer: review cards with FSRS-shaped scheduling
// and their grading logs. Card ids are deterministic per question, so merges
// and re-adds dedupe naturally.
db.version(4).stores({
  reviewCards: 'id, examId, dueAt, state, *questionKeys',
  reviewLogs: 'id, cardId, examId, reviewedAt',
})

// v5 scopes completed sessions to the exam that produced them. Existing rows
// predate multi-exam support and therefore belong to the original web-design-b
// bank.
db.version(5).stores({
  results: '++id, examId, finishedAt, mode',
}).upgrade((tx) =>
  tx.table<SessionResult, number>('results').toCollection().modify((result) => {
    result.examId = result.examId ?? 'web-design-b'
  }),
)

// v6 preserves study history from the mislabeled 2018 employment-service bank
// under a legacy namespace. The official A17 revision renumbers most questions,
// so its mastery must start clean rather than inherit unrelated answers.
db.version(6).upgrade((tx) => archiveEmploymentServiceA19Tables(tx))

// v7 adds a small key/value table. Its first use is the bank-revision marker,
// kept here (not localStorage) so it commits atomically with the rows it
// describes — a rewrite that ran twice would misattach progress.
db.version(7).stores({
  meta: 'key',
})

db.on('ready', () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(EMPLOYMENT_SERVICE_REVISION_KEY, EMPLOYMENT_SERVICE_CURRENT_REVISION)
  }
})

/**
 * Rewrite saved progress for every official bank revision this device hasn't
 * applied yet (see bankRevision.ts). Returns the per-pack impact by revision.
 * Exported for tests; the app runs it from the ready handler below.
 */
export async function migrateBankRevisions(): Promise<Record<string, Record<string, BankRevisionImpact>>> {
  const applied = (await db.meta.get(BANK_REVISION_KEY))?.value
  const pending = pendingRevisionIds(BANK_REVISION_ORDER, applied)
  if (!pending.length) return {}
  const latest = pending[pending.length - 1]
  const counts = await Promise.all([db.progress.count(), db.attempts.count(), db.reviewCards.count(), db.explanations.count()])
  if (counts.every((count) => count === 0)) {
    // Nothing saved yet: this learner starts on the current banks.
    await db.meta.put({ key: BANK_REVISION_KEY, value: latest })
    return {}
  }

  const revisions = await loadBankRevisions(pending)
  const impacts: Record<string, Record<string, BankRevisionImpact>> = {}
  const tables = [db.progress, db.attempts, db.explanations, db.reviewCards, db.reviewLogs, db.meta]
  await db.transaction('rw', tables, async () => {
    // Another tab may have migrated between the check above and this lock.
    if ((await db.meta.get(BANK_REVISION_KEY))?.value !== applied) return
    let data = {
      progress: await db.progress.toArray(),
      attempts: await db.attempts.toArray(),
      explanations: await db.explanations.toArray(),
      reviewCards: await db.reviewCards.toArray(),
      reviewLogs: await db.reviewLogs.toArray(),
      results: [],
      local: {},
    }
    for (const revision of revisions) {
      const result = applyBankRevision(data, revision)
      data = result.data as typeof data
      impacts[revision.id] = result.impact
    }
    await Promise.all([db.progress.clear(), db.attempts.clear(), db.explanations.clear(), db.reviewCards.clear(), db.reviewLogs.clear()])
    await db.progress.bulkPut(data.progress)
    await db.attempts.bulkPut(data.attempts) // keeps the auto-increment ids
    await db.explanations.bulkPut(data.explanations)
    await db.reviewCards.bulkPut(data.reviewCards)
    await db.reviewLogs.bulkPut(data.reviewLogs)
    await db.meta.put({ key: BANK_REVISION_KEY, value: latest })
  })
  if (typeof localStorage !== 'undefined') {
    for (const revision of revisions) recordBankNotice(revision.id, revision.effectiveFrom, impacts[revision.id] ?? {})
  }
  return impacts
}

// Runs before any other query is served. A failure (e.g. the revision chunk
// can't load) must not lock the learner out: log it and retry on next open.
db.on('ready', () => migrateBankRevisions().then(() => undefined, (error: unknown) => {
  console.error('Bank revision migration failed; will retry on next open.', error)
}))
