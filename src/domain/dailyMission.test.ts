import { describe, expect, it } from 'vitest'
import { buildDailyMission, localDayKey, studyStreak, type MissionInputs } from './dailyMission'

const NOW = new Date('2026-07-10T20:00:00')

function inputs(overrides: Partial<MissionInputs> = {}): MissionInputs {
  return {
    dueCardCount: 0,
    reviewsDoneToday: 0,
    wrongBookSize: 0,
    todayAttempts: [],
    attemptTotals: {},
    wrongTotals: {},
    ...overrides,
  }
}

describe('studyStreak', () => {
  it('counts consecutive local days ending today', () => {
    const streak = studyStreak(['2026-07-10T08:00:00', '2026-07-09T22:00:00', '2026-07-08T07:00:00'], NOW)
    expect(streak).toBe(3)
  })

  it('keeps the chain alive before the first session of the day', () => {
    expect(studyStreak(['2026-07-09T22:00:00', '2026-07-08T07:00:00'], NOW)).toBe(2)
  })

  it('breaks on a missed day and handles no activity', () => {
    expect(studyStreak(['2026-07-10T08:00:00', '2026-07-08T07:00:00'], NOW)).toBe(1)
    expect(studyStreak([], NOW)).toBe(0)
  })

  it('uses local calendar days, not raw 24h windows', () => {
    // 23:50 yesterday and 00:10 today are 20 minutes apart but two distinct days.
    expect(studyStreak(['2026-07-09T23:50:00', '2026-07-10T00:10:00'], NOW)).toBe(2)
    expect(localDayKey('2026-07-09T23:50:00')).toBe('2026-07-09')
  })
})

describe('buildDailyMission', () => {
  it('shrinks targets to what exists and marks empty queues done', () => {
    const mission = buildDailyMission(inputs())
    const [dueReview, wrongFix, fresh] = mission.items
    expect(dueReview).toMatchObject({ type: 'due-review', target: 0, done: true })
    expect(wrongFix).toMatchObject({ type: 'wrong-fix', target: 0, done: true })
    expect(fresh).toMatchObject({ type: 'fresh-questions', target: 10, completed: 0, done: false })
    expect(mission.allDone).toBe(false) // fresh questions always give a daily action
  })

  it('keeps the due-review target stable as grading shrinks the queue', () => {
    // 5 due, none done yet → target 5. After grading 3, 2 remain due → still 5.
    expect(buildDailyMission(inputs({ dueCardCount: 5 })).items[0]).toMatchObject({ target: 5, completed: 0 })
    const after = buildDailyMission(inputs({ dueCardCount: 2, reviewsDoneToday: 3 })).items[0]
    expect(after).toMatchObject({ target: 5, completed: 3, done: false })
  })

  it('caps the due-review ask to protect against a backlog', () => {
    expect(buildDailyMission(inputs({ dueCardCount: 80 })).items[0].target).toBe(20)
  })

  it('counts first-seen-today questions as fresh and correct retries as wrong fixes', () => {
    const mission = buildDailyMission(inputs({
      wrongBookSize: 2,
      todayAttempts: [
        { questionId: 'q-new', correct: true, answeredAt: '2026-07-10T09:00:00' },
        { questionId: 'q-wrong', correct: true, answeredAt: '2026-07-10T09:05:00' },
        { questionId: 'q-wrong-still', correct: false, answeredAt: '2026-07-10T09:10:00' },
      ],
      attemptTotals: { 'q-new': 1, 'q-wrong': 4, 'q-wrong-still': 3 },
      wrongTotals: { 'q-wrong': 2, 'q-wrong-still': 2 },
    }))
    const [, wrongFix, fresh] = mission.items
    expect(fresh.completed).toBe(1) // only q-new
    expect(wrongFix.completed).toBe(1) // q-wrong repaired; the failed retry does not count
    expect(wrongFix.target).toBe(3) // 1 fixed + 2 still active
  })

  it('completes when every queue is cleared', () => {
    const mission = buildDailyMission(inputs({
      reviewsDoneToday: 4,
      todayAttempts: Array.from({ length: 10 }, (_, index) => ({
        questionId: `fresh-${index}`, correct: true, answeredAt: '2026-07-10T09:00:00',
      })),
      attemptTotals: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`fresh-${index}`, 1])),
    }))
    expect(mission.items.map((item) => item.done)).toEqual([true, true, true])
    expect(mission.allDone).toBe(true)
  })
})
