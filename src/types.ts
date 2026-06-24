import type { Question } from './domain/studyEngine'

export type SessionMode =
  | 'sequential'
  | 'adaptive'
  | 'random'
  | 'wrong'
  | 'flashcard'
  | 'mock'
  | 'sprint'
  | 'item'

export interface SessionAnswer {
  selected: number[]
  correct: boolean
  guessed: boolean
}

export interface StudySession {
  id: string
  mode: SessionMode
  title: string
  questionIds: string[]
  currentIndex: number
  startedAt: string
  questionStartedAt: string
  answers: Record<string, SessionAnswer>
  selections: Record<string, number[]>
  flags?: Record<string, boolean>
  mockEndsAt?: string
  /** Frozen time left on the mock clock while paused; restored on resume. */
  mockRemainingMs?: number
  completed?: boolean
}

export interface BankState {
  questions: Question[]
  byId: Map<string, Question>
}
