import { describe, expect, it } from 'vitest'
import { buildLandingCatalog } from './landingCatalog.mjs'

const manifests = [
  { examId: 'web-design-b', titleZh: '網頁設計乙級', level: '乙級', activeQuestionCount: 100, sections: [{ subjectCode: '17300', sourceGroup: 'occupation' }] },
  { examId: 'forklift-single', titleZh: '堆高機操作單一級', level: '單一級', activeQuestionCount: 200, sections: [{ subjectCode: '15100', sourceGroup: 'occupation' }] },
  { examId: 'drinks-c', titleZh: '飲料調製丙級', level: '丙級', activeQuestionCount: 300, sections: [{ subjectCode: '20600', sourceGroup: 'occupation' }] },
]

const demand = {
  period: '115年截至6月底止',
  ranking: [
    { code: '15100', level: '單一級', applicantCount: 12000 },
    { code: '20600', level: '丙級', applicantCount: 4000 },
    { code: '17300', level: '乙級', applicantCount: 10 },
  ],
}

describe('generated landing catalog', () => {
  it('features installed exams by official exact code-level demand', () => {
    const catalog = buildLandingCatalog(manifests, demand, 2)

    expect(catalog.featuredExamIds).toEqual(['forklift-single', 'drinks-c'])
    expect(catalog.examCount).toBe(3)
    expect(catalog.activeQuestionCount).toBe(600)
    expect(catalog.demandPeriod).toBe('115年截至6月底止')
  })

  it('generates current search metadata from manifests', () => {
    const catalog = buildLandingCatalog(manifests, demand, 2)

    expect(catalog.metaDescription).toContain('3 種技術士技能檢定學科題庫')
    expect(catalog.metaDescription).toContain('堆高機操作單一級')
    expect(catalog.metaDescription).toContain('飲料調製丙級')
  })
})
