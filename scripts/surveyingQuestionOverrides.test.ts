import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { auditCandidate, extractOfficialKeysFromText, buildCandidateConfig, parseExamSpecifier } from './batchImport.mjs'
import { parseQuestionBank } from './questionParser.mjs'
import { applySurveyingQuestionOverride, SURVEYING_FIGURE_IDS, SURVEYING_QUESTION_OVERRIDES } from './surveyingQuestionOverrides.mjs'

const raw = readFileSync(new URL('../source/042003A11-raw.txt', import.meta.url), 'utf8')
const parsed = parseQuestionBank(raw)
const corrected = parsed.map(applySurveyingQuestionOverride)
const byId = new Map(corrected.map((question) => [question.id, question]))

describe('042003A11 source transcriptions', () => {
  it('preserves every question ID and official answer key', () => {
    expect(corrected).toHaveLength(704)
    expect(corrected.map((question) => [question.id, question.answers]))
      .toEqual(parsed.map((question) => [question.id, question.answers]))
    expect(corrected.every((question) => question.options.length === 4)).toBe(true)
  })

  it('keeps formulas as text and marks only actual diagrams and tables as figures', () => {
    expect(new Set(SURVEYING_FIGURE_IDS).size).toBe(26)
    expect(SURVEYING_FIGURE_IDS.every((id) => byId.get(id)?.hasFigure)).toBe(true)
    expect(Object.keys(SURVEYING_QUESTION_OVERRIDES)
      .filter((id) => !SURVEYING_FIGURE_IDS.includes(id))
      .every((id) => byId.get(id)?.hasFigure === false)).toBe(true)
    expect(byId.get('04200-04-132')?.hasFigure).toBe(true)
    expect(byId.get('04200-04-147')?.hasFigure).toBe(true)
    expect(byId.get('04200-02-011')?.hasFigure).toBe(false)
    for (const id of ['04200-01-007', '04200-01-052', '04200-02-032', '04200-02-104', '04200-04-050', '04200-06-007']) {
      expect(byId.get(id)?.hasFigure).toBe(false)
      expect(byId.get(id)?.options.every((option: string) => option.length > 0)).toBe(true)
    }
    for (const id of ['04200-02-023', '04200-02-050']) {
      expect(byId.get(id)?.hasFigure).toBe(true)
      expect(byId.get(id)?.options).toEqual(['圖示選項 1', '圖示選項 2', '圖示選項 3', '圖示選項 4'])
    }
  })

  it('preserves image options and transcribes the prompt where the PDF lost subscripts', () => {
    expect(byId.get('04200-02-050')?.prompt).toContain('α_AB、α_BC')
    expect(byId.get('04200-01-052')?.prompt).toContain('σ̂')
    expect(byId.get('04200-04-050')?.options[3]).toBe('|(α₂－α₁)/2|')
    expect(byId.get('04200-06-007')?.options).toEqual(['一', '十', '△', '▲'])
  })

  it('restores the numerically distinct square-root alternatives', () => {
    expect(byId.get('04200-02-062')?.options).toEqual(['±√31 mm', '±√41 mm', '±√51 mm', '±√61 mm'])
    expect(byId.get('04200-02-076')?.options[0]).toBe('±√26 mm')
    expect(byId.get('04200-02-079')?.options[0]).toBe('±√268 mm')
    expect(byId.get('04200-04-153')?.options).toEqual(['10″√N', '20″√N', '30″√N', '40″√N'])
    expect(byId.get('04200-04-154')?.options[2]).toBe('20″√N＋30″')
    expect(byId.get('04200-02-011')?.options).toEqual(['b·cot(α/2)', 'b·tan(α/2)', '(b/2)·cot(α/2)', '(b/2)·tan(α/2)'])
  })

  it('restores the height-difference variables needed to solve the questions', () => {
    expect(byId.get('04200-03-149')?.prompt).toContain('ΔH_AB')
    expect(byId.get('04200-03-150')?.prompt).toContain('ΔH_AC')
    expect(byId.get('04200-03-152')?.prompt).toContain('ΔH_BA')
    expect(byId.get('04200-03-153')?.prompt).toContain('ΔH_CA')
    for (let number = 157; number <= 162; number += 1) {
      const prompt = byId.get(`04200-03-${number}`)?.prompt ?? ''
      expect(prompt).toContain('ΔH_AB＝2.345m')
      expect(prompt).toContain('ΔH_BC＝3.468m')
      expect(prompt).toContain('ΔH_CA＝-5.801m')
    }
    expect(byId.get('04200-04-099')?.prompt).toContain('AB 線方向角')
    expect(byId.get('04200-04-099')?.prompt).toContain('CA 線方向角')
  })

  it('keeps the officially deleted question out of the active candidate set', () => {
    const audit = auditCandidate({ subjectCode: '04200', questions: corrected, officialKeys: extractOfficialKeysFromText(raw) })
    expect(audit.deletionCandidates).toEqual(['04200-01-033'])
    const config = buildCandidateConfig({
      specifier: parseExamSpecifier('042003'),
      document: { title: '測量', pdfFilename: '042003A11.pdf', version: 'A11', officialUrl: 'https://owinform.wdasec.gov.tw/owInform/DLowFile/042003A11.pdf' },
      questionCount: corrected.length,
      sha256: 'test',
      inactiveIds: audit.deletionCandidates,
    })
    expect(config.inactiveIds).toEqual(['04200-01-033'])
  })
})
