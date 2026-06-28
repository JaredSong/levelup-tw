import { existsSync, readFileSync } from 'node:fs'
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

    expect(generated).toHaveLength(18)
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

  it('keeps split 90011 code figures pointed at the page that contains the code image', () => {
    const byId = new Map(loadBank().map((question) => [question.id, question]))

    expect(byId.get('90011-04-019')).toMatchObject({
      answers: [3],
      sourceImage: '/question-images/90011-page-8%2019.png',
      sourcePageImage: '/question-pages/90011-page-8.jpg',
    })
    expect(byId.get('90011-04-020')).toMatchObject({
      answers: [3],
      sourceImage: '/question-images/90011-page-8%2020.png',
      sourcePageImage: '/question-pages/90011-page-8.jpg',
    })
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
