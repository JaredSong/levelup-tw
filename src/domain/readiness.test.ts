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

// Weights come from the pack's official mock composition, so every test names
// its composition explicitly instead of relying on per-trade defaults.
function rules(quota: Record<string, number>, totalQuestions = 80) {
  return {
    totalQuestions,
    subjectQuota: Object.entries(quota).map(([subjectCode, count]) => ({ subjectCode, count })),
  }
}

describe('computeReadiness', () => {
  it('flags a group below 60% coverage as weak', () => {
    const bank = Array.from({ length: 10 }, (_, i) => q(`a-${i}`, '17300-01', 'occupation', '17300'))
    const progress: Record<string, Progress> = {
      'a-0': { ...createProgress('a-0'), attempts: 1, correct: 1, streak: 1 },
      'a-1': { ...createProgress('a-1'), attempts: 1, correct: 1, streak: 1 },
    }
    const attempts = [attempt('a-0', '2026-06-24T00:00:00Z', true), attempt('a-1', '2026-06-24T00:01:00Z', true)]
    const { groups } = computeReadiness(bank, progress, attempts, rules({ '17300': 55 }))
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
    const { groups } = computeReadiness(bank, progress, attempts, rules({ '17300': 55 }))
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
    const g = computeReadiness(bank, progress, attempts, rules({ '17300': 55 })).groups.find((x) => x.section === '17300-01')!
    expect(g.coverage).toBeLessThan(0.6)
    expect(g.status).not.toBe('ready')
  })

  it('weights each subject by its own mock quota, split across sections by size', () => {
    const bank = [
      ...Array.from({ length: 60 }, (_, i) => q(`o1-${i}`, '17300-01', 'occupation', '17300')),
      ...Array.from({ length: 40 }, (_, i) => q(`o2-${i}`, '17300-02', 'occupation', '17300')),
      ...Array.from({ length: 12 }, (_, i) => q(`i1-${i}`, '90011-01', 'information-common', '90011')),
      ...Array.from({ length: 8 }, (_, i) => q(`i2-${i}`, '90011-02', 'information-common', '90011')),
      ...['90006-01', '90007-01', '90008-03', '90009-04'].flatMap((section) =>
        Array.from({ length: 100 }, (_, i) => q(`${section}-${i}`, section, 'general-common', section.slice(0, 5))),
      ),
    ]
    const quota = rules({ '17300': 55, '90011': 9, '90006': 4, '90007': 4, '90008': 4, '90009': 4 })
    const { groups } = computeReadiness(bank, {}, [], quota)
    const sum = (kind: string) => groups.filter((g) => g.kind === kind).reduce((s, g) => s + g.weight, 0)
    expect(sum('occupation')).toBeCloseTo(55 / 80)
    expect(sum('information-common')).toBeCloseTo(9 / 80)
    for (const g of groups.filter((x) => x.kind === 'general-common')) expect(g.weight).toBeCloseTo(4 / 80)
    // Section split within a subject follows bank size: 60/100 vs 40/100 of 55/80.
    expect(groups.find((x) => x.section === '17300-01')!.weight).toBeCloseTo((60 / 100) * (55 / 80))
    expect(groups.find((x) => x.section === '17300-02')!.weight).toBeCloseTo((40 / 100) * (55 / 80))
  })

  it('follows each pack\'s own composition — 電腦軟體應用丙級 draws 90011 at 4/80, not 網頁設計\'s 9/80', () => {
    // Regression: hardcoded constants assumed every pack containing 90011 used
    // 網頁設計乙級's 55/9 split; 電腦軟體應用丙級 is officially 60/4.
    const bank = [
      ...Array.from({ length: 100 }, (_, i) => q(`o-${i}`, '11800-01', 'occupation', '11800')),
      ...Array.from({ length: 20 }, (_, i) => q(`i-${i}`, '90011-01', 'information-common', '90011')),
      ...['90006-01', '90007-01', '90008-03', '90009-04'].flatMap((section) =>
        Array.from({ length: 10 }, (_, i) => q(`${section}-${i}`, section, 'general-common', section.slice(0, 5))),
      ),
    ]
    const quota = rules({ '11800': 60, '90011': 4, '90006': 4, '90007': 4, '90008': 4, '90009': 4 })
    const { groups } = computeReadiness(bank, {}, [], quota)
    expect(groups.find((x) => x.subjectCode === '11800')!.weight).toBeCloseTo(60 / 80)
    expect(groups.find((x) => x.subjectCode === '90011')!.weight).toBeCloseTo(4 / 80)
  })

  it('gives zero weight to a subject the mock never draws', () => {
    const bank = [
      ...Array.from({ length: 10 }, (_, i) => q(`o-${i}`, '20600-01', 'occupation', '20600')),
      ...Array.from({ length: 10 }, (_, i) => q(`x-${i}`, '99999-01', 'general-common', '99999')),
    ]
    const { groups } = computeReadiness(bank, {}, [], rules({ '20600': 60 }))
    expect(groups.find((x) => x.subjectCode === '99999')!.weight).toBe(0)
    expect(groups.find((x) => x.subjectCode === '20600')!.weight).toBeCloseTo(60 / 80)
  })
})
