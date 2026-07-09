import { describe, expect, it } from 'vitest'
import { questionKey } from './exam'
import {
  CARD_SCHEMA_VERSION,
  type Attempt,
  type DailyMission,
  type KnowledgeAtom,
  type MockExamRun,
  type ReviewCard,
  type ReviewLog,
  type StudyEvent,
  type WrongBookItem,
} from './contracts'

describe('learning contracts', () => {
  const key = questionKey('web-design-b', '17300-02-247')

  it('keeps attempts tied to the official question through a namespaced key', () => {
    const attempt: Attempt = {
      id: 'attempt-1',
      profileId: 'local-profile',
      examId: 'web-design-b',
      questionId: '17300-02-247',
      questionKey: key,
      mode: 'wrong-review',
      selected: [3],
      correctAnswers: [2],
      correct: false,
      guessed: false,
      elapsedMs: 12_000,
      answeredAt: '2026-07-09T09:00:00.000Z',
    }

    expect(attempt.questionKey).toBe('web-design-b:17300-02-247')
    expect(attempt.questionId).toBe('17300-02-247')
    expect(attempt.selected).toEqual([3])
  })

  it('separates wrong-book state from raw attempts', () => {
    const wrongItem: WrongBookItem = {
      profileId: 'local-profile',
      examId: 'web-design-b',
      questionId: '17300-02-247',
      questionKey: key,
      status: 'active',
      wrongCount: 2,
      correctStreak: 0,
      lastAttemptId: 'attempt-2',
      lastWrongAt: '2026-07-09T09:05:00.000Z',
      nextReviewAt: '2026-07-09T09:15:00.000Z',
      updatedAt: '2026-07-09T09:05:00.000Z',
    }

    expect(wrongItem.status).toBe('active')
    expect(wrongItem.lastAttemptId).toBe('attempt-2')
  })

  it('lets one official question generate independently scheduled memory cards', () => {
    const atom: KnowledgeAtom = {
      id: 'atom-normalization-repeat',
      examId: 'web-design-b',
      questionKeys: [key],
      kind: 'rule',
      front: '資料庫正規化會讓資料重複性如何變化？',
      back: '正規化程度越高，資料重複性越低。',
      memoryCue: '拆表是為了少重複，不是為了少表。',
      tags: ['17300-01', 'database', 'normalization'],
      source: 'curated',
      createdAt: '2026-07-09T09:10:00.000Z',
      updatedAt: '2026-07-09T09:10:00.000Z',
    }

    const card: ReviewCard = {
      id: 'card-normalization-repeat',
      schemaVersion: CARD_SCHEMA_VERSION,
      profileId: 'local-profile',
      examId: 'web-design-b',
      atomId: atom.id,
      questionKeys: atom.questionKeys,
      prompt: atom.front,
      answer: atom.back,
      state: 'learning',
      dueAt: '2026-07-10T09:10:00.000Z',
      stability: 1,
      difficulty: 5,
      retrievability: 0.9,
      intervalDays: 1,
      reps: 0,
      lapses: 0,
      createdAt: '2026-07-09T09:10:00.000Z',
      updatedAt: '2026-07-09T09:10:00.000Z',
    }

    expect(card.atomId).toBe(atom.id)
    expect(card.questionKeys).toEqual([key])
    expect(card.dueAt).not.toBe(atom.updatedAt)
  })

  it('records review logs without overwriting the card schedule history', () => {
    const log: ReviewLog = {
      id: 'review-log-1',
      profileId: 'local-profile',
      cardId: 'card-normalization-repeat',
      examId: 'web-design-b',
      rating: 'good',
      reviewedAt: '2026-07-10T09:15:00.000Z',
      elapsedMs: 6_000,
      previousDueAt: '2026-07-10T09:10:00.000Z',
      nextDueAt: '2026-07-13T09:15:00.000Z',
    }

    expect(log.rating).toBe('good')
    expect(log.previousDueAt).not.toBe(log.nextDueAt)
  })

  it('models mocks, missions, and telemetry as separate local-first records', () => {
    const mock: MockExamRun = {
      id: 'mock-1',
      profileId: 'local-profile',
      examId: 'web-design-b',
      mode: 'official',
      startedAt: '2026-07-09T10:00:00.000Z',
      completedAt: '2026-07-09T11:20:00.000Z',
      durationMinutes: 100,
      score: 62.5,
      passed: true,
      questionKeys: [key],
      answers: [{ questionKey: key, selected: [2], correctAnswers: [2], correct: true }],
    }

    const mission: DailyMission = {
      id: 'mission-2026-07-09',
      profileId: 'local-profile',
      examId: 'web-design-b',
      date: '2026-07-09',
      status: 'active',
      items: [
        { id: 'mission-item-1', type: 'due-review', targetCount: 10, completedCount: 3 },
        { id: 'mission-item-2', type: 'fresh-questions', targetCount: 10, completedCount: 0 },
      ],
      createdAt: '2026-07-09T00:00:00.000Z',
      updatedAt: '2026-07-09T10:00:00.000Z',
    }

    const event: StudyEvent = {
      id: 'event-1',
      profileId: 'local-profile',
      examId: 'web-design-b',
      type: 'attempt-recorded',
      entityType: 'attempt',
      entityId: 'attempt-1',
      occurredAt: '2026-07-09T09:00:01.000Z',
      metadata: { mode: 'wrong-review' },
    }

    expect(mock.answers[0].questionKey).toBe(key)
    expect(mission.items.map((item) => item.type)).toEqual(['due-review', 'fresh-questions'])
    expect(event.entityType).toBe('attempt')
  })
})
