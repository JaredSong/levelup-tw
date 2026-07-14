import Dexie, { type EntityTable } from 'dexie'
import type { ReviewCard, ReviewLog } from '../core/contracts'
import type { Progress } from '../domain/studyEngine'
import { migrateTablesToQuestionKeys } from './migrate'

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

export const db = new Dexie('level-b-study') as Dexie & {
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
