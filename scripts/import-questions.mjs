import { readFile, writeFile } from 'node:fs/promises'
import { parseQuestionBank } from './questionParser.mjs'
import { sanitizeText } from './textCorrections.mjs'

// Questions the official 900080A16 (rev V115041316) marks 本題刪題 (deleted).
// Kept as source records for provenance but flagged inactive so they are
// excluded from queues, mocks, readiness, and active counts.
const INACTIVE_IDS = new Set([
  '90008-03-030',
  '90008-03-047',
  '90008-03-058',
  '90008-03-072',
  '90008-03-092',
])

// A few official PDF questions contain angle-bracket/code fragments that are
// dropped by text extraction. Keep these repairs at import time so generated
// data stays reproducible.
const QUESTION_OVERRIDES = {
  '17300-02-150': {
    options: [
      '以<%@符號開頭，以 %>結尾',
      '以<body符號開頭，以 /body>結尾',
      '以<?php符號開頭，以 ?>結尾',
      '以<html符號開頭，以 /html>結尾',
    ],
  },
  '17300-02-156': {
    prompt: 'PHP 程式「$x="Hello"; $y="World"; echo $x+$y;」其輸出為何？',
  },
  '17300-02-236': {
    prompt: 'JavaScript 程式「<Script>document.write(9 >> 2);</Script>」執行結果為何？',
  },
  '17300-02-237': {
    prompt: 'HTML 語法「<body link="#0000FF" vlink="#FF0000" alink="#FFFF00">」，其功能表示尚未點選超連結過的物件顏色為何？',
  },
  '17300-02-238': {
    prompt: 'HTML 語法標籤 <frameset> 其作用為何？',
  },
  '17300-02-253': {
    prompt: '關於 PHP 程式『<?php phpinfo(); ?>』的意義為何？',
  },
  '17300-02-273': {
    prompt: '在 XHTML 中，<form> 標籤的屬性何者用來指定接收表單資料之伺服器端的程式？',
  },
}

const outputPath = new URL('../public/data/questions.json', import.meta.url)
const banks = [
  { code: '17300', file: '173002A13-raw.txt', expected: 846 },
  { code: '90011', file: '900110A10-raw.txt', expected: 119 },
  { code: '90006', file: '900060A18-raw.txt', expected: 100 },
  { code: '90007', file: '900070A17-raw.txt', expected: 100 },
  { code: '90008', file: '900080A16-raw.txt', expected: 100 },
  { code: '90009', file: '900090A11-latest-raw.txt', expected: 100 },
]

const questions = []
const bankCounts = {}
for (const bank of banks) {
  const source = await readFile(new URL(`../source/${bank.file}`, import.meta.url), 'utf8')
  const parsed = parseQuestionBank(source)
  if (parsed.length !== bank.expected) {
    throw new Error(`${bank.code}: expected ${bank.expected} questions, received ${parsed.length}`)
  }
  bankCounts[bank.code] = parsed.length
  questions.push(...parsed.map((question) => ({
    ...question,
    prompt: sanitizeText(QUESTION_OVERRIDES[question.id]?.prompt ?? question.prompt),
    options: (QUESTION_OVERRIDES[question.id]?.options ?? question.options).map(sanitizeText),
    ...(INACTIVE_IDS.has(question.id) ? { active: false } : {}),
    sourceImage: question.hasFigure
      ? question.subjectCode === '17300'
        ? `/question-pages/page-${String(question.sourcePage).padStart(2, '0')}.jpg`
        : `/question-pages/${question.subjectCode}-page-${question.sourcePage}.jpg`
      : undefined,
  })))
}

const expected = { '17300-01': 242, '17300-02': 405, '17300-03': 124, '17300-04': 75 }
const counts = Object.fromEntries(
  Object.keys(expected).map((section) => [
    section,
    questions.filter((question) => question.section === section).length,
  ]),
)

if (questions.length !== 1365) {
  throw new Error(`Expected 1365 questions, received ${questions.length}`)
}

for (const [section, count] of Object.entries(expected)) {
  if (counts[section] !== count) {
    throw new Error(`Section ${section}: expected ${count}, received ${counts[section]}`)
  }
}

await writeFile(outputPath, `${JSON.stringify(questions)}\n`)
console.log(
  JSON.stringify({
    total: questions.length,
    bankCounts,
    counts,
    single: questions.filter((question) => question.kind === 'single').length,
    multiple: questions.filter((question) => question.kind === 'multiple').length,
    figures: questions.filter((question) => question.hasFigure).length,
  }),
)
