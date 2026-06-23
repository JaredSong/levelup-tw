import Dexie, { type EntityTable } from 'dexie'
import type { Progress } from '../domain/studyEngine'

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
}

db.version(1).stores({
  progress: 'questionId, nextReviewAt, wrong, attempts, bookmarked',
  attempts: '++id, questionId, answeredAt, correct, mode',
  explanations: 'questionId, updatedAt',
})

db.version(2).stores({
  results: '++id, finishedAt, mode',
})
