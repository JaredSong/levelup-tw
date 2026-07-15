// Independent second opinion on the answer keys.
//
// The importer already parses the official PDF, so re-reading it with the same
// code would only agree with itself. This extracts the keys a different way —
// straight from `pdftotext` layout output, matching only the "N. (K)" marker the
// official paper prints beside each question number — and diffs that against the
// published bank. Agreement is evidence; disagreement is a question to look at
// by hand.
//
// Third-party sites are deliberately not consulted: they are not authority
// (docs/level-up-public-app-plan.md), and we hold the source they copied from.
//
//   node scripts/verifyAnswerKeys.mjs <subjectCode>
//   node scripts/verifyAnswerKeys.mjs 17300

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SOURCE_PDFS = {
  17300: 'source/173002A13.pdf',
  90006: 'source/900060A18.pdf',
  90007: 'source/900070A17.pdf',
  90008: 'source/900080A16.pdf',
  90009: 'source/900090A11-latest.pdf',
  90011: 'source/900110A10.pdf',
}

const subjectCode = process.argv[2] ?? '17300'
const pdf = SOURCE_PDFS[subjectCode]
if (!pdf) {
  console.error(`No source PDF mapped for subject ${subjectCode}. Known: ${Object.keys(SOURCE_PDFS).join(', ')}`)
  process.exit(1)
}

const raw = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// Question numbers restart at 1 inside every 工作項目, so a key is only
// identified by section + number. Walk the document in order, tracking the
// current section header, and key each answer by "<section>-<number>".
//
//   17300 網頁設計 乙級 工作項目 02：應用軟體安裝及使用
//   12. (3)   ← question 12 *of section 02*
const sectionPattern = /工作項目\s*(\d{2})/
// "12. (3)"; multiple-answer questions print several digits: "12. (134)".
const keyPattern = /^\s*(\d{1,3})\.\s*\(([1-4]{1,4})\)/

const fromPdf = new Map()
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
  // First sighting wins: a repeated number within one section means the regex
  // caught something that only looks like a key (e.g. a numbered list in a stem).
  if (!fromPdf.has(id)) fromPdf.set(id, answers)
}

const bank = JSON.parse(readFileSync(new URL('../source/questions.json', import.meta.url), 'utf8'))
const published = bank.filter((question) => question.subjectCode === subjectCode)

let checked = 0
let agreed = 0
const mismatches = []
const unmatched = []

for (const question of published) {
  // question.section is like "17300-02"; the PDF map is keyed "02-<number>".
  const pdfAnswers = fromPdf.get(`${question.section.split('-')[1]}-${question.number}`)
  if (!pdfAnswers) {
    unmatched.push(question.id)
    continue
  }
  checked += 1
  const ours = [...question.answers].sort((a, b) => a - b)
  if (ours.join() === pdfAnswers.join()) agreed += 1
  else mismatches.push({ id: question.id, ours: ours.join(''), pdf: pdfAnswers.join(''), prompt: question.prompt.slice(0, 44) })
}

console.log(`subject ${subjectCode} — ${pdf}`)
console.log(`  published questions : ${published.length}`)
console.log(`  keys found in PDF   : ${fromPdf.size}`)
console.log(`  cross-checked       : ${checked}`)
console.log(`  agree               : ${agreed}${checked ? ` (${((agreed / checked) * 100).toFixed(2)}%)` : ''}`)
console.log(`  DISAGREE            : ${mismatches.length}`)
console.log(`  no key matched      : ${unmatched.length}`)

if (mismatches.length) {
  console.log('\n  Disagreements — each needs a human to open the PDF and decide:')
  for (const row of mismatches.slice(0, 40)) {
    console.log(`    ${row.id}  ours=${row.ours}  pdf=${row.pdf}  ${row.prompt}`)
  }
  if (mismatches.length > 40) console.log(`    … and ${mismatches.length - 40} more`)
}
if (unmatched.length) console.log(`\n  Unmatched (no "N. (K)" marker found): ${unmatched.slice(0, 12).join(', ')}${unmatched.length > 12 ? ' …' : ''}`)

process.exitCode = mismatches.length ? 1 : 0
