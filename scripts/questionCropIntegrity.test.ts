import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'

const PACKS = [
  { examId: 'forklift-operation-single', occupationCode: '15100', sourceQuestions: 600, inactive: 19, figures: 37 },
  { examId: 'interior-decoration-management-b', occupationCode: '12600', sourceQuestions: 718, inactive: 0, figures: 38 },
  { examId: 'beverage-preparation-c', occupationCode: '20600', sourceQuestions: 617, inactive: 0, figures: 5 },
  { examId: 'computer-software-application-b', occupationCode: '11800', sourceQuestions: 776, inactive: 0, figures: 6, cropPrefix: '118002' },
  { examId: 'indoor-wiring-b', occupationCode: '00700', sourceQuestions: 862, inactive: 7, figures: 53, cropPrefix: '007002' },
  { examId: 'indoor-wiring-c', occupationCode: '00700', sourceQuestions: 618, inactive: 0, figures: 62, cropPrefix: '007003' },
  { examId: 'industrial-electronics-c', occupationCode: '02800', sourceQuestions: 651, inactive: 0, figures: 136, cropPrefix: '028003' },
  { examId: 'computer-hardware-repair-c', occupationCode: '12000', sourceQuestions: 707, inactive: 0, figures: 17, cropPrefix: '120003' },
  { examId: 'water-pipe-fitting-c', occupationCode: '01600', sourceQuestions: 707, inactive: 0, figures: 34, cropPrefix: '016003' },
]

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('new high-demand exam packs', () => {
  for (const expected of PACKS) {
    it(`${expected.examId} keeps its official records and usable question crops`, () => {
      const questions = JSON.parse(readFileSync(
        new URL(`../public/data/exams/${expected.examId}/questions.json`, import.meta.url),
        'utf8',
      )) as Array<{
        id: string
        subjectCode: string
        active?: boolean
        hasFigure?: boolean
        sourceImage?: string
      }>
      const occupation = questions.filter((question) => question.subjectCode === expected.occupationCode)
      const figures = occupation.filter((question) => question.hasFigure)

      expect(occupation).toHaveLength(expected.sourceQuestions)
      expect(occupation.filter((question) => question.active === false)).toHaveLength(expected.inactive)
      expect(figures).toHaveLength(expected.figures)

      for (const question of figures) {
        const filename = `${'cropPrefix' in expected ? `${expected.cropPrefix}-` : ''}${question.id}.png`
        expect(question.sourceImage).toBe(`/question-images/${filename}`)
        const bytes = readFileSync(new URL(`../public/question-images/${filename}`, import.meta.url))
        const { width, height } = pngDimensions(bytes)
        expect(bytes.byteLength, question.id).toBeGreaterThan(1_500)
        expect(width, question.id).toBeGreaterThan(300)
        expect(height, question.id).toBeGreaterThan(30)
        expect(width, question.id).toBeLessThanOrEqual(1_000)
      }
    })
  }

  it('builds each official mock mix from active questions only', () => {
    for (const expected of PACKS) {
      const questions = JSON.parse(readFileSync(
        new URL(`../public/data/exams/${expected.examId}/questions.json`, import.meta.url),
        'utf8',
      )) as Question[]
      const manifest = JSON.parse(readFileSync(
        new URL(`../public/data/exams/${expected.examId}/manifest.json`, import.meta.url),
        'utf8',
      )) as { mockRules: Parameters<typeof buildMockQueue>[1] }
      const active = questions.filter((question) => question.active !== false)

      for (let seed = 1; seed <= 10; seed += 1) {
        const mock = buildMockQueue(active, manifest.mockRules, () => seed / 11)
        expect(mock).toHaveLength(80)
        expect(new Set(mock.map((question) => question.id)).size).toBe(80)
        expect(mock.every((question) => question.active !== false)).toBe(true)

        for (const quota of manifest.mockRules.subjectQuota) {
          expect(mock.filter((question) => question.subjectCode === quota.subjectCode)).toHaveLength(quota.count)
        }
        expect(mock.filter((question) => question.kind === 'single')).toHaveLength(manifest.mockRules.singleCount)
        expect(mock.filter((question) => question.kind === 'multiple')).toHaveLength(manifest.mockRules.multipleCount)
      }
    }
  })

  it('keeps same-code class B and C figures separate in the image audit', () => {
    const audit = readFileSync(new URL('../docs/image-question-map.md', import.meta.url), 'utf8')
    expect(audit).toContain('## indoor-wiring-b:00700-01-001')
    expect(audit).toContain('`/question-images/007002-00700-01-001.png`')
    expect(audit).toContain('## indoor-wiring-c:00700-01-001')
    expect(audit).toContain('`/question-images/007003-00700-01-001.png`')
  })
})
