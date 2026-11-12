import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'
import { parseQuestionBank } from './questionParser.mjs'
import { SURVEYING_FIGURE_IDS } from './surveyingQuestionOverrides.mjs'

function loadBank(): Question[] {
  return JSON.parse(readFileSync(new URL('../source/questions.json', import.meta.url), 'utf8')) as Question[]
}

function loadExamBank(examId: string): Question[] {
  return JSON.parse(readFileSync(new URL(`../public/data/exams/${examId}/questions.json`, import.meta.url), 'utf8')) as Question[]
}

// Every pack that actually ships, discovered from disk rather than listed by
// hand — a new pack is covered the moment it lands, without anyone remembering
// to add it here.
function listShippedPacks(): string[] {
  const examsDir = new URL('../public/data/exams/', import.meta.url)
  return readdirSync(examsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((examId) => existsSync(new URL(`${examId}/questions.json`, examsDir)))
    .sort()
}

function imageExists(image: string): boolean {
  return existsSync(new URL(`../public${decodeURIComponent(image)}`, import.meta.url))
}

function usesImageOptionPlaceholders(question: Question): boolean {
  return question.options.some((option) => option.includes('圖示選項'))
}

describe('published question bank', () => {
  it('publishes the current bank as the web-design-b exam pack', () => {
    const generated = loadBank() as Array<Question & { examId?: string }>
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/web-design-b/manifest.json', import.meta.url), 'utf8'),
    ) as {
      examId: string
      titleZh: string
      level: string
      questionCount: number
      activeQuestionCount: number
      sections: Array<{ id: string; questionCount: number }>
      mockRules: { totalQuestions: number; singleCount: number; multipleCount: number }
    }

    expect(manifest).toMatchObject({
      examId: 'web-design-b',
      titleZh: '網頁設計乙級',
      level: '乙級',
      questionCount: 1365,
      activeQuestionCount: 1360,
      mockRules: { totalQuestions: 80, singleCount: 60, multipleCount: 20 },
    })
    expect(Object.fromEntries(manifest.sections.map((section) => [section.id, section.questionCount]))).toEqual({
      '17300-01': 242,
      '17300-02': 405,
      '17300-03': 124,
      '17300-04': 75,
      '90006-01': 100,
      '90007-01': 100,
      '90008-03': 100,
      '90009-04': 100,
      '90011-01': 20,
      '90011-02': 29,
      '90011-03': 10,
      '90011-04': 20,
      '90011-05': 40,
    })
    expect(generated.every((question) => question.examId === 'web-design-b')).toBe(true)
  })

  it('keeps every generated 90011 answer key aligned with official A10', () => {
    const official = parseQuestionBank(
      readFileSync(new URL('../source/900110A10-raw.txt', import.meta.url), 'utf8'),
    )
    const generated = JSON.parse(
      readFileSync(new URL('../source/questions.json', import.meta.url), 'utf8'),
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
      readFileSync(new URL('../source/questions.json', import.meta.url), 'utf8'),
    ) as Question[]

    expect(generated).toHaveLength(1365)
    expect(new Set(generated.map((question) => question.id)).size).toBe(1365)
    expect(generated.every((question) => question.options.length === 4)).toBe(true)
    expect(generated.every((question) => question.answers.length > 0 && question.answers.every((answer) => answer >= 1 && answer <= 4))).toBe(true)
  })

  it('repairs official PDF text-extraction gaps for code-heavy 17300 questions', () => {
    const generated = loadBank()
    const byId = new Map(generated.map((question) => [question.id, question]))

    expect(byId.get('17300-02-150')).toMatchObject({
      answers: [1],
      options: [
        '以<%@符號開頭，以 %>結尾',
        '以<body符號開頭，以 /body>結尾',
        '以<?php符號開頭，以 ?>結尾',
        '以<html符號開頭，以 /html>結尾',
      ],
    })
    expect(byId.get('17300-02-156')).toMatchObject({
      prompt: 'PHP 程式「$x="Hello"; $y="World"; echo $x+$y;」其輸出為何？',
      answers: [4],
      options: ['Hello+World', 'Hello World', 'HelloWorld', '0'],
    })
    expect(byId.get('17300-02-236')?.prompt).toBe('JavaScript 程式「<Script>document.write(9 >> 2);</Script>」執行結果為何？')
    expect(byId.get('17300-02-237')?.prompt).toBe('HTML 語法「<body link="#0000FF" vlink="#FF0000" alink="#FFFF00">」，其功能表示尚未點選超連結過的物件顏色為何？')
    expect(byId.get('17300-02-238')?.prompt).toBe('HTML 語法標籤 <frameset> 其作用為何？')
    expect(byId.get('17300-02-253')?.prompt).toBe('關於 PHP 程式『<?php phpinfo(); ?>』的意義為何？')
    expect(byId.get('17300-02-273')?.prompt).toBe('在 XHTML 中，<form> 標籤的屬性何者用來指定接收表單資料之伺服器端的程式？')
  })

  it('does not leave active code/tag questions with blank prompts unless a source image is available', () => {
    const generated = loadBank().filter((question) => question.active !== false)
    const blankPromptQuestions = generated.filter((question) => {
      if (question.sourceImage) return false
      const prompt = question.prompt
      return /[「『]\s*[」』]/.test(prompt)
        || /HTML 語法標籤\s+其作用/.test(prompt)
        || /XHTML 中，\s*標籤/.test(prompt)
        || /HTML 的\s+標籤/.test(prompt)
    })

    expect(blankPromptQuestions.map((question) => question.id)).toEqual([])
  })

  it('keeps active image questions linked to checked image assets', () => {
    const generated = loadBank().filter((question) => question.active !== false && question.hasFigure)

    expect(generated).toHaveLength(8)
    for (const question of generated) {
      expect(question.sourceImage, question.id).toBeTruthy()
      expect(question.sourcePageImage, question.id).toBeTruthy()
      const images = question.sourceImages?.length ? question.sourceImages : [question.sourceImage]
      for (const image of images) {
        expect(existsSync(new URL(`../public${decodeURIComponent(image ?? '')}`, import.meta.url)), `${question.id}: ${image}`).toBe(true)
      }
      expect(existsSync(new URL(`../public${question.sourcePageImage}`, import.meta.url)), `${question.id}: ${question.sourcePageImage}`).toBe(true)
    }
  })

  // An image-option question renders one <img> per option, matched by count. If
  // the count drifts, every option silently degrades to its alt text and the
  // page scan takes over as the figure — which for these questions shows all
  // four marks together, i.e. leaks the answer. Assert the pairing here so a
  // missing or extra crop fails the build instead of the exam.
  // Legacy scope: the web-design-b source bank only. The all-pack version of
  // this rule lives in the "shipped question banks" suite below — keep both,
  // this one still pins the source bank the importer writes.
  it('gives every image-option question in the source bank exactly one image per option', () => {
    const imageOptionQuestions = loadBank().filter((question) =>
      question.active !== false &&
      question.options.some((option) => option.includes('圖示選項')) &&
      !question.optionCodeBlocks?.some(Boolean))

    expect(imageOptionQuestions.length).toBeGreaterThan(0)
    for (const question of imageOptionQuestions) {
      const images = question.sourceImages ?? []
      // Either one image per option, or a stem figure followed by one per option.
      const optionImages = images.length === question.options.length + 1 ? images.slice(1) : images
      expect(optionImages, `${question.id}: ${images.length} images for ${question.options.length} options`)
        .toHaveLength(question.options.length)
      for (const image of optionImages) {
        expect(existsSync(new URL(`../public${decodeURIComponent(image)}`, import.meta.url)), `${question.id}: ${image}`).toBe(true)
      }
    }
  })

  it('keeps common-subject image labels aligned with their source figures', () => {
    const byId = new Map(loadBank().map((question) => [question.id, question]))

    expect(byId.get('90009-04-002')).toMatchObject({
      answers: [2],
      sourceImages: [
        '/question-images/90009-page-2%202-1.png',
        '/question-images/90009-page-2%202-2.png',
        '/question-images/90009-page-2%202-3.png',
        '/question-images/90009-page-2%202-4.png',
      ],
      sourcePageImage: '/question-pages/90009-page-2.jpg',
      options: ['圖示選項 1', '圖示選項 2', '圖示選項 3', '圖示選項 4'],
    })
    expect(byId.get('90009-04-069')).toMatchObject({
      answers: [4],
      sourceImage: '/question-images/90009-page-7.png',
      sourcePageImage: '/question-pages/90009-page-7.jpg',
      options: ['省水標章', '環保標章', '奈米標章', '能源效率標示'],
    })
    expect(byId.get('90009-04-086')).toMatchObject({
      answers: [3],
      sourceImage: '/question-images/90009-04-086.png',
      sourcePageImage: '/question-pages/90009-page-8.jpg',
      options: ['奈米標章', '環保標章', '省水標章', '節能標章'],
    })
  })

  it('keeps 90011 code questions transcribed as selectable code instead of screenshots', () => {
    const byId = new Map(loadBank().map((question) => [question.id, question]))

    expect(byId.get('90011-04-004')).toMatchObject({
      answers: [2],
      hasFigure: true,
      sourceImage: '/question-images/90011-page-6%204.png',
      sourceImages: ['/question-images/90011-page-6%204.png'],
      sourcePageImage: '/question-pages/90011-page-6.jpg',
      optionCodeBlocks: [
        expect.stringContaining('X>3? cout<<B'),
        expect.stringContaining('if (X>3)'),
        expect.stringContaining('switch(X)'),
        expect.stringContaining('while (X>3)'),
      ],
    })
    for (const id of [
      '90011-04-005',
      '90011-04-009',
      '90011-04-013',
      '90011-04-014',
      '90011-04-015',
      '90011-04-016',
      '90011-04-017',
      '90011-04-018',
      '90011-04-019',
      '90011-04-020',
    ]) {
      const question = byId.get(id)
      expect(question?.hasFigure, id).toBe(false)
      expect(question?.codeBlock, id).toBeTruthy()
      expect(question?.sourceImage, id).toBeUndefined()
      expect(question?.sourceImages, id).toBeUndefined()
      expect(question?.sourcePageImage, id).toBeUndefined()
    }
    expect(byId.get('90011-04-020')?.codeBlock).toContain('cout<<a<<"x+"<<-b<<"y+"<<c<<"=0";')
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

  it('publishes hairdressing class C exam packs without occupation-bank figures', () => {
    const cases = [
      { examId: 'man-haircut-c', titleZh: '男子理髮丙級', occupationCode: '06000', total: 1139, active: 1134, sections: 16 },
      { examId: 'women-hairdressing-c', titleZh: '女子美髮丙級', occupationCode: '06700', total: 1308, active: 1303, sections: 15 },
    ]

    for (const item of cases) {
      const generated = loadExamBank(item.examId)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as {
        examId: string
        titleZh: string
        questionCount: number
        activeQuestionCount: number
        sections: unknown[]
        mockRules: { totalQuestions: number; singleCount: number; multipleCount: number }
      }

      expect(manifest).toMatchObject({
        examId: item.examId,
        titleZh: item.titleZh,
        questionCount: item.total,
        activeQuestionCount: item.active,
        mockRules: { totalQuestions: 80, singleCount: 80, multipleCount: 0 },
      })
      expect(manifest.sections).toHaveLength(item.sections)
      expect(generated).toHaveLength(item.total)
      expect(generated.filter((question) => question.active !== false)).toHaveLength(item.active)
      expect(generated.every((question) => question.examId === item.examId)).toBe(true)
      expect(generated.filter((question) => question.subjectCode === item.occupationCode && question.hasFigure)).toEqual([])
      expect(generated.filter((question) => question.subjectCode === '90012' && question.hasFigure)).toEqual([])
      expect(generated.filter((question) => question.active !== false && question.hasFigure)).toHaveLength(4)
      expect(generated.filter((question) => question.subjectCode === '90008' && question.active !== false)).toHaveLength(95)
    }
  })

  it('builds hairdressing mocks from active-only question packs', () => {
    const cases = [
      { examId: 'man-haircut-c', occupationCode: '06000' },
      { examId: 'women-hairdressing-c', occupationCode: '06700' },
    ]

    for (const item of cases) {
      const bank = loadExamBank(item.examId).filter((question) => question.active !== false)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as { mockRules: Parameters<typeof buildMockQueue>[1] }

      for (let i = 0; i < 10; i += 1) {
        const mock = buildMockQueue(bank, manifest.mockRules, () => (i + 1) / 11)
        expect(mock).toHaveLength(80)
        expect(mock.filter((question) => question.kind === 'single')).toHaveLength(80)
        expect(mock.filter((question) => question.kind === 'multiple')).toHaveLength(0)
        // 115 簡章 重點提示 21(3): 90012 is 20% (16 of 80), occupation 48.
        expect(mock.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(48)
        expect(mock.filter((question) => question.subjectCode === '90012')).toHaveLength(16)
        for (const code of ['90006', '90007', '90008', '90009']) {
          expect(mock.filter((question) => question.subjectCode === code)).toHaveLength(4)
        }
        expect(new Set(mock.map((question) => question.id)).size).toBe(80)
      }
    }
  })

  it('publishes employment service class B from the official 195002A17 bank', () => {
    const generated = loadExamBank('employment-service-b')
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/employment-service-b/manifest.json', import.meta.url), 'utf8'),
    ) as {
      examId: string
      titleZh: string
      level: string
      questionCount: number
      activeQuestionCount: number
      sections: Array<{ id: string; subjectCode: string; titleZh: string; questionCount: number }>
      mockRules: { totalQuestions: number; singleCount: number; multipleCount: number }
    }

    expect(manifest).toMatchObject({
      examId: 'employment-service-b',
      titleZh: '就業服務乙級',
      level: '乙級',
      questionCount: 1650,
      activeQuestionCount: 1645,
      mockRules: { totalQuestions: 80, singleCount: 60, multipleCount: 20 },
    })
    expect(Object.fromEntries(manifest.sections.map((section) => [section.id, section.questionCount]))).toEqual({
      '19500-01': 848,
      '19500-02': 209,
      '19500-03': 193,
      '90006-01': 100,
      '90007-01': 100,
      '90008-03': 100,
      '90009-04': 100,
    })
    expect(manifest.sections.find((section) => section.id === '19500-01')?.titleZh)
      .toBe('職業介紹、人力仲介及外國人引進、聘僱、管理事項')
    expect(generated).toHaveLength(1650)
    expect(generated.filter((question) => question.active !== false)).toHaveLength(1645)
    expect(generated.filter((question) => question.subjectCode === '19500')).toHaveLength(1250)
    expect(generated.filter((question) => question.subjectCode === '19500' && question.hasFigure)).toEqual([])
    expect(generated.filter((question) => question.active !== false && question.hasFigure)).toHaveLength(4)
    expect(generated.filter((question) => question.subjectCode === '90008' && question.active !== false)).toHaveLength(95)
    expect(generated.every((question) => question.examId === 'employment-service-b')).toBe(true)
  })

  it('publishes the next high-demand class C exam packs', () => {
    const cases = [
      { examId: 'car-repair-c', occupationCode: '02000', total: 1165, occupation: 765, sections: 11 },
      { examId: 'beauty-c', occupationCode: '10000', total: 1061, occupation: 361, sections: 10 },
      { examId: 'accounting-c', occupationCode: '14900', total: 1162, occupation: 762, sections: 9 },
    ]

    for (const item of cases) {
      const questions = loadExamBank(item.examId)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as { questionCount: number; sections: unknown[] }

      expect(manifest.questionCount).toBe(item.total)
      expect(manifest.sections).toHaveLength(item.sections)
      expect(questions.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(item.occupation)
      expect(questions.every((question) => question.examId === item.examId)).toBe(true)
    }
  })

  it('publishes the staged electronics, hardware, and pipe-fitting packs', () => {
    const cases = [
      {
        examId: 'industrial-electronics-c',
        occupationCode: '02800',
        version: 'A11',
        occupation: 651,
        total: 1051,
        active: 1046,
        sections: 13,
        occupationQuota: 64,
      },
      {
        examId: 'computer-hardware-repair-c',
        occupationCode: '12000',
        version: 'A12',
        occupation: 707,
        total: 1226,
        active: 1221,
        sections: 15,
        occupationQuota: 52,
        extraCommonCode: '90011',
        extraCommonQuota: 12,
      },
      {
        examId: 'water-pipe-fitting-c',
        occupationCode: '01600',
        version: 'A12',
        occupation: 707,
        total: 1107,
        active: 1102,
        sections: 13,
        occupationQuota: 64,
      },
      {
        examId: 'network-installation-c',
        occupationCode: '17200',
        version: 'A14',
        occupation: 486,
        total: 1005,
        active: 1000,
        sections: 13,
        occupationQuota: 52,
        extraCommonCode: '90011',
        extraCommonQuota: 12,
      },
      {
        examId: 'engineering-surveying-b',
        occupationCode: '04202',
        version: 'A11',
        occupation: 769,
        total: 1169,
        active: 1153,
        sections: 10,
        occupationQuota: 64,
      },
      {
        examId: 'machining-c',
        occupationCode: '18500',
        version: 'A10',
        occupation: 500,
        total: 900,
        active: 893,
        sections: 12,
        occupationQuota: 64,
      },
      {
        examId: 'surveying-c',
        occupationCode: '04200',
        version: 'A11',
        occupation: 704,
        total: 1104,
        active: 1098,
        sections: 12,
        occupationQuota: 64,
      },
      {
        examId: 'visual-communication-design-c',
        occupationCode: '20100',
        version: 'A12',
        occupation: 608,
        total: 1008,
        active: 997,
        sections: 10,
        occupationQuota: 64,
      },
      {
        examId: 'international-trade-c',
        occupationCode: '20000',
        version: 'A13',
        occupation: 770,
        total: 1170,
        active: 1165,
        sections: 15,
        occupationQuota: 64,
      },
    ]

    for (const item of cases) {
      const questions = loadExamBank(item.examId)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as {
        version: string
        questionCount: number
        activeQuestionCount: number
        sections: unknown[]
        mockRules: Parameters<typeof buildMockQueue>[1]
      }

      expect(manifest.version).toBe(item.version)
      expect(manifest.questionCount).toBe(item.total)
      expect(manifest.activeQuestionCount).toBe(item.active)
      expect(manifest.sections).toHaveLength(item.sections)
      expect(questions.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(item.occupation)
      expect(questions.every((question) => question.examId === item.examId)).toBe(true)

      const mock = buildMockQueue(questions.filter((question) => question.active !== false), manifest.mockRules, () => 0.37)
      expect(mock.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(item.occupationQuota)
      if (item.extraCommonCode) {
        expect(mock.filter((question) => question.subjectCode === item.extraCommonCode)).toHaveLength(item.extraCommonQuota)
      }
    }
  })

  it('keeps the official machining deletions inactive and restores dimension tolerances as text', () => {
    const byId = new Map(loadExamBank('machining-c').map((question) => [question.id, question]))
    expect(byId.get('18500-02-020')?.active).toBe(false)
    expect(byId.get('18500-04-261')?.active).toBe(false)
    expect(byId.get('18500-06-015')?.prompt).toContain('上偏差 +0.08、下偏差 +0.02')
    expect(byId.get('18500-06-016')?.prompt).toContain('上偏差 +0.03、下偏差 +0')
    expect(byId.get('18500-06-015')?.hasFigure).toBe(false)
    expect(byId.get('18500-06-016')?.hasFigure).toBe(false)
  })

  it('ships every reviewed surveying figure as an image and keeps 本題刪題 inactive', () => {
    const byId = new Map(loadExamBank('surveying-c').map((question) => [question.id, question]))
    expect(byId.get('04200-01-033')?.active).toBe(false)
    // Table questions (下表／如下) have no parser-visible figure marker; a
    // missing hasFigure here means the learner sees a prompt with no table.
    for (const id of SURVEYING_FIGURE_IDS) {
      const question = byId.get(id)
      expect(question?.hasFigure, id).toBe(true)
      for (const image of question?.sourceImages ?? [question?.sourceImage]) {
        expect(image, id).toMatch(/^\/question-images\/042003-/)
        expect(existsSync(new URL(`../public${image}`, import.meta.url)), `${id} ${image}`).toBe(true)
      }
    }
    // Transcribed formulas stay text, not tiny images.
    expect(byId.get('04200-01-052')?.hasFigure).toBe(false)
    expect(byId.get('04200-01-052')?.options).toEqual(['P＝k/σ̂', 'P＝k/σ̂²', 'P＝k/σ̂³', 'P＝k/σ̂⁴'])
  })

  it('publishes 國貿業務丙級 as a text-only bank with every question active', () => {
    const occupation = loadExamBank('international-trade-c').filter((question) => question.subjectCode === '20000')
    expect(occupation).toHaveLength(770)
    expect(occupation.every((question) => question.active !== false)).toBe(true)
    expect(occupation.some((question) => question.hasFigure)).toBe(false)
  })

  it('publishes the first text-only batch with official mock splits', () => {
    const cases = [
      { examId: 'chinese-cooking-vegetarian-c', code: '07601', published: 507, active: 505, shared: '90010', b: false },
      { examId: 'chinese-cooking-meat-b', code: '07602', published: 676, active: 670, shared: '90010', b: true },
      { examId: 'beauty-b', code: '10000', published: 682, active: 682, shared: '90012', b: true },
      { examId: 'pressure-vessel-operation-single', code: '09900', published: 649, active: 645, b: false },
      { examId: 'horticulture-c', code: '13300', published: 687, active: 687, b: false },
      { examId: 'funeral-service-c', code: '20300', published: 610, active: 607, b: false },
      { examId: 'funeral-service-b', code: '20300', published: 599, active: 599, b: true },
      { examId: 'folk-massage-single', code: '22600', published: 643, active: 643, b: false },
      { examId: 'chemistry-c', code: '03000', published: 628, active: 628, b: false },
      { examId: 'food-analysis-c', code: '09200', published: 535, active: 534, shared: '90010', b: false },
    ]
    for (const item of cases) {
      const bank = loadExamBank(item.examId)
      const occupation = bank.filter((question) => question.subjectCode === item.code)
      expect(occupation).toHaveLength(item.published)
      expect(occupation.filter((question) => question.active !== false)).toHaveLength(item.active)
      expect(occupation.some((question) => question.hasFigure)).toBe(false)
      expect(occupation.every((question) => question.prompt.trim() && question.options.length === 4)).toBe(true)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as { mockRules: Parameters<typeof buildMockQueue>[1] }
      const active = bank.filter((question) => question.active !== false)
      for (let i = 0; i < 10; i += 1) {
        const mock = buildMockQueue(active, manifest.mockRules, () => (i + 1) / 11)
        expect(mock).toHaveLength(80)
        expect(mock.filter((question) => question.kind === 'multiple')).toHaveLength(item.b ? 20 : 0)
        expect(mock.filter((question) => question.subjectCode === item.code)).toHaveLength(item.shared ? 48 : 64)
        if (item.shared) expect(mock.filter((question) => question.subjectCode === item.shared)).toHaveLength(16)
      }
    }
  })

  it('restores sub/superscripts the PDF text layer drops', () => {
    const text = (examId: string, id: string) => {
      const question = loadExamBank(examId).find((item) => item.id === id)!
      return `${question.prompt} ${question.options.join(' ')}`
    }
    expect(text('beauty-b', '10000-02-102')).toContain('維生素 B12')
    expect(text('horticulture-c', '13300-02-112')).toContain('P₂O₅')
    expect(text('pressure-vessel-operation-single', '09900-12-014')).toContain('（kgf/cm²）數值與內容積（m³）')
    // Shared subjects are untouched, so they match every other pack.
    expect(text('horticulture-c', '90009-04-050')).toBe(text('baking-food-c', '90009-04-050'))
  })

  // 化學 and 食品檢驗分析 take their scripts from the PDF's word boxes
  // (scripts/scriptedText.mjs): exponents must not read as subtraction.
  it('keeps exponents, charges and formulas from the PDF in the formula-heavy banks', () => {
    const question = (examId: string, id: string) => loadExamBank(examId).find((item) => item.id === id)!
    expect(question('chemistry-c', '03000-01-004').options).toEqual(['CuS(Kₛₚ=8×10⁻³⁷)', 'Ag₂S(Kₛₚ=6×10⁻⁵¹)', 'Bi₂S₃(Kₛₚ=1×10⁻⁷⁰)', 'MnS(Kₛₚ=7×10⁻¹⁶)'])
    expect(question('chemistry-c', '03000-01-006').options).toEqual(['Na⁺', 'H₃O⁺', 'SO₄²⁻', 'OH⁻'])
    expect(question('food-analysis-c', '09200-04-013').options).toEqual(['1 lb/in²', '15 lb/in²', '30 lb/in²', '50 lb/in²'])
    expect(question('food-analysis-c', '09200-02-046').active).toBe(false)
    // Glyphs the PDF draws as graphics, restored by hand.
    expect(question('chemistry-c', '03000-04-022').prompt).toBe('²³⁸₉₂U 原子核的中子數為')
    expect(question('food-analysis-c', '09200-01-111').options[0]).toBe('酚酞')
    expect(question('food-analysis-c', '09200-08-012').options[1]).toBe('核苷酸')
    expect(question('food-analysis-c', '09200-05-001').prompt).toContain('(o-Tolidine)')
    for (const examId of ['chemistry-c', 'food-analysis-c']) {
      const own = loadExamBank(examId).filter((item) => !item.subjectCode.startsWith('900'))
      const flattened = own.filter((item) => /10\s+[-−]\s*\d|×10\s+\d|[A-Z][a-z]?\s+\d\s+[A-Z]/.test([item.prompt, ...item.options].join(' ')))
      expect(flattened.map((item) => item.id)).toEqual([])
    }
    expect(question('chemistry-c', '90009-04-050').prompt).toBe(question('baking-food-c', '90009-04-050').prompt)
  })

  // Ids repeat across levels of one occupation (11800 丙/乙). Overrides written
  // for one PDF must not land on the other level's question with the same id.
  it('keeps 丙級 option overrides off same-numbered 乙級 questions', () => {
    const question = loadExamBank('computer-software-application-b').find((item) => item.id === '11800-03-056')!
    expect(question.prompt).toBe('下列何者不是作業系統的功能？')
    expect(question.options).toEqual(['輸出/入裝置的管理', '處理的管理', '輸入法的管理', '記憶體的管理'])
    const meatB = loadExamBank('chinese-cooking-meat-b')
    expect(meatB.find((item) => item.id === '07602-01-067')?.active).not.toBe(false)
  })

  it('ships each 三視圖 question with its 3D object and four option images', () => {
    const byId = new Map(loadExamBank('visual-communication-design-c').map((question) => [question.id, question]))
    for (let number = 1; number <= 20; number += 1) {
      const id = `20100-05-${String(number).padStart(3, '0')}`
      const question = byId.get(id)
      expect(question?.hasFigure, id).toBe(true)
      expect(question?.sourceImages, id).toEqual([
        `/question-images/201003-${id}.png`,
        ...[1, 2, 3, 4].map((option) => `/question-images/201003-${id}-${option}.png`),
      ])
      for (const image of question?.sourceImages ?? []) {
        expect(existsSync(new URL(`../public${image}`, import.meta.url)), image).toBe(true)
      }
    }
    for (const id of ['20100-02-069', '20100-03-045', '20100-04-029', '20100-04-036', '20100-04-085', '20100-05-053']) {
      expect(byId.get(id)?.active, id).toBe(false)
    }
    expect(byId.get('20100-03-040')?.hasFigure).toBe(false)
  })

  it('publishes the official aircraft maintenance class C pack', () => {
    const questions = loadExamBank('aircraft-maintenance-c')
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/aircraft-maintenance-c/manifest.json', import.meta.url), 'utf8'),
    ) as {
      version: string
      questionCount: number
      activeQuestionCount: number
      sections: unknown[]
      mockRules: Parameters<typeof buildMockQueue>[1]
    }

    expect(manifest.version).toBe('A12')
    expect(manifest.questionCount).toBe(1043)
    expect(manifest.activeQuestionCount).toBe(1038)
    expect(manifest.sections).toHaveLength(12)
    expect(questions.filter((question) => question.subjectCode === '17600')).toHaveLength(643)
    expect(questions.filter((question) => question.subjectCode === '17600' && question.hasFigure)).toHaveLength(21)
    for (const id of ['17600-01-033', '17600-01-057', '17600-01-058', '17600-01-066']) {
      const question = questions.find((item) => item.id === id)
      expect(question?.hasFigure, id).toBe(false)
      expect(question?.options.some((option) => option.includes('圖示選項')), id).toBe(false)
    }
    expect(questions.find((item) => item.id === '17600-04-046')?.options).toEqual(['1800 呎', '24000 呎', '30000 呎', '36000 呎'])
    expect(questions.find((item) => item.id === '17600-06-033')?.prompt).toContain('v = 100√2 sin ωt')
    expect(questions.find((item) => item.id === '17600-06-033')?.options).toEqual(['5A', '2√2 A', '2A', '1A'])
    expect(questions.every((question) => question.examId === 'aircraft-maintenance-c')).toBe(true)

    const active = questions.filter((question) => question.active !== false)
    const mock = buildMockQueue(active, manifest.mockRules, () => 0.41)
    expect(mock).toHaveLength(80)
    expect(mock.filter((question) => question.subjectCode === '17600')).toHaveLength(64)
  })

  it('publishes the high-demand third-round care and safety packs from official banks', () => {
    // occupational-safety-management-a active 615 → 614 / activeTotal 1010 →
    // 1009, motorcycle-repair-c active 599 → 598 / activeTotal 994 → 993,
    // dining-service-c active 520 → 519 / activeTotal 1195 → 1194: each
    // pack's crop-defect trio (22000-03-186, 14500-03-195, 21500-03-073 —
    // pure-white PNGs at a source page boundary) was pulled by Wen
    // (2026-07-21). See INACTIVE_IDS in build-exam-packs.mjs.
    const cases = [
      { examId: 'childcare-single', occupationCode: '15400', published: 892, active: 892, total: 1292, activeTotal: 1287, sections: 10 },
      { examId: 'care-service-single', occupationCode: '17800', published: 625, active: 619, total: 1025, activeTotal: 1014, sections: 10 },
      { examId: 'occupational-safety-health-management-b', occupationCode: '22200', published: 932, active: 922, total: 1332, activeTotal: 1317, sections: 7 },
      { examId: 'occupational-safety-management-a', occupationCode: '22000', published: 615, active: 614, total: 1015, activeTotal: 1009, sections: 7 },
      { examId: 'occupational-hygiene-management-a', occupationCode: '22100', published: 722, active: 722, total: 1122, activeTotal: 1117, sections: 7 },
      { examId: 'loader-operation-single', occupationCode: '07004', published: 676, active: 676, total: 1076, activeTotal: 1071, sections: 7 },
      { examId: 'motorcycle-repair-c', occupationCode: '14500', published: 599, active: 598, total: 999, activeTotal: 993, sections: 11 },
      { examId: 'electrical-equipment-inspection-c', occupationCode: '16600', published: 685, active: 685, total: 1085, activeTotal: 1080, sections: 9 },
      { examId: 'dining-service-c', occupationCode: '21500', published: 524, active: 519, total: 1205, activeTotal: 1194, sections: 12 },
    ]

    for (const item of cases) {
      const questions = loadExamBank(item.examId)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as { questionCount: number; activeQuestionCount: number; sections: unknown[] }

      expect(manifest.questionCount).toBe(item.total)
      expect(manifest.activeQuestionCount).toBe(item.activeTotal)
      expect(manifest.sections).toHaveLength(item.sections)
      expect(questions.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(item.published)
      expect(questions.filter((question) => question.subjectCode === item.occupationCode && question.active !== false)).toHaveLength(item.active)
      expect(questions.every((question) => question.examId === item.examId)).toBe(true)
    }
  })

  it('excludes the new WDA deletions without removing their stable question records', () => {
    for (const [examId, ids] of [
      ['care-service-single', ['17800-04-082']],
      ['digital-electronics-b', ['11700-05-018', '11700-05-116']],
    ] as const) {
      const byId = new Map(loadExamBank(examId).map((question) => [question.id, question]))
      for (const id of ids) expect(byId.get(id)?.active, id).toBe(false)
    }
  })

  it('builds employment service mocks from active-only question packs', () => {
    const bank = loadExamBank('employment-service-b').filter((question) => question.active !== false)
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/employment-service-b/manifest.json', import.meta.url), 'utf8'),
    ) as { mockRules: Parameters<typeof buildMockQueue>[1] }

    for (let i = 0; i < 20; i += 1) {
      const mock = buildMockQueue(bank, manifest.mockRules, () => (i + 1) / 21)
      expect(mock).toHaveLength(80)
      expect(mock.filter((question) => question.kind === 'single')).toHaveLength(60)
      expect(mock.filter((question) => question.kind === 'multiple')).toHaveLength(20)
      expect(mock.filter((question) => question.subjectCode === '19500')).toHaveLength(64)
      for (const code of ['90006', '90007', '90008', '90009']) {
        expect(mock.filter((question) => question.subjectCode === code)).toHaveLength(4)
      }
      expect(new Set(mock.map((question) => question.id)).size).toBe(80)
    }
  })

  it('publishes the first high-demand class C expansion packs from official banks', () => {
    const cases = [
      {
        examId: 'computer-software-application-c',
        titleZh: '電腦軟體應用丙級',
        occupationCode: '11800',
        version: 'A14',
        occupationPublished: 748,
        occupationActive: 748,
        extraCommonCode: '90011',
        extraCommonQuota: 12,
        extraCommonActive: 119,
      },
      {
        examId: 'chinese-cooking-meat-c',
        titleZh: '中餐烹調－葷食丙級',
        occupationCode: '07602',
        version: 'A13',
        occupationPublished: 640,
        occupationActive: 637,
        extraCommonCode: '90010',
        extraCommonQuota: 16,
        extraCommonActive: 280,
      },
      {
        examId: 'baking-food-c',
        titleZh: '烘焙食品丙級',
        occupationCode: '07700',
        version: 'A12',
        occupationPublished: 513,
        occupationActive: 512,
        extraCommonCode: '90010',
        extraCommonQuota: 16,
        extraCommonActive: 280,
      },
    ]

    for (const item of cases) {
      const generated = loadExamBank(item.examId)
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${item.examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as {
        examId: string
        titleZh: string
        version: string
        questionCount: number
        activeQuestionCount: number
        mockRules: Parameters<typeof buildMockQueue>[1]
      }
      const occupation = generated.filter((question) => question.subjectCode === item.occupationCode)
      const extraCommon = generated.filter((question) => question.subjectCode === item.extraCommonCode)

      expect(manifest).toMatchObject({
        examId: item.examId,
        titleZh: item.titleZh,
        version: item.version,
        mockRules: { totalQuestions: 80, singleCount: 80, multipleCount: 0 },
      })
      expect(occupation).toHaveLength(item.occupationPublished)
      expect(occupation.filter((question) => question.active !== false)).toHaveLength(item.occupationActive)
      expect(extraCommon.filter((question) => question.active !== false)).toHaveLength(item.extraCommonActive)
      expect(generated.every((question) => question.examId === item.examId)).toBe(true)

      const active = generated.filter((question) => question.active !== false)
      const mock = buildMockQueue(active, manifest.mockRules, () => 0.41)
      expect(mock).toHaveLength(80)
      expect(mock.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(64 - item.extraCommonQuota)
      expect(mock.filter((question) => question.subjectCode === item.extraCommonCode)).toHaveLength(item.extraCommonQuota)
      for (const code of ['90006', '90007', '90008', '90009']) {
        expect(mock.filter((question) => question.subjectCode === code)).toHaveLength(4)
      }
    }
  })

  it('ships a complete crop set for the baking image-option question', () => {
    const baking = loadExamBank('baking-food-c')
    const question = baking.find((item) => item.id === '07700-03-003')

    expect(question).toMatchObject({
      answers: [1],
      options: ['圖示選項 1', '圖示選項 2', '圖示選項 3', '圖示選項 4'],
    })
    expect(question?.sourceImages).toHaveLength(4)
    for (const image of question?.sourceImages ?? []) {
      expect(existsSync(new URL(`../public${decodeURIComponent(image)}`, import.meta.url)), image).toBe(true)
    }
  })
})

// These assertions run against every pack under public/data/exams — the files
// learners actually download. publicationGate.mjs reads manifest metadata only
// and never opens questions.json, so without this suite an image defect inside
// a shipped bank has nothing standing between it and the exam hall.
describe('shipped question banks', () => {
  const packs = listShippedPacks()

  it('discovers every shipped pack', () => {
    expect(packs.length).toBeGreaterThanOrEqual(27)
  })

  // PracticeView.optionImageSources renders one <img> per option and accepts
  // exactly two shapes: one image per option, or a stem figure at index 0
  // followed by one per option. Any other count makes it return [] — every
  // option collapses to the placeholder text "圖示選項 N", the question becomes
  // unanswerable, and the page scan showing all four marks together takes over
  // as the figure. Assert the renderer's real contract against every pack.
  it('gives every image-option question exactly one image per option', () => {
    const violations: string[] = []

    for (const examId of packs) {
      const imageOptionQuestions = loadExamBank(examId).filter((question) =>
        question.active !== false &&
        usesImageOptionPlaceholders(question) &&
        !question.optionCodeBlocks?.some(Boolean))

      for (const question of imageOptionQuestions) {
        const images = question.sourceImages ?? []
        const optionCount = question.options.length
        if (images.length !== optionCount && images.length !== optionCount + 1) {
          violations.push(
            `${examId}:${question.id} — ${images.length} sourceImages for ${optionCount} image options`,
          )
          continue
        }
        const optionImages = images.length === optionCount + 1 ? images.slice(1) : images
        for (const [index, image] of optionImages.entries()) {
          if (!imageExists(image)) {
            violations.push(`${examId}:${question.id} — option ${index + 1} image missing on disk: ${image}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  // A sourceImage/sourceImages path that does not resolve on disk renders as a
  // broken image. For a 圖示選項 question that silently removes the answer; for a
  // stem figure it removes the thing the question is asking about. Either way
  // the learner is answering a question they cannot see.
  it('resolves every referenced question image on disk', () => {
    const violations: string[] = []

    for (const examId of packs) {
      for (const question of loadExamBank(examId)) {
        if (question.active === false) continue
        const referenced = [
          ...(question.sourceImages ?? []),
          ...(question.sourceImage ? [question.sourceImage] : []),
        ]
        for (const image of referenced) {
          if (!imageExists(image)) {
            violations.push(`${examId}:${question.id} — missing image file: ${image}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
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
