import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Question = { id: string; prompt: string; options: string[] }
const bank = (examId: string) => {
  const data = JSON.parse(readFileSync(new URL(`../public/data/exams/${examId}/questions.json`, import.meta.url), 'utf8'))
  return new Map(((Array.isArray(data) ? data : data.questions) as Question[]).map((question) => [question.id, question]))
}

// Content the official PDF prints differently from what shipped before (cross-checked against an
// independent copy of the same bank version; the PDF image decided).
describe('official text corrections', () => {
  it('04200-02-080 ② is ±√34 mm, as printed', () => {
    expect(bank('surveying-c').get('04200-02-080')?.options[1]).toBe('±⟦\\sqrt{34}⟧ mm')
  })
  it('04202-03-030 ③④ keep S₁ over S₂, as printed', () => {
    const options = bank('engineering-surveying-b').get('04202-03-030')!.options
    for (const option of options) expect(option).toMatch(/^⟦\\frac\{S_\{1\}·/)
  })
  it('01300-05-095 keeps both ⅄ and 04202-03-032 keeps the CP̅ = S definitions', () => {
    expect(bank('industrial-wiring-c').get('01300-05-095')?.prompt).toBe('三相 ⅄ 連接之電阻負載，若改為△連接，則功率為原來 ⅄ 連接時之')
    expect(bank('engineering-surveying-b').get('04202-03-032')?.prompt).toContain('⟦\\overline{CP_{1}}=S_{1}⟧')
  })
})
