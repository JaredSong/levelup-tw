import { describe, expect, it } from 'vitest'
import { INSTALLED_EXAMS } from './activeExam'
import { examFaqJsonLd, examFaqs } from './examFaqs'

const exam = (id: string) => {
  const found = INSTALLED_EXAMS.find((candidate) => candidate.examId === id)
  if (!found) throw new Error(`missing pack ${id}`)
  return found
}

describe('exam page FAQ', () => {
  it('answers from the manifest, not hand-typed numbers', () => {
    const baking = exam('baking-food-c')
    const faqs = examFaqs(baking, new Date('2026-12-01T00:00:00'))
    const text = faqs.map((item) => `${item.q}\n${item.a}`).join('\n')
    expect(text).toContain(`共 ${baking.activeQuestionCount.toLocaleString('en-US')} 題`)
    expect(text).toContain(`學科共 ${baking.mockRules.totalQuestions} 題，全部是單選題，每題 ${baking.mockRules.weightSingle} 分`)
    expect(text).toContain(`${baking.mockRules.passScore} 分及格`)
    for (const source of baking.sources ?? []) expect(text).toContain(source.pdfFilename)
  })

  it('describes mixed single/multiple formats with their own weights', () => {
    const pack = INSTALLED_EXAMS.find((candidate) => candidate.mockRules.multipleCount > 0)!
    const format = examFaqs(pack, new Date('2026-12-01T00:00:00'))[1].a
    expect(format).toContain(`單選 ${pack.mockRules.singleCount} 題、每題 ${pack.mockRules.weightSingle} 分`)
    expect(format).toContain(`複選 ${pack.mockRules.multipleCount} 題、每題 ${pack.mockRules.weightMultiple} 分`)
  })

  it('lists each common subject once and never the occupation subject', () => {
    const baking = exam('baking-food-c')
    const common = examFaqs(baking, new Date('2026-12-01T00:00:00')).find((item) => item.q.includes('還會考什麼'))!
    const occupationTitle = baking.sections.find((section) => section.sourceGroup === 'occupation')!.titleZh
    expect(common.a).not.toContain(occupationTitle)
    const listed = common.a.split('：')[1].split('。')[0].split('、')
    expect(new Set(listed).size).toBe(listed.length)
  })

  it('names shared subjects by subject, not by their first 工作項目', () => {
    const common = (id: string) => examFaqs(exam(id), new Date('2026-12-01T00:00:00')).find((item) => item.q.includes('還會考什麼'))!.a
    expect(common('baking-food-c')).toContain('食品安全衛生及營養、職業安全衛生')
    expect(common('baking-food-c')).not.toContain('營養及健康飲食')
    expect(common('network-installation-c')).toContain('資訊相關職類、職業安全衛生')
    expect(common('network-installation-c')).not.toContain('資訊安全')
    expect(common('beauty-c')).toContain('美容美髮相關職類安全衛生')
  })

  it('only includes the schedule while a round is upcoming', () => {
    const baking = exam('baking-food-c')
    expect(examFaqs(baking, new Date('2026-10-01T00:00:00')).some((item) => item.q.includes('什麼時候報名'))).toBe(true)
    expect(examFaqs(baking, new Date('2027-06-01T00:00:00')).some((item) => item.q.includes('什麼時候報名'))).toBe(false)
  })

  it('marks up exactly the visible Q&As', () => {
    const baking = exam('baking-food-c')
    const now = new Date('2026-10-01T00:00:00')
    const ld = JSON.parse(examFaqJsonLd(baking, now))
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(examFaqs(baking, now).map((item) => item.q))
  })
})
