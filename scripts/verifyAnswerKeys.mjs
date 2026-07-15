// Independent second opinion on every published answer key.
//
// The importer parses the official PDF into question records. This verifier
// takes a separate path: pdftotext layout output -> printed "N. (K)" markers ->
// diff against the generated public bank. Importing fails if either an answer
// differs or a published question cannot be matched to an official key.
//
//   node scripts/verifyAnswerKeys.mjs <subjectCode>
//   node scripts/verifyAnswerKeys.mjs --all

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SUBJECTS = {
  '06000': { pdf: 'source/060003A12.pdf', bank: 'public/data/exams/man-haircut-c/questions.json' },
  '06700': { pdf: 'source/067003A13.pdf', bank: 'public/data/exams/women-hairdressing-c/questions.json' },
  '07602': { pdf: 'source/076023A13.pdf', bank: 'public/data/exams/chinese-cooking-meat-c/questions.json' },
  '07700': { pdf: 'source/077003A12.pdf', bank: 'public/data/exams/baking-food-c/questions.json' },
  '11800': { pdf: 'source/118003A14.pdf', bank: 'public/data/exams/computer-software-application-c/questions.json' },
  '17300': { pdf: 'source/173002A13.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '19500': { pdf: 'source/195002A19.pdf', bank: 'public/data/exams/employment-service-b/questions.json' },
  '90006': { pdf: 'source/900060A18.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90007': { pdf: 'source/900070A17.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90008': { pdf: 'source/900080A16.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90009': { pdf: 'source/900090A11-latest.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90010': { pdf: 'source/900100A16.pdf', bank: 'public/data/exams/chinese-cooking-meat-c/questions.json' },
  '90011': { pdf: 'source/900110A10.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90012': { pdf: 'source/900120A10.pdf', bank: 'public/data/exams/man-haircut-c/questions.json' },
}

const sectionPattern = /工作項目\s*(\d{2})/
const keyPattern = /^\s*(\d{1,4})\.\s*\(([1-4]{1,4})\)/

function extractOfficialKeys(pdf) {
  const raw = execFileSync('pdftotext', ['-layout', pdf, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const keys = new Map()
  let section = null

  for (const line of raw.split('\n')) {
    const header = line.match(sectionPattern)
    if (header) {
      section = header[1]
      continue
    }
    const key = line.match(keyPattern)
    if (!key || !section) continue
    const id = `${section}-${Number(key[1])}`
    const answers = [...key[2]].map(Number).sort((a, b) => a - b)
    if (!keys.has(id)) keys.set(id, answers)
  }
  return keys
}

function verifySubject(subjectCode) {
  const source = SUBJECTS[subjectCode]
  if (!source) {
    console.error(`No official source mapped for subject ${subjectCode}. Known: ${Object.keys(SUBJECTS).join(', ')}`)
    return false
  }

  const fromPdf = extractOfficialKeys(source.pdf)
  const bank = JSON.parse(readFileSync(source.bank, 'utf8'))
  const published = bank.filter((question) => question.subjectCode === subjectCode)
  let checked = 0
  let agreed = 0
  const mismatches = []
  const unmatched = []

  for (const question of published) {
    const section = question.section.split('-').at(-1)
    const pdfAnswers = fromPdf.get(`${section}-${question.number}`)
    if (!pdfAnswers) {
      unmatched.push(question.id)
      continue
    }
    checked += 1
    const ours = [...question.answers].sort((a, b) => a - b)
    if (ours.join() === pdfAnswers.join()) agreed += 1
    else mismatches.push({ id: question.id, ours: ours.join(''), pdf: pdfAnswers.join(''), prompt: question.prompt.slice(0, 44) })
  }

  console.log(`subject ${subjectCode} — ${source.pdf}`)
  console.log(`  published questions : ${published.length}`)
  console.log(`  keys found in PDF   : ${fromPdf.size}`)
  console.log(`  cross-checked       : ${checked}`)
  console.log(`  agree               : ${agreed}${checked ? ` (${((agreed / checked) * 100).toFixed(2)}%)` : ''}`)
  console.log(`  DISAGREE            : ${mismatches.length}`)
  console.log(`  no key matched      : ${unmatched.length}`)

  if (mismatches.length) {
    console.log('\n  Disagreements — each needs the official PDF opened by hand:')
    for (const row of mismatches.slice(0, 40)) {
      console.log(`    ${row.id}  ours=${row.ours}  pdf=${row.pdf}  ${row.prompt}`)
    }
  }
  if (unmatched.length) {
    console.log(`\n  Unmatched: ${unmatched.slice(0, 20).join(', ')}${unmatched.length > 20 ? ' …' : ''}`)
  }

  return published.length > 0 && mismatches.length === 0 && unmatched.length === 0
}

const requested = process.argv[2] ?? '--all'
const subjectCodes = requested === '--all' ? Object.keys(SUBJECTS) : [requested]
let allPassed = true
for (const subjectCode of subjectCodes) {
  if (!verifySubject(subjectCode)) allPassed = false
}
if (!allPassed) process.exitCode = 1
