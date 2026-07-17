import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'

const PACKS = [
  { examId: 'forklift-operation-single', occupationCode: '15100', sourceQuestions: 600, inactive: 19, figures: 37 },
  { examId: 'interior-decoration-management-b', occupationCode: '12600', sourceQuestions: 718, inactive: 0, figures: 38 },
  { examId: 'beverage-preparation-c', occupationCode: '20600', sourceQuestions: 617, inactive: 0, figures: 5 },
  { examId: 'computer-software-application-b', occupationCode: '11800', sourceQuestions: 776, inactive: 0, figures: 6, cropPrefix: '118002' },
  { examId: 'indoor-wiring-b', occupationCode: '00700', sourceQuestions: 862, inactive: 7, figures: 64, cropPrefix: '007002' },
  { examId: 'indoor-wiring-c', occupationCode: '00700', sourceQuestions: 618, inactive: 0, figures: 62, cropPrefix: '007003' },
  { examId: 'industrial-electronics-c', occupationCode: '02800', sourceQuestions: 651, inactive: 0, figures: 128, cropPrefix: '028003' },
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
        sourceImages?: string[]
      }>
      const occupation = questions.filter((question) => question.subjectCode === expected.occupationCode)
      const figures = occupation.filter((question) => question.hasFigure)

      expect(occupation).toHaveLength(expected.sourceQuestions)
      expect(occupation.filter((question) => question.active === false)).toHaveLength(expected.inactive)
      expect(figures).toHaveLength(expected.figures)

      for (const question of figures) {
        const sources = question.sourceImages?.length ? question.sourceImages : [question.sourceImage]
        expect(sources.every(Boolean), question.id).toBe(true)
        for (const source of sources) {
          const bytes = readFileSync(new URL(`../public${source}`, import.meta.url))
          const { width, height } = pngDimensions(bytes)
          const usesTightCrops = expected.examId === 'indoor-wiring-b' || expected.examId === 'industrial-electronics-c'
          const minimumBytes = expected.examId === 'industrial-electronics-c' ? 100 : usesTightCrops ? 250 : 1_500
          expect(bytes.byteLength, `${question.id} ${source}`).toBeGreaterThan(minimumBytes)
          expect(width, `${question.id} ${source}`).toBeGreaterThan(usesTightCrops ? 15 : 300)
          expect(height, `${question.id} ${source}`).toBeGreaterThan(usesTightCrops ? 15 : 30)
          expect(width, `${question.id} ${source}`).toBeLessThanOrEqual(expected.examId === 'industrial-electronics-c' ? 1_800 : 1_000)
          if (expected.examId === 'industrial-electronics-c') {
            expect(height, `${question.id} ${source}`).toBeLessThanOrEqual(1_000)
          }
        }
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
    expect(audit).toContain('`/question-images/007002-00700-01-001-1.png`')
    expect(audit).toContain('## indoor-wiring-c:00700-01-001')
    expect(audit).toContain('`/question-images/007003-00700-01-001.png`')
  })

  it('uses separate option images and includes every left-side figure for indoor wiring B', () => {
    const questions = JSON.parse(readFileSync(
      new URL('../public/data/exams/indoor-wiring-b/questions.json', import.meta.url),
      'utf8',
    )) as Array<{
      id: string
      subjectCode: string
      prompt: string
      options: string[]
      hasFigure?: boolean
      sourceImage?: string
      sourceImages?: string[]
    }>
    const occupation = questions.filter((question) => question.subjectCode === '00700')
    const imageOptions = occupation.filter((question) => question.options.some((option) => option.includes('圖示選項')))
    const leftFigures = occupation.filter((question) => question.prompt.includes('左圖'))

    expect(imageOptions.length).toBeGreaterThan(0)
    for (const question of imageOptions) {
      const optionSources = question.sourceImages?.length === 5
        ? question.sourceImages.slice(1)
        : question.sourceImages
      expect(optionSources, question.id).toHaveLength(4)
      optionSources?.forEach((source, index) => {
        expect(source, question.id).toBe(`/question-images/007002-${question.id}-${index + 1}.png`)
        const bytes = readFileSync(new URL(`../public${source}`, import.meta.url))
        const { width } = pngDimensions(bytes)
        expect(width, `${question.id} option ${index + 1}`).toBeLessThan(400)
      })
    }

    expect(leftFigures).toHaveLength(11)
    expect(leftFigures.every((question) => question.hasFigure)).toBe(true)

    const byId = new Map(occupation.map((question) => [question.id, question]))
    expect(byId.get('00700-06-018')?.hasFigure).not.toBe(true)
    expect(byId.get('00700-11-086')).toMatchObject({
      hasFigure: false,
      prompt: '感應電動機之運轉公式 n = (2f / p) rps 中',
    })
    expect(byId.get('00700-11-063')?.sourceImage).toBe('/question-images/007002-00700-11-063.png')
    expect(byId.get('00700-12-043')?.sourceImage).toBe('/question-images/007002-00700-12-043.png')
    expect(byId.get('00700-09-007')?.sourceImages).toEqual([
      '/question-images/007002-00700-09-007.png',
      '/question-images/007002-00700-09-007-1.png',
      '/question-images/007002-00700-09-007-2.png',
      '/question-images/007002-00700-09-007-3.png',
      '/question-images/007002-00700-09-007-4.png',
    ])

    for (const [id, expected] of [
      ['00700-09-007', { minWidth: 300, maxWidth: 400, minHeight: 200, maxHeight: 280 }],
      ['00700-11-063', { minWidth: 800, maxWidth: 880, minHeight: 160, maxHeight: 190 }],
      ['00700-12-043', { minWidth: 440, maxWidth: 500, minHeight: 280, maxHeight: 330 }],
    ] as const) {
      const source = byId.get(id)?.sourceImage
      expect(source, id).toBeTruthy()
      const bytes = readFileSync(new URL(`../public${source}`, import.meta.url))
      const { width, height } = pngDimensions(bytes)
      expect(width, id).toBeGreaterThanOrEqual(expected.minWidth)
      expect(width, id).toBeLessThanOrEqual(expected.maxWidth)
      expect(height, id).toBeGreaterThanOrEqual(expected.minHeight)
      expect(height, id).toBeLessThanOrEqual(expected.maxHeight)
    }
  })

  it('uses exact embedded figures and separate graphical options for industrial electronics C', () => {
    const questions = JSON.parse(readFileSync(
      new URL('../public/data/exams/industrial-electronics-c/questions.json', import.meta.url),
      'utf8',
    )) as Array<{
      id: string
      subjectCode: string
      prompt: string
      options: string[]
      hasFigure?: boolean
      sourceImage?: string
      sourceImages?: string[]
    }>
    const occupation = questions.filter((question) => question.subjectCode === '02800')
    const figures = occupation.filter((question) => question.hasFigure)
    const imageCount = figures.reduce((count, question) => (
      count + (question.sourceImages?.length ?? (question.sourceImage ? 1 : 0))
    ), 0)
    const byId = new Map(occupation.map((question) => [question.id, question]))

    expect(figures).toHaveLength(128)
    expect(imageCount).toBe(187)
    expect(byId.get('02800-05-006')?.sourceImages).toEqual([
      '/question-images/028003-02800-05-006-1.png',
      '/question-images/028003-02800-05-006-2.png',
      '/question-images/028003-02800-05-006-3.png',
      '/question-images/028003-02800-05-006-4.png',
    ])
    expect(byId.get('02800-06-007')?.sourceImages).toEqual([
      '/question-images/028003-02800-06-007-1.png',
      '/question-images/028003-02800-06-007-2.png',
      '/question-images/028003-02800-06-007-3.png',
      '/question-images/028003-02800-06-007-4.png',
    ])
    expect(byId.get('02800-08-021')).toMatchObject({
      prompt: '將極座標 6√2∠135° 換為直角座標得',
    })
    expect(byId.get('02800-08-022')?.options).toEqual(['1/2', 'π/2', '√2/2', '2/π 倍'])
    expect(byId.get('02800-08-089')?.options).toEqual(['5－j5√3', '5＋j5√3', '5√3＋j5', '5√3－j5'])
    expect(byId.get('02800-09-052')).toMatchObject({
      prompt: '在電晶體參數中 h₁₁ = (ΔV₁ / ΔI₁)｜V₂=0，其 h₁₁ 代表意義為',
    })
    expect(byId.get('02800-09-072')?.options).toEqual(['2 倍', '√2 倍', '1/2 倍', '1/√2 倍'])
    expect(byId.get('02800-10-025')).toMatchObject({
      prompt: '在 J.K 正反器中，J＝0、K＝1 時，當 CLOCK（時脈）信號激發後，其輸出 Q 與 Q̅ 為',
      options: ['Q＝1，Q̅＝1', 'Q＝0，Q̅＝1', 'Q＝0，Q̅＝0', 'Q＝1，Q̅＝0'],
    })
    expect(byId.get('02800-10-030')?.options).toEqual(['B＋C', 'A·C̅＋B', 'BC＋C̅', 'B＋C̅'])
    expect(byId.get('02800-10-004')?.options).toEqual([
      'Y(X + Z)', '¬(¬(XY) + ¬(YZ))', 'XYZ', '¬(XYZ)',
    ])
    expect(byId.get('02800-10-061')).toMatchObject({
      prompt: '有一 J-K 正反器，在不考慮控制輸入下，欲使其輸出為反態現象（Qₙ₊₁ = Q̅ₙ），則 J、K 之輸入為何？',
    })

    for (const [id, expected] of [
      ['02800-02-056', { width: 125, height: 54 }],
      ['02800-02-057', { width: 158, height: 54 }],
      ['02800-04-025', { width: 406, height: 127 }],
      ['02800-05-002', { width: 540, height: 299 }],
      ['02800-06-017', { width: 251, height: 211 }],
      ['02800-08-015', { width: 603, height: 284 }],
      ['02800-09-006', { width: 945, height: 381 }],
      ['02800-10-003', { width: 589, height: 531 }],
      ['02800-10-004', { width: 783, height: 352 }],
      ['02800-10-005', { width: 409, height: 138 }],
      ['02800-10-006', { width: 629, height: 488 }],
      ['02800-10-012', { width: 216, height: 325 }],
      ['02800-10-021', { width: 558, height: 141 }],
      ['02800-10-023', { width: 691, height: 311 }],
      ['02800-10-029', { width: 387, height: 138 }],
      ['02800-10-060', { width: 360, height: 185 }],
    ] as const) {
      const source = byId.get(id)?.sourceImage
      expect(source, id).toBe(`/question-images/028003-${id}.png`)
      const bytes = readFileSync(new URL(`../public${source}`, import.meta.url))
      expect(pngDimensions(bytes), id).toEqual(expected)
    }
  })

  it('locks every industrial-electronics image to the audited question and role', () => {
    const audit = JSON.parse(readFileSync(
      new URL('../source/028003A11-image-audit.json', import.meta.url),
      'utf8',
    )) as {
      questions: Record<string, Array<{ file: string; reference: string; sha256: string }>>
    }
    const imageMap = JSON.parse(readFileSync(
      new URL('../source/028003A11-image-map.json', import.meta.url),
      'utf8',
    )) as { questions: Record<string, string[]> }

    expect(Object.keys(audit.questions)).toHaveLength(128)
    expect(Object.values(audit.questions).flat()).toHaveLength(187)
    expect(Object.keys(audit.questions)).toEqual(Object.keys(imageMap.questions))

    for (const [questionId, assets] of Object.entries(audit.questions)) {
      expect(assets.map((asset) => asset.file), questionId).toEqual(imageMap.questions[questionId])
      for (const asset of assets) {
        const bytes = readFileSync(new URL(`../public/question-images/${asset.file}`, import.meta.url))
        expect(createHash('sha256').update(bytes).digest('hex'), `${questionId} / ${asset.reference}`)
          .toBe(asset.sha256)
      }
    }
  })
})
