import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMockQueue, type Question } from '../src/domain/studyEngine'
import { parseQuestionBank } from './questionParser.mjs'

function loadBank(): Question[] {
  return JSON.parse(readFileSync(new URL('../source/questions.json', import.meta.url), 'utf8')) as Question[]
}

function loadExamBank(examId: string): Question[] {
  return JSON.parse(readFileSync(new URL(`../public/data/exams/${examId}/questions.json`, import.meta.url), 'utf8')) as Question[]
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
  it('gives every image-option question exactly one image per option', () => {
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
        expect(mock.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(60)
        expect(mock.filter((question) => question.subjectCode === '90012')).toHaveLength(4)
        for (const code of ['90006', '90007', '90008', '90009']) {
          expect(mock.filter((question) => question.subjectCode === code)).toHaveLength(4)
        }
        expect(new Set(mock.map((question) => question.id)).size).toBe(80)
      }
    }
  })

  it('publishes employment service class B from the official 195002A19 bank', () => {
    const generated = loadExamBank('employment-service-b')
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/employment-service-b/manifest.json', import.meta.url), 'utf8'),
    ) as {
      examId: string
      titleZh: string
      level: string
      questionCount: number
      activeQuestionCount: number
      sections: Array<{ id: string; subjectCode: string; questionCount: number }>
      mockRules: { totalQuestions: number; singleCount: number; multipleCount: number }
    }

    expect(manifest).toMatchObject({
      examId: 'employment-service-b',
      titleZh: '就業服務乙級',
      level: '乙級',
      questionCount: 1614,
      activeQuestionCount: 1609,
      mockRules: { totalQuestions: 80, singleCount: 60, multipleCount: 20 },
    })
    expect(Object.fromEntries(manifest.sections.map((section) => [section.id, section.questionCount]))).toEqual({
      '19500-01': 777,
      '19500-02': 226,
      '19500-03': 211,
      '90006-01': 100,
      '90007-01': 100,
      '90008-03': 100,
      '90009-04': 100,
    })
    expect(generated).toHaveLength(1614)
    expect(generated.filter((question) => question.active !== false)).toHaveLength(1609)
    expect(generated.filter((question) => question.subjectCode === '19500')).toHaveLength(1214)
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
      expect(mock.filter((question) => question.subjectCode === item.occupationCode)).toHaveLength(60)
      expect(mock.filter((question) => question.subjectCode === item.extraCommonCode)).toHaveLength(4)
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
