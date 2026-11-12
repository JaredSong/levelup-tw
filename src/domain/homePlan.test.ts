import { describe, expect, it } from 'vitest'
import type { DailyMissionView } from './dailyMission'
import { homeTasks, lastOfficialMock, recentWeek, ringLabel } from './homePlan'

const NOW = new Date('2026-11-12T20:00:00') // a Thursday

function mission(overrides: Partial<Record<'due-review' | 'wrong-fix' | 'fresh-questions', [number, number]>> = {}): DailyMissionView {
  const make = (type: 'due-review' | 'wrong-fix' | 'fresh-questions', fallback: [number, number]) => {
    const [target, completed] = overrides[type] ?? fallback
    return { type, target, completed, done: target === 0 || completed >= target }
  }
  const items = [make('due-review', [0, 0]), make('wrong-fix', [0, 0]), make('fresh-questions', [10, 0])]
  return { items, allDone: items.every((item) => item.done) }
}

describe('recentWeek', () => {
  it('lists the last seven local days ending today, marking practised days', () => {
    const week = recentWeek(['2026-11-12T08:00:00', '2026-11-10T22:00:00', '2026-11-05T10:00:00'], NOW)
    expect(week.map((day) => day.label)).toEqual(['五', '六', '日', '一', '二', '三', '四'])
    expect(week.map((day) => day.active)).toEqual([false, false, false, false, true, false, true])
    expect(week.at(-1)).toMatchObject({ today: true, key: '2026-11-12' })
  })
})

describe('homeTasks', () => {
  it('gives a first-time learner only the first set of questions', () => {
    expect(homeTasks({ mission: mission(), seen: 0, examDays: null, mockDoneToday: false }).map((task) => task.kind)).toEqual(['fresh'])
  })

  it('leaves out tasks with nothing to do instead of ticking them', () => {
    const tasks = homeTasks({ mission: mission({ 'due-review': [0, 0], 'wrong-fix': [6, 2] }), seen: 120, examDays: 40, mockDoneToday: false })
    expect(tasks.map((task) => task.kind)).toEqual(['fresh', 'wrong'])
    expect(tasks[1]).toMatchObject({ target: 6, completed: 2, done: false })
  })

  it('puts a mock in the three during the last two weeks', () => {
    const inputs = { mission: mission({ 'due-review': [12, 12], 'wrong-fix': [10, 0] }), seen: 900, mockDoneToday: false }
    expect(homeTasks({ ...inputs, examDays: 30 }).map((task) => task.kind)).toEqual(['fresh', 'review', 'wrong'])
    expect(homeTasks({ ...inputs, examDays: 9 }).map((task) => task.kind)).toEqual(['fresh', 'review', 'mock'])
    expect(homeTasks({ ...inputs, examDays: 9, mockDoneToday: true }).at(-1)).toMatchObject({ kind: 'mock', done: true })
  })
})

describe('lastOfficialMock', () => {
  const row = (title: string, finishedAt: string, score: number, mode = 'mock') => ({ mode, title, finishedAt, score, maxScore: 100, passed: score >= 60 })

  it('returns the latest official mock and ignores training mocks and practice', () => {
    const results = [
      row('模擬考', '2026-11-02T10:00:00Z', 54),
      row('訓練模擬', '2026-11-09T10:00:00Z', 90),
      row('新題練習', '2026-11-10T10:00:00Z', 9, 'sequential'),
      row('模擬考', '2026-11-08T10:00:00Z', 68),
    ]
    expect(lastOfficialMock(results, '訓練模擬')?.score).toBe(68)
    expect(lastOfficialMock([row('訓練模擬', '2026-11-09T10:00:00Z', 90)], '訓練模擬')).toBeNull()
  })
})

describe('ringLabel', () => {
  it('keeps the ring to one short number and shrinks four-character ones', () => {
    expect(ringLabel(386, 1645)).toEqual({ text: '23%', long: false })
    expect(ringLabel(1645, 1645)).toEqual({ text: '100%', long: true })
    expect(ringLabel(0, 1654)).toEqual({ text: '1,654', long: true })
    // Every live bank size and every percentage fits in five characters.
    for (const total of [893, 994, 1654]) expect(ringLabel(0, total).text.length).toBeLessThanOrEqual(5)
  })
})
