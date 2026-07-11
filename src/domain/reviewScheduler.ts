// Review-card scheduler: the Phase 2 memory layer. Pure module — no DOM, Dexie,
// or React — so it can be shared by web and mobile. Cards use FSRS-compatible
// fields (stability/difficulty/dueAt) with simplified v1 math; a real FSRS
// implementation can replace `gradeCard` later without a schema change.
// See docs/level-up-public-app-plan.md (Phase 2) and docs/level-up-interface-spec.md (Review).

import { CARD_SCHEMA_VERSION, type ReviewCard, type ReviewLog, type ReviewRating } from '../core/contracts'
import { questionKey } from '../core/exam'

export const LOCAL_PROFILE_ID = 'local'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
/** How long an "again" card waits before it comes back in the same sitting. */
const RELEARN_STEP_MS = 10 * MINUTE_MS
/** Interval growth slows as difficulty rises; clamped so cards never stall or explode. */
const MIN_GROWTH = 1.4
const MAX_GROWTH = 2.6
const EASY_BONUS = 1.4
const MAX_INTERVAL_DAYS = 120

const START_DIFFICULTY = 5
const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10

export interface CardQuestion {
  id: string
  prompt: string
  options: string[]
  answers: number[]
}

/** Deterministic card id: one card per question, so re-adding and cross-device merges dedupe. */
export function questionCardId(examId: string, questionId: string): string {
  return `question:${questionKey(examId, questionId)}`
}

/**
 * Build a question-backed review card from the official prompt and answer only
 * (AtomSource "question"). No stored atom yet — the atomId is synthetic until a
 * curation/AI layer exists.
 */
export function createQuestionCard(examId: string, question: CardQuestion, now: Date): ReviewCard {
  const key = questionKey(examId, question.id)
  const at = now.toISOString()
  return {
    id: questionCardId(examId, question.id),
    schemaVersion: CARD_SCHEMA_VERSION,
    profileId: LOCAL_PROFILE_ID,
    examId,
    atomId: questionCardId(examId, question.id),
    questionKeys: [key],
    prompt: question.prompt,
    answer: question.answers.map((value) => `${value}. ${question.options[value - 1] ?? ''}`).join('\n'),
    state: 'new',
    dueAt: at,
    stability: 0,
    difficulty: START_DIFFICULTY,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    createdAt: at,
    updatedAt: at,
  }
}

function clampDifficulty(value: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Math.round(value * 10) / 10))
}

/** Higher difficulty → slower interval growth. */
function growthFor(difficulty: number): number {
  return Math.min(MAX_GROWTH, Math.max(MIN_GROWTH, 3 - 0.16 * difficulty))
}

export interface GradeResult {
  card: ReviewCard
  log: Omit<ReviewLog, 'id'>
}

/**
 * Grade one recall. Intervals grow from the card's stability, not from how
 * overdue it was, so a backlog never punishes the learner with runaway gaps.
 */
export function gradeCard(card: ReviewCard, rating: ReviewRating, now: Date, elapsedMs = 0): GradeResult {
  const difficulty = card.difficulty ?? START_DIFFICULTY
  const stability = card.stability ?? 0
  const wasGraduated = card.state === 'review'

  let next: Pick<ReviewCard, 'state' | 'stability' | 'difficulty' | 'intervalDays'>
  let dueMs: number

  if (rating === 'again') {
    next = {
      state: wasGraduated ? 'relearning' : 'learning',
      stability: Math.max(0.5, stability * 0.4),
      difficulty: clampDifficulty(difficulty + 1),
      intervalDays: 0,
    }
    dueMs = RELEARN_STEP_MS
  } else {
    const bonus = rating === 'easy' ? EASY_BONUS : 1
    const grown = stability <= 0
      ? (rating === 'easy' ? 3 : 1) // first success: 1 day, or 3 for an instant "easy"
      : stability * growthFor(difficulty) * bonus
    const intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(grown)))
    next = {
      state: 'review',
      stability: Math.min(MAX_INTERVAL_DAYS, grown),
      difficulty: clampDifficulty(rating === 'easy' ? difficulty - 0.5 : difficulty - 0.1),
      intervalDays,
    }
    dueMs = intervalDays * DAY_MS
  }

  const nextDueAt = new Date(now.getTime() + dueMs).toISOString()
  const graded: ReviewCard = {
    ...card,
    ...next,
    dueAt: nextDueAt,
    reps: card.reps + 1,
    lapses: card.lapses + (rating === 'again' && wasGraduated ? 1 : 0),
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  return {
    card: graded,
    log: {
      profileId: card.profileId,
      cardId: card.id,
      examId: card.examId,
      rating,
      reviewedAt: now.toISOString(),
      elapsedMs,
      previousDueAt: card.dueAt,
      nextDueAt,
      previousState: card.state,
      nextState: graded.state,
    },
  }
}

export function isCardDue(card: ReviewCard, now: Date): boolean {
  return card.state !== 'suspended' && card.dueAt <= now.toISOString()
}

export interface ReviewLoadSummary {
  /** Due before today started — the backlog. */
  overdueCount: number
  /** Due today (including already-graded-today cards would no longer be due, so this is what's left). */
  dueTodayCount: number
  totalCards: number
}

/** Split the due queue into backlog (overdue) vs today's fresh load, for the Insights "Review Load" card. */
export function reviewLoadSummary(cards: ReviewCard[], now: Date): ReviewLoadSummary {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  let overdueCount = 0
  let dueTodayCount = 0
  for (const card of cards) {
    if (!isCardDue(card, now)) continue
    if (card.dueAt < startOfToday) overdueCount += 1
    else dueTodayCount += 1
  }
  return { overdueCount, dueTodayCount, totalCards: cards.length }
}

/**
 * Due queue: (re)learning steps first so the same-sitting loop closes, then by
 * how long a card has waited. Capped so an overdue backlog stays approachable.
 */
export function buildDueCardQueue(cards: ReviewCard[], now: Date, limit = 20): ReviewCard[] {
  const learningFirst = (card: ReviewCard) => (card.state === 'learning' || card.state === 'relearning' ? 0 : 1)
  return cards
    .filter((card) => isCardDue(card, now))
    .sort((a, b) => learningFirst(a) - learningFirst(b) || a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit)
}

/** Human-readable next interval for a rating, e.g. "10 分鐘" / "3 天". */
export function previewInterval(card: ReviewCard, rating: ReviewRating, now: Date): { minutes?: number; days?: number } {
  const { card: graded } = gradeCard(card, rating, now)
  if (graded.intervalDays >= 1) return { days: graded.intervalDays }
  return { minutes: Math.round(RELEARN_STEP_MS / MINUTE_MS) }
}
