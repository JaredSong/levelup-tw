import { describe, expect, it } from 'vitest'
import { INSTALLED_EXAMS } from './activeExam'
import { examSiblings } from './examSiblings'

const siblingIds = (id: string) =>
  examSiblings(INSTALLED_EXAMS.find((exam) => exam.examId === id)!, INSTALLED_EXAMS).map((item) => item.sibling.examId)

describe('exam siblings', () => {
  it('pairs the same 職類 across sub-types and levels', () => {
    expect(siblingIds('chinese-cooking-meat-c')).toEqual(expect.arrayContaining(['chinese-cooking-vegetarian-c', 'chinese-cooking-meat-b']))
    expect(siblingIds('computer-hardware-repair-b')).toEqual(['computer-hardware-repair-c'])
    expect(siblingIds('excavator-operation-single')).toEqual(['loader-operation-single'])
  })

  it('pairs exams with identical 專業工作項目 names even when the 職類 differs', () => {
    expect(siblingIds('occupational-safety-management-a').sort()).toEqual(['occupational-hygiene-management-a', 'occupational-safety-health-management-b'])
  })

  it('does not pair a same-category exam that merely shares some work items', () => {
    expect(siblingIds('chinese-cooking-meat-c')).not.toContain('western-cooking-c')
  })

  it('splits work items into shared and one-sided', () => {
    const meat = INSTALLED_EXAMS.find((exam) => exam.examId === 'chinese-cooking-meat-c')!
    const veg = examSiblings(meat, INSTALLED_EXAMS).find((item) => item.sibling.examId === 'chinese-cooking-vegetarian-c')!
    expect(veg.onlyHere).toContain('食物選購')
    expect(veg.onlyThere).toContain('食物性質之認識與選購')
    expect(veg.shared).toContain('食物貯存')
  })
})
