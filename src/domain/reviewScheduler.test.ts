import { describe, expect, it } from 'vitest'
import type { ReviewCard } from '../core/contracts'
import {
  buildDueCardQueue,
  createQuestionCard,
  gradeCard,
  isCardDue,
  previewInterval,
  questionCardId,
  resolveCardFace,
  reviewLoadSummary,
} from './reviewScheduler'

const NOW = new Date('2026-07-10T08:00:00.000Z')
const QUESTION = {
  id: '17300-01-001',
  prompt: '下列何者正確？',
  options: ['甲', '乙', '丙', '丁'],
  answers: [3],
}

function newCard(): ReviewCard {
  return createQuestionCard('web-design-b', QUESTION, NOW)
}

describe('createQuestionCard', () => {
  it('builds a due-now card keyed deterministically by question', () => {
    const card = newCard()
    expect(card.id).toBe('question:web-design-b:17300-01-001')
    expect(card.id).toBe(questionCardId('web-design-b', QUESTION.id))
    expect(card.questionKeys).toEqual(['web-design-b:17300-01-001'])
    expect(card.state).toBe('new')
    expect(card.dueAt).toBe(NOW.toISOString())
    expect(card.prompt).toBe(QUESTION.prompt)
    expect(card.answer).toBe('3. 丙')
    expect(isCardDue(card, NOW)).toBe(true)
  })

  it('lists every official answer for multiple-answer questions', () => {
    const card = createQuestionCard('web-design-b', { ...QUESTION, answers: [1, 4] }, NOW)
    expect(card.answer).toBe('1. 甲\n4. 丁')
  })
})

describe('gradeCard', () => {
  it('good on a new card graduates to review, due in 1 day', () => {
    const { card, log } = gradeCard(newCard(), 'good', NOW)
    expect(card.state).toBe('review')
    expect(card.intervalDays).toBe(1)
    expect(card.dueAt).toBe(new Date(NOW.getTime() + 86_400_000).toISOString())
    expect(card.reps).toBe(1)
    expect(card.lapses).toBe(0)
    expect(log.rating).toBe('good')
    expect(log.previousState).toBe('new')
    expect(log.nextState).toBe('review')
  })

  it('intervals grow with consecutive good grades', () => {
    let card = newCard()
    const intervals: number[] = []
    for (let i = 0; i < 5; i += 1) {
      card = gradeCard(card, 'good', NOW).card
      intervals.push(card.intervalDays)
    }
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
    }
    expect(intervals[0]).toBe(1)
  })

  it('easy grows faster than good and lowers difficulty', () => {
    const seed = gradeCard(gradeCard(newCard(), 'good', NOW).card, 'good', NOW).card
    const good = gradeCard(seed, 'good', NOW).card
    const easy = gradeCard(seed, 'easy', NOW).card
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays)
    expect(easy.difficulty!).toBeLessThan(good.difficulty!)
  })

  it('again on a graduated card lapses to relearning with a 10-minute step', () => {
    const graduated = gradeCard(newCard(), 'good', NOW).card
    const { card } = gradeCard(graduated, 'again', NOW)
    expect(card.state).toBe('relearning')
    expect(card.lapses).toBe(1)
    expect(card.intervalDays).toBe(0)
    expect(card.dueAt).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString())
    expect(card.difficulty!).toBeGreaterThan(graduated.difficulty!)
  })

  it('again on a new card stays in learning without counting a lapse', () => {
    const { card } = gradeCard(newCard(), 'again', NOW)
    expect(card.state).toBe('learning')
    expect(card.lapses).toBe(0)
  })

  it('recovers with shrunken stability after a lapse (no runaway intervals)', () => {
    let card = newCard()
    for (let i = 0; i < 4; i += 1) card = gradeCard(card, 'good', NOW).card
    const beforeLapse = card.intervalDays
    card = gradeCard(card, 'again', NOW).card
    card = gradeCard(card, 'good', NOW).card
    expect(card.state).toBe('review')
    expect(card.intervalDays).toBeLessThan(beforeLapse)
    expect(card.intervalDays).toBeGreaterThanOrEqual(1)
  })

  it('caps intervals so overdue cards never explode', () => {
    let card = newCard()
    for (let i = 0; i < 30; i += 1) card = gradeCard(card, 'easy', NOW).card
    expect(card.intervalDays).toBeLessThanOrEqual(120)
  })
})

describe('buildDueCardQueue', () => {
  it('returns only due cards, learning steps first, oldest first, capped', () => {
    const due1 = { ...newCard(), id: 'c1', dueAt: '2026-07-09T00:00:00.000Z', state: 'review' as const }
    const due2 = { ...newCard(), id: 'c2', dueAt: '2026-07-08T00:00:00.000Z', state: 'review' as const }
    const relearn = { ...newCard(), id: 'c3', dueAt: '2026-07-10T07:59:00.000Z', state: 'relearning' as const }
    const future = { ...newCard(), id: 'c4', dueAt: '2026-07-11T00:00:00.000Z', state: 'review' as const }
    const suspended = { ...newCard(), id: 'c5', dueAt: '2026-07-01T00:00:00.000Z', state: 'suspended' as const }

    const queue = buildDueCardQueue([due1, due2, relearn, future, suspended], NOW)
    expect(queue.map((card) => card.id)).toEqual(['c3', 'c2', 'c1'])
    expect(buildDueCardQueue([due1, due2, relearn], NOW, 2)).toHaveLength(2)
  })
})

describe('reviewLoadSummary', () => {
  it('splits due cards into overdue (before today) vs due today', () => {
    const overdue = { ...newCard(), id: 'c1', dueAt: '2026-07-09T12:00:00.000Z', state: 'review' as const }
    const dueToday = { ...newCard(), id: 'c2', dueAt: '2026-07-10T01:00:00.000Z', state: 'review' as const }
    const future = { ...newCard(), id: 'c3', dueAt: '2026-07-12T00:00:00.000Z', state: 'review' as const }
    const suspended = { ...newCard(), id: 'c4', dueAt: '2026-07-01T00:00:00.000Z', state: 'suspended' as const }
    const summary = reviewLoadSummary([overdue, dueToday, future, suspended], NOW)
    expect(summary).toEqual({ overdueCount: 1, dueTodayCount: 1, totalCards: 4 })
  })

  it('returns zeros for an empty deck', () => {
    expect(reviewLoadSummary([], NOW)).toEqual({ overdueCount: 0, dueTodayCount: 0, totalCards: 0 })
  })
})

describe('previewInterval', () => {
  it('previews minutes for again and days for good/easy', () => {
    const card = newCard()
    expect(previewInterval(card, 'again', NOW)).toEqual({ minutes: 10 })
    expect(previewInterval(card, 'good', NOW)).toEqual({ days: 1 })
    expect(previewInterval(card, 'easy', NOW)).toEqual({ days: 3 })
  })
})

describe('resolveCardFace', () => {
  // The card is the surface that drills an answer into memory on a schedule, so
  // a key corrected in the bank has to reach it. Cards snapshot the answer at
  // creation, which is exactly how a stale key would survive a correction.
  it('shows the corrected key, not the answer snapshotted when the card was made', () => {
    const card = newCard() // key was 3 when this card was created
    const corrected = { ...QUESTION, answers: [2] }

    const face = resolveCardFace(card, corrected)

    expect(card.answer).toBe('3. 丙') // the stale snapshot is still on the card
    expect(face.answer).toBe('2. 乙') // but the learner is shown the live key
    expect(face.corrected).toBe(true)
  })

  it('follows a corrected option text too', () => {
    const card = newCard()
    const face = resolveCardFace(card, { ...QUESTION, options: ['甲', '乙', '丙（修正）', '丁'] })
    expect(face.answer).toBe('3. 丙（修正）')
    expect(face.corrected).toBe(true)
  })

  it('follows a reworded prompt', () => {
    const card = newCard()
    const face = resolveCardFace(card, { ...QUESTION, prompt: '下列何者正確？（修正）' })
    expect(face.prompt).toBe('下列何者正確？（修正）')
  })

  it('does not cry correction when the bank still agrees', () => {
    const card = newCard()
    const face = resolveCardFace(card, QUESTION)
    expect(face).toEqual({ prompt: QUESTION.prompt, answer: '3. 丙', corrected: false })
  })

  // A pack can drop a question; the card outlives it and must still be reviewable.
  it('falls back to the snapshot when the question left the bank', () => {
    const card = newCard()
    const face = resolveCardFace(card, undefined)
    expect(face).toEqual({ prompt: card.prompt, answer: card.answer, corrected: false })
  })

  it('handles multi-answer keys', () => {
    const card = createQuestionCard('web-design-b', { ...QUESTION, answers: [1, 3] }, NOW)
    const face = resolveCardFace(card, { ...QUESTION, answers: [1, 4] })
    expect(face.answer).toBe('1. 甲\n4. 丁')
    expect(face.corrected).toBe(true)
  })
})
