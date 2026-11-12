import { describe, expect, it } from 'vitest'
import { EXAM_ALIASES, examAliases } from './examAliases'
import { examAliasCopy } from './examFaqs'
import { GENERATED_LANDING_CATALOG } from './generatedLandingCatalog'

const live = new Map<string, string>(GENERATED_LANDING_CATALOG.exams.map((exam) => [exam.examId, exam.titleZh]))

describe('exam aliases', () => {
  it('only names live exams', () => {
    for (const examId of Object.keys(EXAM_ALIASES)) expect(live.has(examId), examId).toBe(true)
  })

  it('never repeats the official title it stands in for', () => {
    for (const [examId, names] of Object.entries(EXAM_ALIASES)) {
      for (const name of names) expect(live.get(examId)?.includes(name), `${examId}: ${name}`).toBe(false)
    }
  })

  it('treats a name shared by several exams as a family, not an alias', () => {
    expect(examAliases('chinese-cooking-meat-c')).toEqual([{ name: '中餐丙級', siblings: ['chinese-cooking-vegetarian-c'] }])
    const copy = examAliasCopy('chinese-cooking-meat-c')
    expect(copy.plain).toEqual([])
    expect(copy.families).toEqual([{ name: '中餐丙級', titles: '中餐烹調－葷食丙級、中餐烹調－素食丙級' }])
  })

  it('gives a plain alias to a single exam', () => {
    expect(examAliasCopy('computer-software-application-c')).toEqual({ plain: ['軟丙', '丙軟', '電軟丙級'], families: [] })
    expect(examAliasCopy('surveying-c')).toEqual({ plain: [], families: [] })
  })
})
