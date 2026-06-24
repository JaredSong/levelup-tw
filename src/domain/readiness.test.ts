import { describe, expect, it } from 'vitest'
import { computeReadiness } from './readiness'
import { createProgress, type Progress, type Question } from './studyEngine'
import type { AttemptRecord } from '../storage/db'

function q(id: string, section: string, sourceGroup: Question['sourceGroup'], subjectCode: string): Question {
  return { id, section, number: 1, kind: 'single', prompt: id, options: ['A', 'B', 'C', 'D'], answers: [1], sourceGroup, subjectCode }
}

function attempt(questionId: string, answeredAt: string, correct: boolean): AttemptRecord {
  return { questionId, selected: [1], correct, guessed: false, elapsedMs: 100, answeredAt, mode: 'adaptive' }
}

describe('computeReadiness', () => {
  it('flags a group below 60% coverage as weak', () => {
    const bank = Array.from({ length: 10 }, (_, i) => q(`a-${i}`, '17300-01', 'occupation', '17300'))
    const progress: Record<string, Progress> = {
      'a-0': { ...createProgress('a-0'), attempts: 1, correct: 1, streak: 1 },
      'a-1': { ...createProgress('a-1'), attempts: 1, correct: 1, streak: 1 },
    }
    const attempts = [attempt('a-0', '2026-06-24T00:00:00Z', true), attempt('a-1', '2026-06-24T00:01:00Z', true)]
    const { groups } = computeReadiness(bank, progress, attempts)
    const g = groups.find((x) => x.section === '17300-01')!
    expect(g.coverage).toBeCloseTo(0.2)
    expect(g.status).toBe('weak')
  })

  it('uses the last 20 attempts for recent accuracy, not lifetime', () => {
    const bank = Array.from({ length: 30 }, (_, i) => q(`a-${i}`, '17300-01', 'occupation', '17300'))
    const progress: Record<string, Progress> = {}
    for (const question of bank) progress[question.id] = { ...createProgress(question.id), attempts: 1, correct: 1, streak: 2 }
    // 10 oldest wrong, 20 newest correct → lifetime 20/30, recent 20/20.
    const attempts = bank.map((question, i) => attempt(question.id, `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`, i >= 10))
    const { groups } = computeReadiness(bank, progress, attempts)
    const g = groups.find((x) => x.section === '17300-01')!
    expect(g.recentAccuracy).toBe(1)
  })

  it('never marks a group ready while coverage is low', () => {
    const bank = Array.from({ length: 10 }, (_, i) => q(`a-${i}`, '17300-01', 'occupation', '17300'))
    const progress: Record<string, Progress> = {}
    const attempts: AttemptRecord[] = []
    for (let i = 0; i < 5; i += 1) { // only 5/10 seen, all correct
      progress[`a-${i}`] = { ...createProgress(`a-${i}`), attempts: 1, correct: 1, streak: 2 }
      attempts.push(attempt(`a-${i}`, `2026-06-2${i}T00:00:00Z`, true))
    }
    const g = computeReadiness(bank, progress, attempts).groups.find((x) => x.section === '17300-01')!
    expect(g.coverage).toBeLessThan(0.6)
    expect(g.status).not.toBe('ready')
  })

  it('weights each common subject by mock composition (4/80)', () => {
    const bank = ['90006-01', '90007-01', '90008-03', '90009-04'].flatMap((section) =>
      Array.from({ length: 100 }, (_, i) => q(`${section}-${i}`, section, 'general-common', section.slice(0, 5))),
    )
    const { groups } = computeReadiness(bank, {}, [])
    for (const g of groups) expect(g.weight).toBeCloseTo(4 / 80)
  })

  it('weights 17300 to 55/80 and 90011 to 9/80 across their sections', () => {
    const bank = [
      ...Array.from({ length: 60 }, (_, i) => q(`o1-${i}`, '17300-01', 'occupation', '17300')),
      ...Array.from({ length: 40 }, (_, i) => q(`o2-${i}`, '17300-02', 'occupation', '17300')),
      ...Array.from({ length: 12 }, (_, i) => q(`i1-${i}`, '90011-01', 'information-common', '90011')),
      ...Array.from({ length: 8 }, (_, i) => q(`i2-${i}`, '90011-02', 'information-common', '90011')),
    ]
    const { groups } = computeReadiness(bank, {}, [])
    const sum = (kind: string) => groups.filter((g) => g.kind === kind).reduce((s, g) => s + g.weight, 0)
    expect(sum('occupation')).toBeCloseTo(55 / 80)
    expect(sum('information-common')).toBeCloseTo(9 / 80)
  })
})
