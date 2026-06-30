import { describe, expect, it } from 'vitest'
import {
  applyAttempt,
  buildAdaptiveQueue,
  buildFreshQueue,
  buildHighYieldQueue,
  buildMockQueue,
  buildRandomQueue,
  buildSprintQueue,
  createProgress,
  scoreAnswer,
  type Progress,
  type Question,
} from './studyEngine'

const questions: Question[] = [
  {
    id: '01-001',
    section: '01',
    number: 1,
    kind: 'single',
    prompt: 'Single choice',
    options: ['A', 'B', 'C', 'D'],
    answers: [2],
  },
  {
    id: '01-002',
    section: '01',
    number: 2,
    kind: 'multiple',
    prompt: 'Multiple choice',
    options: ['A', 'B', 'C', 'D'],
    answers: [1, 3],
  },
  {
    id: '02-001',
    section: '02',
    number: 1,
    kind: 'single',
    prompt: 'Unseen',
    options: ['A', 'B', 'C', 'D'],
    answers: [4],
  },
]

describe('scoreAnswer', () => {
  it('requires an exact match for multiple-answer questions', () => {
    expect(scoreAnswer(questions[1], [1, 3])).toBe(true)
    expect(scoreAnswer(questions[1], [1])).toBe(false)
    expect(scoreAnswer(questions[1], [1, 2, 3])).toBe(false)
  })

  it('scores by official option numbers, independent of shuffled display order', () => {
    const displayOrder = [4, 2, 1, 3]
    const selectedOfficialOption = displayOrder[0]

    expect(scoreAnswer({ ...questions[0], answers: [4] }, [selectedOfficialOption])).toBe(true)
  })
})

describe('applyAttempt', () => {
  it('schedules a wrong answer soon and records the selected options', () => {
    const now = new Date('2026-06-23T08:00:00.000Z')
    const result = applyAttempt(createProgress('01-001'), {
      selected: [1],
      correct: false,
      guessed: false,
      elapsedMs: 4200,
      answeredAt: now,
    })

    expect(result.attempts).toBe(1)
    expect(result.wrong).toBe(1)
    expect(result.streak).toBe(0)
    expect(result.lastSelected).toEqual([1])
    expect(result.nextReviewAt).toBe('2026-06-23T08:10:00.000Z')
  })

  it('keeps a guessed correct answer in near-term review', () => {
    const now = new Date('2026-06-23T08:00:00.000Z')
    const result = applyAttempt(createProgress('01-001'), {
      selected: [2],
      correct: true,
      guessed: true,
      elapsedMs: 2000,
      answeredAt: now,
    })

    expect(result.correct).toBe(1)
    expect(result.guessed).toBe(1)
    expect(result.nextReviewAt).toBe('2026-06-23T12:00:00.000Z')
  })
})

describe('buildAdaptiveQueue', () => {
  it('prioritizes due wrong answers, then weak answers, then unseen questions', () => {
    const progress: Record<string, Progress> = {
      '01-001': {
        ...createProgress('01-001'),
        attempts: 2,
        wrong: 2,
        nextReviewAt: '2026-06-23T07:00:00.000Z',
      },
      '01-002': {
        ...createProgress('01-002'),
        attempts: 3,
        correct: 1,
        wrong: 2,
        nextReviewAt: '2026-06-24T07:00:00.000Z',
      },
    }

    const result = buildAdaptiveQueue(
      questions,
      progress,
      3,
      new Date('2026-06-23T08:00:00.000Z'),
      () => 0.5,
    )

    expect(result.map((question) => question.id)).toEqual([
      '01-001',
      '01-002',
      '02-001',
    ])
  })
})

describe('practice queue builders', () => {
  it('builds random queues without duplicates and respects filters', () => {
    const result = buildRandomQueue(questions, 2, {
      section: '01',
      kind: 'all',
      random: () => 0.4,
    })

    expect(result).toHaveLength(2)
    expect(new Set(result.map((question) => question.id)).size).toBe(2)
    expect(result.every((question) => question.section === '01')).toBe(true)
  })

  it('builds fresh queues from unseen first, then least-attempted items', () => {
    const progress: Record<string, Progress> = {
      '01-001': { ...createProgress('01-001'), attempts: 3, lastAnsweredAt: '2026-06-23T08:00:00.000Z' },
      '01-002': { ...createProgress('01-002'), attempts: 1, lastAnsweredAt: '2026-06-24T08:00:00.000Z' },
    }

    const result = buildFreshQueue(questions, progress, 2, () => 0.4)

    expect(result.map((question) => question.id)).toEqual(['02-001', '01-002'])
  })

  it('builds the official mock: 60/20 split, 55 from 17300, 9 from 90011, 4 per common subject', () => {
    const core: Question[] = [
      ...Array.from({ length: 50 }, (_, index) => ({ ...questions[0], id: `o-s-${index}`, subjectCode: '17300' })),
      ...Array.from({ length: 25 }, (_, index) => ({ ...questions[1], id: `o-m-${index}`, subjectCode: '17300' })),
      ...Array.from({ length: 15 }, (_, index) => ({ ...questions[0], id: `i-${index}`, subjectCode: '90011' })), // 90011 is single-only
    ]
    const common = ['90006', '90007', '90008', '90009'].flatMap((subjectCode) =>
      Array.from({ length: 10 }, (_, index) => ({ ...questions[0], id: `${subjectCode}-${index}`, subjectCode })),
    )

    const result = buildMockQueue([...core, ...common], () => 0.25)

    expect(result).toHaveLength(80)
    expect(result.filter((question) => question.kind === 'single')).toHaveLength(60)
    expect(result.filter((question) => question.kind === 'multiple')).toHaveLength(20)
    expect(result.filter((question) => question.subjectCode === '17300')).toHaveLength(55)
    expect(result.filter((question) => question.subjectCode === '90011')).toHaveLength(9)
    for (const subjectCode of ['90006', '90007', '90008', '90009']) {
      expect(result.filter((question) => question.subjectCode === subjectCode)).toHaveLength(4)
    }
  })
})

describe('buildSprintQueue', () => {
  const seed = () => () => 0.42
  const bank: Question[] = [
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `g-${i}`, section: '90006-01', number: i, kind: 'single' as const,
      prompt: 'g', options: ['A', 'B', 'C', 'D'], answers: [1], sourceGroup: 'general-common' as const,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `o-${i}`, section: '17300-01', number: i, kind: 'single' as const,
      prompt: 'o', options: ['A', 'B', 'C', 'D'], answers: [1], sourceGroup: 'occupation' as const,
    })),
  ]

  it('returns 20 questions with at least four common-subject items', () => {
    const queue = buildSprintQueue(bank, {}, 20, new Date('2026-06-24T00:00:00Z'), seed())
    expect(queue).toHaveLength(20)
    const common = queue.filter((q) => q.sourceGroup === 'general-common').length
    expect(common).toBeGreaterThanOrEqual(4)
    expect(new Set(queue.map((q) => q.id)).size).toBe(20)
  })
})

describe('buildHighYieldQueue', () => {
  const make = (subjectCode: string, index: number): Question => ({
    id: `${subjectCode}-${index}`,
    section: `${subjectCode}-01`,
    number: index,
    kind: 'single',
    prompt: `${subjectCode} ${index}`,
    options: ['A', 'B', 'C', 'D'],
    answers: [1],
    subjectCode,
    sourceGroup: subjectCode === '17300' ? 'occupation' : subjectCode === '90011' ? 'information-common' : 'general-common',
  })
  const bank = [
    ...Array.from({ length: 30 }, (_, index) => make('17300', index)),
    ...Array.from({ length: 8 }, (_, index) => make('90011', index)),
    ...['90006', '90007', '90008', '90009'].flatMap((code) => Array.from({ length: 4 }, (_, index) => make(code, index))),
  ]

  it('uses the official mock mix scaled to 20 questions', () => {
    const queue = buildHighYieldQueue(bank, {}, 20, new Date('2026-07-01T00:00:00Z'), () => 0.42)

    expect(queue).toHaveLength(20)
    expect(queue.filter((question) => question.subjectCode === '17300')).toHaveLength(14)
    expect(queue.filter((question) => question.subjectCode === '90011')).toHaveLength(2)
    for (const code of ['90006', '90007', '90008', '90009']) {
      expect(queue.filter((question) => question.subjectCode === code)).toHaveLength(1)
    }
  })
})

describe('buildSprintQueue weighting', () => {
  const occ = (id: string): Question => ({
    id, section: '17300-01', number: 1, kind: 'single', prompt: id,
    options: ['A', 'B', 'C', 'D'], answers: [1], sourceGroup: 'occupation',
  })
  const items = [occ('wrong'), occ('guessed'), occ('due'), occ('unseen'), occ('settled')]
  const past = '2026-06-20T00:00:00.000Z'
  const future = '2026-12-01T00:00:00.000Z'
  const progress: Record<string, Progress> = {
    wrong: { ...createProgress('wrong'), attempts: 2, wrong: 2, streak: 0, nextReviewAt: past },
    guessed: { ...createProgress('guessed'), attempts: 1, guessed: 1, streak: 0, nextReviewAt: past },
    due: { ...createProgress('due'), attempts: 1, correct: 1, streak: 1, nextReviewAt: past },
    settled: { ...createProgress('settled'), attempts: 3, correct: 3, streak: 3, nextReviewAt: future },
    // 'unseen' has no entry
  }

  it('selects wrong, guessed and due over unseen and settled', () => {
    const queue = buildSprintQueue(items, progress, 3, new Date('2026-06-24T00:00:00Z'), () => 0.42)
    const ids = new Set(queue.map((q) => q.id))
    expect(ids).toEqual(new Set(['wrong', 'guessed', 'due']))
  })
})
