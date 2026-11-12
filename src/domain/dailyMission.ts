// Daily mission + streak: the Phase 3 habit loop. Pure module — no DOM, Dexie,
// or React. Everything derives from the day's attempts and review logs, so the
// habit layer needs no storage or sync surface of its own. Kept deliberately
// shallow: it reinforces studying, it is not the product.
// See docs/level-up-public-app-plan.md (Phase 3) and docs/level-up-interface-spec.md (Home).

import type { MissionItemType } from '../core/contracts'

/** Local calendar day for an ISO timestamp — streaks follow the device's day, not UTC. */
export function localDayKey(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Consecutive study days ending today — or yesterday, so an unbroken chain
 * still shows before the first session of the day.
 */
export function studyStreak(activityTimestamps: string[], now: Date): number {
  const days = new Set(activityTimestamps.map((at) => localDayKey(at)))
  const cursor = new Date(now)
  if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1) // grace for "not yet today"
  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface TodayAttempt {
  questionId: string
  correct: boolean
  answeredAt: string
}

export interface MissionInputs {
  /** Review cards due right now. */
  dueCardCount: number
  /** Review-card grades logged today. */
  reviewsDoneToday: number
  /** Active wrong-book size (wrong > 0, streak < 2). */
  wrongBookSize: number
  /** Today's attempts for this exam (bare question ids). */
  todayAttempts: TodayAttempt[]
  /** Total recorded attempts per question, to spot first-seen-today questions. */
  attemptTotals: Record<string, number>
  /** Questions ever answered wrong (cumulative), to spot wrong-book repairs. */
  wrongTotals: Record<string, number>
}

export interface MissionItemView {
  type: MissionItemType
  target: number
  completed: number
  done: boolean
}

export interface DailyMissionView {
  items: MissionItemView[]
  allDone: boolean
}

/** Keep an overdue card backlog approachable — the mission never asks for more than this. */
const DUE_REVIEW_CAP = 20
const WRONG_FIX_TARGET = 10
const FRESH_TARGET = 10

/**
 * Compose today's mission: clear due cards, repair wrong answers, learn a small
 * fresh set. Targets shrink to what actually exists, so an empty queue reads as
 * done instead of nagging.
 */
export function buildDailyMission(inputs: MissionInputs): DailyMissionView {
  const attemptsByQuestion = new Map<string, TodayAttempt[]>()
  for (const attempt of inputs.todayAttempts) {
    const list = attemptsByQuestion.get(attempt.questionId) ?? []
    list.push(attempt)
    attemptsByQuestion.set(attempt.questionId, list)
  }

  // First seen today: every recorded attempt for the question happened today.
  let freshDone = 0
  // Repaired today: a correct retry on a question that has been wrong before.
  let wrongFixed = 0
  for (const [questionId, attempts] of attemptsByQuestion) {
    if ((inputs.attemptTotals[questionId] ?? 0) === attempts.length) freshDone += 1
    else if ((inputs.wrongTotals[questionId] ?? 0) > 0 && attempts.some((attempt) => attempt.correct)) wrongFixed += 1
  }

  const dueReview: MissionItemView = {
    type: 'due-review',
    target: Math.min(DUE_REVIEW_CAP, inputs.reviewsDoneToday + inputs.dueCardCount),
    completed: inputs.reviewsDoneToday,
    done: false,
  }
  const wrongFix: MissionItemView = {
    type: 'wrong-fix',
    target: Math.min(WRONG_FIX_TARGET, wrongFixed + inputs.wrongBookSize),
    completed: wrongFixed,
    done: false,
  }
  const fresh: MissionItemView = {
    type: 'fresh-questions',
    target: FRESH_TARGET,
    completed: Math.min(FRESH_TARGET, freshDone),
    done: false,
  }

  const items = [dueReview, wrongFix, fresh].map((item) => ({
    ...item,
    completed: Math.min(item.completed, item.target),
    done: item.target === 0 || item.completed >= item.target,
  }))
  return { items, allDone: items.every((item) => item.done) }
}
