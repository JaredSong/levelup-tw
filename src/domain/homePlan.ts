// Home page model: the week row, today's three tasks and the last mock score.
// Pure module — no DOM, Dexie or React — so every number on 首頁 is testable.

import { localDayKey, type DailyMissionView } from './dailyMission'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export interface WeekDay {
  key: string
  label: string
  active: boolean
  today: boolean
}

/** The last seven local days, oldest first, ending today. */
export function recentWeek(activityTimestamps: string[], now: Date): WeekDay[] {
  const active = new Set(activityTimestamps.map((at) => localDayKey(at)))
  const days: WeekDay[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now)
    day.setDate(day.getDate() - offset)
    const key = localDayKey(day)
    days.push({ key, label: WEEKDAY_LABELS[day.getDay()], active: active.has(key), today: offset === 0 })
  }
  return days
}

/**
 * The coverage ring holds one short number — the percentage once practice has
 * started, the bank size before — and its caption sits underneath, so nothing
 * runs into the stroke. Four characters ("100%", "1,654") get the smaller size.
 */
export function ringLabel(seen: number, total: number): { text: string; long: boolean } {
  const text = seen ? `${total ? Math.round(seen / total * 100) : 0}%` : total.toLocaleString('en-US')
  return { text, long: text.length >= 4 }
}

export type HomeTaskKind = 'fresh' | 'review' | 'wrong' | 'mock'

export interface HomeTask {
  kind: HomeTaskKind
  /** Questions (or mocks) the task asks for today. */
  target: number
  completed: number
  done: boolean
}

export interface HomeTaskInputs {
  mission: DailyMissionView
  /** Questions answered at least once; 0 means a first visit. */
  seen: number
  /** Days until the learner's exam date, or null when none is set. */
  examDays: number | null
  /** A scored mock was finished today. */
  mockDoneToday: boolean
}

/** A mock becomes one of today's tasks in the last two weeks before the exam. */
export const MOCK_TASK_WINDOW_DAYS = 14

/**
 * Up to three tasks, in the order they should be done: new questions first,
 * then what is due, then repairs — and a mock in the final stretch. Tasks with
 * nothing to do are left out rather than shown as already done.
 */
export function homeTasks({ mission, seen, examDays, mockDoneToday }: HomeTaskInputs): HomeTask[] {
  const byType = new Map(mission.items.map((item) => [item.type, item]))
  const fresh = byType.get('fresh-questions')
  const review = byType.get('due-review')
  const wrong = byType.get('wrong-fix')
  const tasks: HomeTask[] = []
  if (fresh) tasks.push({ kind: 'fresh', target: fresh.target, completed: fresh.completed, done: fresh.done })
  if (seen > 0) {
    if (review && review.target > 0) tasks.push({ kind: 'review', target: review.target, completed: review.completed, done: review.done })
    if (wrong && wrong.target > 0) tasks.push({ kind: 'wrong', target: wrong.target, completed: wrong.completed, done: wrong.done })
    if (examDays !== null && examDays <= MOCK_TASK_WINDOW_DAYS) {
      const mock: HomeTask = { kind: 'mock', target: 1, completed: mockDoneToday ? 1 : 0, done: mockDoneToday }
      // In the final stretch the mock outranks repairs: keep it in the three.
      if (tasks.length >= 3) tasks.splice(2, 1, mock)
      else tasks.push(mock)
    }
  }
  return tasks.slice(0, 3)
}

export interface MockResultLike {
  mode: string
  title: string
  finishedAt: string
  score: number
  maxScore: number
  passed: boolean
}

/**
 * The most recent official-format mock. Training mocks show answers as you go,
 * so their scores don't say whether you'd pass; they are skipped.
 */
export function lastOfficialMock<T extends MockResultLike>(results: T[], trainingTitle: string): T | null {
  return results
    .filter((result) => result.mode === 'mock' && result.title !== trainingTitle)
    .reduce<T | null>((latest, result) => (!latest || result.finishedAt > latest.finishedAt ? result : latest), null)
}
