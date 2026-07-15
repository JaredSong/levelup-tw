import type { SourceGroup } from './exam'

export const CARD_SCHEMA_VERSION = 1

export type ISODateTime = string
export type ISODate = string
export type ProfileId = string
export type ExamId = string
export type QuestionId = string
export type QuestionKey = string

export type QuestionKind = 'single' | 'multiple'
export type QuestionSource = 'official' | 'personal' | 'generated'
export type AttemptMode =
  | 'practice'
  | 'random'
  | 'fresh'
  | 'high-yield'
  | 'exam-sprint'
  | 'wrong-review'
  | 'due-review'
  | 'mock'
  | 'commute'

export type WrongBookStatus = 'active' | 'mastered' | 'dismissed'
export type AtomKind = 'fact' | 'rule' | 'threshold' | 'trap' | 'process' | 'term'
export type AtomSource = 'curated' | 'question' | 'ai-draft' | 'personal'
export type ReviewState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type MockMode = 'official' | 'training'
export type MissionStatus = 'active' | 'completed' | 'expired'
export type MissionItemType =
  | 'due-review'
  | 'wrong-fix'
  | 'fresh-questions'
  | 'weak-topic'
  | 'mini-mock'
  | 'commute-note'
export type StudyEventType =
  | 'attempt-recorded'
  | 'wrong-book-updated'
  | 'review-card-graded'
  | 'mock-completed'
  | 'mission-updated'
  | 'explanation-generated'
export type StudyEventEntityType =
  | 'attempt'
  | 'wrong-book-item'
  | 'review-card'
  | 'review-log'
  | 'mock-exam-run'
  | 'daily-mission'
  | 'question'
  | 'knowledge-atom'

export interface Question {
  examId: ExamId
  id: QuestionId
  questionKey: QuestionKey
  subjectCode?: string
  subjectTitle?: string
  sourceGroup?: SourceGroup
  section: string
  sectionTitle?: string
  number: number
  kind: QuestionKind
  prompt: string
  options: string[]
  answers: number[]
  source: QuestionSource
  sourcePage?: number
  hasFigure?: boolean
  codeBlock?: string
  optionCodeBlocks?: (string | null)[]
  sourceImage?: string
  sourceImages?: string[]
  sourcePageImage?: string
  active: boolean
}

export interface Attempt {
  id: string
  profileId: ProfileId
  examId: ExamId
  questionId: QuestionId
  questionKey: QuestionKey
  mode: AttemptMode
  selected: number[]
  correctAnswers: number[]
  correct: boolean
  guessed: boolean
  elapsedMs: number
  answeredAt: ISODateTime
  sessionId?: string
  mockRunId?: string
}

export interface WrongBookItem {
  profileId: ProfileId
  examId: ExamId
  questionId: QuestionId
  questionKey: QuestionKey
  status: WrongBookStatus
  wrongCount: number
  correctStreak: number
  lastAttemptId: string
  lastWrongAt?: ISODateTime
  nextReviewAt?: ISODateTime
  masteredAt?: ISODateTime
  updatedAt: ISODateTime
}

export interface KnowledgeAtom {
  id: string
  examId: ExamId
  questionKeys: QuestionKey[]
  kind: AtomKind
  front: string
  back: string
  memoryCue?: string
  tags: string[]
  source: AtomSource
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface ReviewCard {
  id: string
  schemaVersion: typeof CARD_SCHEMA_VERSION
  profileId: ProfileId
  examId: ExamId
  atomId: string
  questionKeys: QuestionKey[]
  prompt: string
  answer: string
  state: ReviewState
  dueAt: ISODateTime
  stability?: number
  difficulty?: number
  retrievability?: number
  desiredRetention?: number
  intervalDays: number
  reps: number
  lapses: number
  lastReviewedAt?: ISODateTime
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface ReviewLog {
  id: string
  profileId: ProfileId
  cardId: string
  examId: ExamId
  rating: ReviewRating
  reviewedAt: ISODateTime
  elapsedMs: number
  previousDueAt: ISODateTime
  nextDueAt: ISODateTime
  previousState?: ReviewState
  nextState?: ReviewState
}

export interface MockExamAnswer {
  questionKey: QuestionKey
  selected: number[]
  correctAnswers: number[]
  correct: boolean
  elapsedMs?: number
}

export interface MockExamRun {
  id: string
  profileId: ProfileId
  examId: ExamId
  mode: MockMode
  startedAt: ISODateTime
  completedAt?: ISODateTime
  durationMinutes: number
  score?: number
  passed?: boolean
  questionKeys: QuestionKey[]
  answers: MockExamAnswer[]
}

export interface DailyMissionItem {
  id: string
  type: MissionItemType
  targetCount: number
  completedCount: number
  sectionId?: string
  questionKeys?: QuestionKey[]
  cardIds?: string[]
}

export interface DailyMission {
  id: string
  profileId: ProfileId
  examId: ExamId
  date: ISODate
  status: MissionStatus
  items: DailyMissionItem[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface StudyEvent {
  id: string
  profileId: ProfileId
  examId: ExamId
  type: StudyEventType
  entityType: StudyEventEntityType
  entityId: string
  occurredAt: ISODateTime
  metadata?: Record<string, unknown>
}
