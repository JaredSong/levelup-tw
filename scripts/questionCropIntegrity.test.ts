import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'

const PACKS = [
  // tightCrops added: this pack's one image-option question (15100-02-015)
  // now ships four separate option crops instead of one combined strip, and
  // those per-option crops are small like every other tight-cropped pack.
  { examId: 'forklift-operation-single', occupationCode: '15100', sourceQuestions: 600, inactive: 19, figures: 37, tightCrops: true },
  // tightCrops added: 12600-01-043/044/045 (mixedFigureOptions) plus the 15
  // pure image-option questions all ship small per-option crops now.
  { examId: 'interior-decoration-management-b', occupationCode: '12600', sourceQuestions: 718, inactive: 0, figures: 38, tightCrops: true },
  // tightCrops added: 20600-02-016's four options are now separate crops.
  { examId: 'beverage-preparation-c', occupationCode: '20600', sourceQuestions: 617, inactive: 0, figures: 5, tightCrops: true },
  { examId: 'computer-software-application-b', occupationCode: '11800', sourceQuestions: 776, inactive: 0, figures: 6, cropPrefix: '118002' },
  { examId: 'indoor-wiring-b', occupationCode: '00700', sourceQuestions: 862, inactive: 7, figures: 64, cropPrefix: '007002' },
  { examId: 'indoor-wiring-c', occupationCode: '00700', sourceQuestions: 618, inactive: 0, figures: 62, cropPrefix: '007003', tightCrops: true },
  { examId: 'industrial-electronics-c', occupationCode: '02800', sourceQuestions: 651, inactive: 0, figures: 128, cropPrefix: '028003' },
  // tightCrops added: 12000-01-003 (mixedFigureOptions) now ships a small
  // base figure plus four small option crops instead of one combined strip.
  { examId: 'computer-hardware-repair-c', occupationCode: '12000', sourceQuestions: 707, inactive: 0, figures: 17, cropPrefix: '120003', tightCrops: true },
  // tightCrops added: 15 image-option questions now ship four small option
  // crops apiece instead of one combined strip.
  { examId: 'water-pipe-fitting-c', occupationCode: '01600', sourceQuestions: 707, inactive: 0, figures: 34, cropPrefix: '016003', tightCrops: true },
  { examId: 'excavator-operation-single', occupationCode: '07002', sourceQuestions: 668, inactive: 0, figures: 12, cropPrefix: '070024', tightCrops: true },
  // 180 → 183: 11700-05-028/033/114 had four "圖示選項 N" placeholders and no
  // images at all. Their options are vector formulas now cropped from the
  // official PDF, so they count as figure questions.
  // inactive 0 → 2: 11700-06-102 (two real text options + two genuine
  // circuit-image options — a frontend-contract gap, not a data defect) and
  // 11700-05-057 (7 images from 3 prompt figures + 4 options, needs a
  // composite-subset capability that doesn't exist) can't ship correctly yet.
  // See INACTIVE_IDS in build-exam-packs.mjs.
  { examId: 'digital-electronics-b', occupationCode: '11700', sourceQuestions: 743, inactive: 2, figures: 183, cropPrefix: '117002', tightCrops: true },
  { examId: 'western-cooking-c', occupationCode: '14000', sourceQuestions: 519, inactive: 4, figures: 0 },
  { examId: 'retail-service-c', occupationCode: '18100', sourceQuestions: 622, inactive: 0, figures: 25, cropPrefix: '181003', tightCrops: true },
  // 73 → 74: 18201-05-048, same vector-formula-option repair as above.
  { examId: 'cnc-milling-b', occupationCode: '18201', sourceQuestions: 775, inactive: 2, figures: 74, cropPrefix: '182012', tightCrops: true },
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
          const usesTightCrops = expected.tightCrops
            || expected.examId === 'indoor-wiring-b'
            || expected.examId === 'industrial-electronics-c'
          const minimumBytes = expected.examId === 'industrial-electronics-c' ? 100 : usesTightCrops ? 250 : 1_500
          expect(bytes.byteLength, `${question.id} ${source}`).toBeGreaterThan(minimumBytes)
          expect(width, `${question.id} ${source}`).toBeGreaterThan(usesTightCrops ? 15 : 300)
          expect(height, `${question.id} ${source}`).toBeGreaterThan(usesTightCrops ? 15 : 30)
          expect(width, `${question.id} ${source}`).toBeLessThanOrEqual(usesTightCrops ? 1_800 : 1_000)
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
      // The renderer's contract (PracticeView.optionImageSources): one image
      // per option, optionally preceded by a stem figure at index 0. Derive the
      // expected count from the options rather than hardcoding it, so the test
      // asserts the rule instead of one pack's current shape.
      const optionSources = question.sourceImages?.length === question.options.length + 1
        ? question.sourceImages.slice(1)
        : question.sourceImages
      expect(optionSources, question.id).toHaveLength(question.options.length)
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

  it('locks every newly imported image to its audited question and SHA-256', () => {
    for (const [source, expectedQuestions, expectedAssets] of [
      ['070024A10', 12, 42],
      // 117002A13 and 182012A10 each gained the vector-formula-option crops
      // noted in PACKS above: 3 questions × 4 options, and 1 × 4 respectively.
      // 250 → 258: 11700-05-023 and 11700-05-039 each kept their existing
      // prompt figure and gained four vector-cropped options (+4 apiece).
      ['117002A13', 183, 258],
      ['181003A13', 25, 52],
      // 118 → 122: 18201-05-047 kept its existing prompt figure and gained
      // four vector-cropped options, same repair as 18201-05-048 above.
      ['182012A10', 74, 122],
      ['900012A10', 51, 125],
    ] as const) {
      const audit = JSON.parse(readFileSync(
        new URL(`../source/${source}-image-audit.json`, import.meta.url),
        'utf8',
      )) as {
        questions: Record<string, Array<{ file: string; reference: string; sha256: string }>>
      }
      const imageMap = JSON.parse(readFileSync(
        new URL(`../source/${source}-image-map.json`, import.meta.url),
        'utf8',
      )) as { questions: Record<string, string[]> }

      expect(Object.keys(audit.questions), source).toHaveLength(expectedQuestions)
      expect(Object.values(audit.questions).flat(), source).toHaveLength(expectedAssets)
      expect(Object.keys(audit.questions), source).toEqual(Object.keys(imageMap.questions))

      for (const [questionId, assets] of Object.entries(audit.questions)) {
        expect(assets.map((asset) => asset.file), questionId).toEqual(imageMap.questions[questionId])
        for (const asset of assets) {
          const bytes = readFileSync(new URL(`../public/question-images/${asset.file}`, import.meta.url))
          expect(createHash('sha256').update(bytes).digest('hex'), `${questionId} / ${asset.reference}`)
            .toBe(asset.sha256)
        }
      }
    }
  })

  it('keeps 90001 formula text and removes PDF glyph artifacts', () => {
    const questions = JSON.parse(readFileSync(
      new URL('../public/data/exams/cnc-milling-b/questions.json', import.meta.url),
      'utf8',
    )) as Question[]
    const byId = new Map(questions.map((question) => [question.id, question]))

    expect(byId.get('90001-01-004')?.sourceImages).toEqual([
      '/question-images/900012-90001-01-004.png',
    ])
    expect(byId.get('90001-08-002')).toMatchObject({
      prompt: '液壓油以流量 25 L/min 通過內徑 11 mm 的油壓管，則其流速約為',
      hasFigure: false,
    })
    expect(byId.get('90001-09-032')).toMatchObject({
      prompt: '平均值與全距（x̄－R）管制圖，每組樣本大小（n）最好是抽',
      hasFigure: false,
    })
    expect(byId.get('90001-09-033')).toMatchObject({
      prompt: '在製程管制中，將平均值（x̄）管制圖與下列何種管制圖配合使用較為有效？',
      hasFigure: false,
    })
    expect(byId.get('90001-09-036')?.options[0]).toBe('平均值（x̄）管制圖')
    expect(byId.get('90001-09-037')).toMatchObject({
      prompt: '平均值與全距（x̄－R）管制圖是一種',
      hasFigure: false,
    })
  })
})
