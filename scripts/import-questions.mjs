import { readFile, writeFile } from 'node:fs/promises'
import { parseQuestionBank } from './questionParser.mjs'

const outputPath = new URL('../public/data/questions.json', import.meta.url)
const banks = [
  { code: '17300', file: '173002A13-raw.txt', expected: 846 },
  { code: '90011', file: '90011-raw.txt', expected: 119 },
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
