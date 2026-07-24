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

const TARGETS = {
  'car-repair-c': { subjectCode: '02000', pdf: 'source/020003A11.pdf', bank: 'public/data/exams/car-repair-c/questions.json' },
  'man-haircut-c': { subjectCode: '06000', pdf: 'source/060003A12.pdf', bank: 'public/data/exams/man-haircut-c/questions.json' },
  'women-hairdressing-c': { subjectCode: '06700', pdf: 'source/067003A13.pdf', bank: 'public/data/exams/women-hairdressing-c/questions.json' },
  'chinese-cooking-meat-c': { subjectCode: '07602', pdf: 'source/076023A13.pdf', bank: 'public/data/exams/chinese-cooking-meat-c/questions.json' },
  'baking-food-c': { subjectCode: '07700', pdf: 'source/077003A12.pdf', bank: 'public/data/exams/baking-food-c/questions.json' },
  'beauty-c': { subjectCode: '10000', pdf: 'source/100003A15.pdf', bank: 'public/data/exams/beauty-c/questions.json' },
  'computer-software-application-c': { subjectCode: '11800', pdf: 'source/118003A14.pdf', bank: 'public/data/exams/computer-software-application-c/questions.json' },
  'computer-software-application-b': { subjectCode: '11800', pdf: 'source/118002A15.pdf', bank: 'public/data/exams/computer-software-application-b/questions.json' },
  'computer-hardware-repair-b': { subjectCode: '12000', pdf: 'source/120002A12.pdf', bank: 'public/data/exams/computer-hardware-repair-b/questions.json' },
  'computer-hardware-repair-c': { subjectCode: '12000', pdf: 'source/120003A12.pdf', bank: 'public/data/exams/computer-hardware-repair-c/questions.json' },
  'motorcycle-repair-c': { subjectCode: '14500', pdf: 'source/145003A13.pdf', bank: 'public/data/exams/motorcycle-repair-c/questions.json' },
  'industrial-wiring-c': { subjectCode: '01300', pdf: 'source/013003A13.pdf', bank: 'public/data/exams/industrial-wiring-c/questions.json' },
  'indoor-wiring-b': { subjectCode: '00700', pdf: 'source/007002A15.pdf', bank: 'public/data/exams/indoor-wiring-b/questions.json' },
  'indoor-wiring-c': { subjectCode: '00700', pdf: 'source/007003A13.pdf', bank: 'public/data/exams/indoor-wiring-c/questions.json' },
  'water-pipe-fitting-c': { subjectCode: '01600', pdf: 'source/016003A12.pdf', bank: 'public/data/exams/water-pipe-fitting-c/questions.json' },
  'excavator-operation-single': { subjectCode: '07002', pdf: 'source/070024A10.pdf', bank: 'public/data/exams/excavator-operation-single/questions.json' },
  'digital-electronics-b': { subjectCode: '11700', pdf: 'source/117002A13.pdf', bank: 'public/data/exams/digital-electronics-b/questions.json' },
  'western-cooking-c': { subjectCode: '14000', pdf: 'source/140003A11.pdf', bank: 'public/data/exams/western-cooking-c/questions.json' },
  'retail-service-c': { subjectCode: '18100', pdf: 'source/181003A13.pdf', bank: 'public/data/exams/retail-service-c/questions.json' },
  'cnc-milling-b': { subjectCode: '18201', pdf: 'source/182012A10.pdf', bank: 'public/data/exams/cnc-milling-b/questions.json' },
  'industrial-electronics-c': { subjectCode: '02800', pdf: 'source/028003A11.pdf', bank: 'public/data/exams/industrial-electronics-c/questions.json' },
  'heat-treatment-c': { subjectCode: '02100', pdf: 'source/021003A12.pdf', bank: 'public/data/exams/heat-treatment-c/questions.json' },
  'interior-decoration-management-b': { subjectCode: '12600', pdf: 'source/126002A12.pdf', bank: 'public/data/exams/interior-decoration-management-b/questions.json' },
  'accounting-c': { subjectCode: '14900', pdf: 'source/149003A15.pdf', bank: 'public/data/exams/accounting-c/questions.json' },
  'forklift-operation-single': { subjectCode: '15100', pdf: 'source/151004A14.pdf', bank: 'public/data/exams/forklift-operation-single/questions.json' },
  'childcare-single': { subjectCode: '15400', pdf: 'source/154004A17.pdf', bank: 'public/data/exams/childcare-single/questions.json' },
  'electrical-equipment-inspection-c': { subjectCode: '16600', pdf: 'source/166003A15.pdf', bank: 'public/data/exams/electrical-equipment-inspection-c/questions.json' },
  'care-service-single': { subjectCode: '17800', pdf: 'source/178004A13.pdf', bank: 'public/data/exams/care-service-single/questions.json' },
  'web-design-b': { subjectCode: '17300', pdf: 'source/173002A13.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  'employment-service-b': { subjectCode: '19500', pdf: 'source/195002A17.pdf', bank: 'public/data/exams/employment-service-b/questions.json' },
  'beverage-preparation-c': { subjectCode: '20600', pdf: 'source/206003A13.pdf', bank: 'public/data/exams/beverage-preparation-c/questions.json' },
  'dining-service-c': { subjectCode: '21500', pdf: 'source/215003A11.pdf', bank: 'public/data/exams/dining-service-c/questions.json' },
  'loader-operation-single': { subjectCode: '07004', pdf: 'source/070044A12.pdf', bank: 'public/data/exams/loader-operation-single/questions.json' },
  'occupational-safety-management-a': { subjectCode: '22000', pdf: 'source/220001A15.pdf', bank: 'public/data/exams/occupational-safety-management-a/questions.json' },
  'occupational-hygiene-management-a': { subjectCode: '22100', pdf: 'source/221001A14.pdf', bank: 'public/data/exams/occupational-hygiene-management-a/questions.json' },
  'occupational-safety-health-management-b': { subjectCode: '22200', pdf: 'source/222002A15.pdf', bank: 'public/data/exams/occupational-safety-health-management-b/questions.json' },
  '90006': { subjectCode: '90006', pdf: 'source/900060A18.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90001': { subjectCode: '90001', pdf: 'source/900012A10.pdf', bank: 'public/data/exams/cnc-milling-b/questions.json' },
  '90007': { subjectCode: '90007', pdf: 'source/900070A17.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90008': { subjectCode: '90008', pdf: 'source/900080A16.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90009': { subjectCode: '90009', pdf: 'source/900090A11-latest.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90010': { subjectCode: '90010', pdf: 'source/900100A16.pdf', bank: 'public/data/exams/chinese-cooking-meat-c/questions.json' },
  '90011': { subjectCode: '90011', pdf: 'source/900110A10.pdf', bank: 'public/data/exams/web-design-b/questions.json' },
  '90012': { subjectCode: '90012', pdf: 'source/900120A10.pdf', bank: 'public/data/exams/man-haircut-c/questions.json' },
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

function verifyTarget(target) {
  const source = TARGETS[target]
  if (!source) {
    console.error(`No official source mapped for ${target}. Known: ${Object.keys(TARGETS).join(', ')}`)
    return false
  }
  const { subjectCode } = source

  const fromPdf = extractOfficialKeys(source.pdf)
  const bank = JSON.parse(readFileSync(source.bank, 'utf8'))
  const published = bank.filter((question) => question.subjectCode === subjectCode && question.active !== false)
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

  console.log(`target ${target} / subject ${subjectCode} — ${source.pdf}`)
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
const targets = requested === '--all' ? Object.keys(TARGETS) : [requested]
let allPassed = true
for (const target of targets) {
  if (!verifyTarget(target)) allPassed = false
}
if (!allPassed) process.exitCode = 1
