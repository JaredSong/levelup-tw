import { describe, expect, it } from 'vitest'
import type { ExamManifest } from '../core/exam'
import { INSTALLED_EXAMS } from './activeExam'
import {
  EN_CATEGORY,
  applicantCount,
  categorySlug,
  examCode,
  groupByCategory,
  levelsOf,
  matchesFilter,
  parseDemandPeriod,
  rankByDemand,
} from './examCatalog'
import { GENERATED_LANDING_CATALOG } from './generatedLandingCatalog'

const exam = (overrides: Partial<ExamManifest>): ExamManifest => ({
  examId: 'x', level: '丙級', titleZh: '測試丙級', titleEn: 'Test Class C', category: '資訊', version: 'A1',
  sections: [{ id: '11800-01', subjectCode: '11800', sourceGroup: 'occupation', titleZh: '一', questionCount: 1, activeQuestionCount: 1 }],
  mockRules: { totalQuestions: 80, singleCount: 80, multipleCount: 0, durationMinutes: 100, passScore: 60, maxScore: 100, weightSingle: 1.25, weightMultiple: 0 },
  questionCount: 1, activeQuestionCount: 1,
  ...overrides,
} as ExamManifest)

describe('exam catalog', () => {
  it('gives every published category a unique, ASCII anchor', () => {
    const groups = groupByCategory(INSTALLED_EXAMS)
    for (const group of groups) expect(EN_CATEGORY[group.category], group.category).toBeTruthy()
    const slugs = groups.map((group) => group.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^cat-[a-z0-9-]+$/)
  })

  it('groups keep every exam exactly once and total their questions', () => {
    const groups = groupByCategory(INSTALLED_EXAMS)
    expect(groups.flatMap((group) => group.exams).length).toBe(INSTALLED_EXAMS.length)
    const total = INSTALLED_EXAMS.reduce((sum, e) => sum + e.activeQuestionCount, 0)
    expect(groups.reduce((sum, group) => sum + group.questionCount, 0)).toBe(total)
  })

  it('falls back to a positional slug for an unmapped category', () => {
    expect(categorySlug('未知職類', 4)).toBe('cat-5')
    expect(categorySlug('餐飲食品')).toBe('cat-food-beverage')
  })

  it('orders levels entry-level first', () => {
    expect(levelsOf([exam({ level: '單一級' }), exam({ level: '乙級' }), exam({ level: '丙級' })])).toEqual(['丙級', '乙級', '單一級'])
  })

  it('searches by name, code, category and English, all terms required', () => {
    const e = exam({})
    expect(matchesFilter(e, { query: '11800', level: '', category: '' })).toBe(true)
    expect(matchesFilter(e, { query: '測試', level: '', category: '' })).toBe(true)
    expect(matchesFilter(e, { query: 'information', level: '', category: '' })).toBe(true)
    expect(matchesFilter(e, { query: '測試 乙級', level: '', category: '' })).toBe(false)
    expect(matchesFilter(e, { query: '', level: '乙級', category: '' })).toBe(false)
    expect(matchesFilter(e, { query: '', level: '', category: '資訊' })).toBe(true)
  })

  it('uses the occupation subject code, not a shared subject', () => {
    expect(examCode(exam({ sections: [
      { id: '90006-01', subjectCode: '90006', sourceGroup: 'common', titleZh: '職安', questionCount: 1, activeQuestionCount: 1 },
      { id: '15100-01', subjectCode: '15100', sourceGroup: 'occupation', titleZh: '堆高機', questionCount: 1, activeQuestionCount: 1 },
    ] as ExamManifest['sections'] }))).toBe('15100')
  })
})

describe('official demand figures', () => {
  it('parses the published period and refuses anything else', () => {
    expect(parseDemandPeriod('115年截至9月底止通過技能檢定學術科測試')).toEqual({ year: 115, month: 9 })
    expect(parseDemandPeriod('統計資料')).toBeNull()
  })

  it('carries a source URL for the counts it quotes', () => {
    expect(GENERATED_LANDING_CATALOG.demandSource).toMatch(/^https:\/\/www\.wdasec\.gov\.tw\//)
  })

  it('reports counts straight from the generated catalog, never invents one', () => {
    for (const entry of GENERATED_LANDING_CATALOG.exams) {
      const count = applicantCount(entry.examId)
      if (entry.applicantCount) expect(count).toBe(entry.applicantCount)
      else expect(count).toBeNull()
    }
  })

  it('ranks installed exams by registrations', () => {
    const ranked = rankByDemand(INSTALLED_EXAMS)
    expect(ranked.length).toBe(INSTALLED_EXAMS.length)
    const counts = ranked.map((e) => applicantCount(e.examId) ?? -1)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
  })
})
