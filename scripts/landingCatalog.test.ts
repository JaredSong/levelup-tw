import { describe, expect, it } from 'vitest'
import { buildLandingCatalog, officialCheckedDate, officialUpcoming } from './landingCatalog.mjs'

const manifests = [
  { examId: 'web-design-b', titleZh: '網頁設計乙級', level: '乙級', activeQuestionCount: 100, sections: [{ subjectCode: '17300', sourceGroup: 'occupation' }] },
  { examId: 'forklift-single', titleZh: '堆高機操作單一級', level: '單一級', activeQuestionCount: 200, sections: [{ subjectCode: '15100', sourceGroup: 'occupation' }] },
  { examId: 'drinks-c', titleZh: '飲料調製丙級', level: '丙級', activeQuestionCount: 300, sections: [{ subjectCode: '20600', sourceGroup: 'occupation' }] },
]

const demand = {
  period: '115年截至6月底止',
  source: 'https://www.wdasec.gov.tw/stats',
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
    expect(catalog.demandSource).toBe('https://www.wdasec.gov.tw/stats')
  })

  it('generates current search metadata from manifests', () => {
    const catalog = buildLandingCatalog(manifests, demand, 2)

    expect(catalog.metaDescription).toContain('3 種技術士技能檢定學科題庫')
    expect(catalog.metaDescription).toContain('堆高機操作單一級')
    expect(catalog.metaDescription).toContain('飲料調製丙級')
  })
})

describe('officialCheckedDate', () => {
  const now = new Date('2026-11-20T00:00:00Z')
  const ok = { generatedAt: '2026-11-16T00:39:17Z', installedDrift: { ok: true } }

  it('gives the Taiwan calendar date of a passing check', () => {
    expect(officialCheckedDate(ok, now)).toBe('2026-11-16')
    expect(officialCheckedDate({ ...ok, generatedAt: '2026-11-15T17:00:00Z' }, now)).toBe('2026-11-16')
  })

  it('makes no 最新版 claim when the check failed, is missing or is stale', () => {
    expect(officialCheckedDate({ ...ok, installedDrift: { ok: false } }, now)).toBeNull()
    expect(officialCheckedDate(null, now)).toBeNull()
    expect(officialCheckedDate(ok, new Date('2027-01-15T00:00:00Z'))).toBeNull()
  })
})

describe('officialUpcoming', () => {
  const now = new Date('2026-11-20T00:00:00Z')
  const check = (installedDrift: object) => ({ generatedAt: '2026-11-16T00:00:00Z', installedDrift: { ok: true, mismatches: [], missing: [], ...installedDrift } })
  const upcoming = (examId: string) => ({ examId, subjectCode: '90006', installed: '900060A12.pdf', effectiveFrom: '2027-01-01' })

  it('claims the announced year only for packs entirely on announced banks', () => {
    const official = check({ upcoming: [upcoming('a'), upcoming('b')], behindAnnounced: [{ examId: 'b', subjectCode: '12000' }] })
    expect(officialUpcoming(official, now)).toEqual({ a: '2027-01-01', b: null })
  })

  it('holds back a pack missing an announced source the catalog does not list', () => {
    const official = check({ upcoming: [upcoming('machining-c')], behindAnnounced: [] })
    const without = [{ examId: 'machining-c', sources: [{ subjectCode: '18500', version: 'A10' }] }]
    const withA13 = [{ examId: 'machining-c', sources: [{ subjectCode: '90001', version: 'A13', pdfFilename: '900013A13.pdf' }] }]
    expect(officialUpcoming(official, now, without)).toEqual({ 'machining-c': null })
    expect(officialUpcoming(official, now, withA13)).toEqual({ 'machining-c': '2027-01-01' })
  })

  it('claims nothing when the check is stale', () => {
    expect(officialUpcoming(check({ upcoming: [upcoming('a')] }), new Date('2027-02-01T00:00:00Z'))).toEqual({})
  })
})
