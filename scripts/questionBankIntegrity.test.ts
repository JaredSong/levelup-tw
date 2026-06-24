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

  it('builds official-composition mocks from the real bank across many seeds', () => {
    const bank = loadBank()
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
