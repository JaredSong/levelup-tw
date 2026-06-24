import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'
import { parseQuestionBank } from './questionParser.mjs'

function loadBank(): Question[] {
  return JSON.parse(readFileSync(new URL('../public/data/questions.json', import.meta.url), 'utf8')) as Question[]
}

describe('published question bank', () => {
  it('keeps every generated 90011 answer key aligned with official A10', () => {
    const official = parseQuestionBank(
      readFileSync(new URL('../source/900110A10-raw.txt', import.meta.url), 'utf8'),
    )
    const generated = JSON.parse(
      readFileSync(new URL('../public/data/questions.json', import.meta.url), 'utf8'),
    ) as Question[]
    const informationCommon = generated.filter((question) => question.subjectCode === '90011')
    const generatedById = new Map(informationCommon.map((question) => [question.id, question]))

    expect(official).toHaveLength(119)
    expect(informationCommon).toHaveLength(119)
    expect(
      Object.fromEntries(
        ['90011-01', '90011-02', '90011-03', '90011-04', '90011-05'].map((section) => [
          section,
          informationCommon.filter((question) => question.section === section).length,
        ]),
      ),
    ).toEqual({
      '90011-01': 20,
      '90011-02': 29,
      '90011-03': 10,
      '90011-04': 20,
      '90011-05': 40,
    })

    for (const question of official) {
      expect(generatedById.get(question.id)?.answers, question.id).toEqual(question.answers)
    }
  })

  it('contains 1,365 unique, structurally valid questions', () => {
    const generated = JSON.parse(
      readFileSync(new URL('../public/data/questions.json', import.meta.url), 'utf8'),
    ) as Question[]

    expect(generated).toHaveLength(1365)
    expect(new Set(generated.map((question) => question.id)).size).toBe(1365)
    expect(generated.every((question) => question.options.length === 4)).toBe(true)
    expect(generated.every((question) => question.answers.length > 0 && question.answers.every((answer) => answer >= 1 && answer <= 4))).toBe(true)
  })

  it('flags exactly the five officially deleted 90008 questions inactive', () => {
    const generated = loadBank()
    const inactive = generated.filter((question) => question.active === false).map((question) => question.id).sort()
    expect(inactive).toEqual(['90008-03-030', '90008-03-047', '90008-03-058', '90008-03-072', '90008-03-092'])
    expect(generated.filter((question) => question.active !== false)).toHaveLength(1360)
    expect(generated.filter((question) => question.subjectCode === '90008' && question.active !== false)).toHaveLength(95)
  })

  it('builds official-composition mocks from the real bank across many seeds', () => {
    const bank = loadBank().filter((question) => question.active !== false)
    for (let i = 0; i < 50; i += 1) {
      const seed = (i + 1) / 51
      const mock = buildMockQueue(bank, () => seed)
      expect(mock).toHaveLength(80)
      expect(mock.filter((q) => q.kind === 'single')).toHaveLength(60)
      expect(mock.filter((q) => q.kind === 'multiple')).toHaveLength(20)
      expect(mock.filter((q) => q.subjectCode === '17300')).toHaveLength(55)
      expect(mock.filter((q) => q.subjectCode === '90011')).toHaveLength(9)
      for (const code of ['90006', '90007', '90008', '90009']) {
        expect(mock.filter((q) => q.subjectCode === code)).toHaveLength(4)
      }
      expect(new Set(mock.map((q) => q.id)).size).toBe(80)
    }
  })
})

describe('bilingual glossary', () => {
  it('has complete entries and the required exam-wording terms', () => {
    const glossary = JSON.parse(
      readFileSync(new URL('../public/data/glossary.json', import.meta.url), 'utf8'),
    ) as { term: string; pinyin: string; en: string; cue: string; kind: string }[]

    expect(glossary.length).toBeGreaterThan(40)
    for (const entry of glossary) {
      expect(entry.term, entry.term).toBeTruthy()
      expect(entry.pinyin, entry.term).toBeTruthy()
      expect(entry.en, entry.term).toBeTruthy()
      expect(entry.cue, entry.term).toBeTruthy()
    }
    const terms = new Set(glossary.map((entry) => entry.term))
    for (const required of ['何者為非', '不包括', '複選題', '下列何者錯誤']) {
      expect(terms.has(required), required).toBe(true)
    }
  })
})
