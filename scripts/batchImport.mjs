import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOcrReviewQueue } from './ocrAudit.mjs'
import { parseQuestionBank } from './questionParser.mjs'

const LEVELS = { '1': '甲級', '2': '乙級', '3': '丙級', '4': '單一級' }
const SECTION_PATTERN = /工作項目\s*(\d{2})/
const KEY_PATTERN = /^\s*(\d{1,4})\.\s*\(([1-4]{1,4})\)/
const DELETION_PATTERN = /本題刪題|刪除本題|本題删除|删除本題/

export function parseExamSpecifier(value) {
  const input = String(value ?? '').trim()
  const match = input.match(/^(\d{5})([1-4])$/) ?? input.match(/^(\d{5}):([1-4])$/)
  if (!match || !LEVELS[match[2]]) {
    throw new Error(`Expected a six-digit WDA code such as 028003, or code:level such as 02800:3; received ${JSON.stringify(input)}`)
  }
  return { input, subjectCode: match[1], levelCode: match[2], level: LEVELS[match[2]] }
}

export function findOfficialDocument(catalog, specifier) {
  return (catalog.documents ?? []).find((document) => (
    document.subjectCode === specifier.subjectCode && String(document.levelCode) === specifier.levelCode
  )) ?? null
}

export function extractOfficialKeysFromText(raw) {
  const keys = new Map()
  let section = null
  for (const line of String(raw).split(/\r?\n/)) {
    const header = line.match(SECTION_PATTERN)
    if (header) {
      section = header[1]
      continue
    }
    const key = line.match(KEY_PATTERN)
    if (!key || !section) continue
    const id = `${section}-${Number(key[1])}`
    if (!keys.has(id)) keys.set(id, [...key[2]].map(Number).sort((a, b) => a - b))
  }
  return keys
}

function mergeReviewReason(pages, question, reason) {
  if (!Number.isInteger(question.sourcePage)) return
  const page = pages.get(question.sourcePage) ?? {
    page: question.sourcePage,
    engine: 'paddle-pp-structure-v3',
    questionIds: [],
    reasons: [],
  }
  if (!page.questionIds.includes(question.id)) page.questionIds.push(question.id)
  if (!page.reasons.includes(reason)) page.reasons.push(reason)
  pages.set(question.sourcePage, page)
}

function compareAnswers(questions, officialKeys) {
  const mismatches = []
  const unmatched = []
  let checked = 0
  let agreed = 0
  for (const question of questions) {
    const section = question.section.split('-').at(-1)
    const official = officialKeys.get(`${section}-${question.number}`)
    if (!official) {
      unmatched.push(question.id)
      continue
    }
    checked += 1
    const parsed = [...question.answers].sort((a, b) => a - b)
    if (parsed.join() === official.join()) agreed += 1
    else mismatches.push({ id: question.id, parsed, official })
  }
  return { checked, agreed, mismatches, unmatched }
}

export function auditCandidate({ subjectCode, questions, officialKeys }) {
  const blockers = []
  const ids = new Set()
  const duplicateIds = []
  const wrongSubjectIds = []
  for (const question of questions) {
    if (ids.has(question.id)) duplicateIds.push(question.id)
    ids.add(question.id)
    if (question.subjectCode !== subjectCode) wrongSubjectIds.push(question.id)
  }
  if (!questions.length) blockers.push('no-questions-parsed')
  if (duplicateIds.length) blockers.push('duplicate-question-ids')
  if (wrongSubjectIds.length) blockers.push('subject-code-mismatch')

  const answerIntegrity = compareAnswers(questions, officialKeys)
  if (answerIntegrity.mismatches.length || answerIntegrity.unmatched.length || answerIntegrity.checked !== questions.length) {
    blockers.push('answer-key-integrity')
  }

  const pages = new Map(buildOcrReviewQueue(questions).map((item) => [item.page, { ...item }]))
  const deletionCandidates = []
  for (const question of questions) {
    if (DELETION_PATTERN.test(`${question.prompt} ${(question.options ?? []).join(' ')}`)) {
      deletionCandidates.push(question.id)
      mergeReviewReason(pages, question, 'deletion-marker')
    }
  }
  const reviewQueue = [...pages.values()].sort((a, b) => a.page - b.page)
  const sections = [...new Set(questions.map((question) => question.section))].sort()
  const singleCount = questions.filter((question) => question.kind === 'single').length
  const multipleCount = questions.filter((question) => question.kind === 'multiple').length
  return {
    status: blockers.length ? 'blocked' : reviewQueue.length ? 'review_required' : 'ready_for_config',
    blockers,
    questionCount: questions.length,
    sectionCount: sections.length,
    sections,
    singleCount,
    multipleCount,
    figureQuestionCount: questions.filter((question) => question.hasFigure).length,
    deletionCandidates,
    duplicateIds,
    wrongSubjectIds,
    answerIntegrity,
    flaggedPageCount: reviewQueue.length,
    reviewQueue,
  }
}

export function buildCandidateConfig({ specifier, document, category, questionCount, sha256 }) {
  const isClassC = specifier.levelCode === '3' || specifier.levelCode === '4'
  const title = String(document.title ?? specifier.subjectCode).trim()
  return {
    publishable: false,
    manualFields: ['examId', 'titleEn', 'category', 'extraCommonCodes', 'inactiveIds', 'figureIds', 'mockRules'],
    examId: null,
    titleZh: title.endsWith(specifier.level) ? title : `${title}${specifier.level}`,
    titleEn: null,
    level: specifier.level,
    category: category ?? null,
    subjectCode: specifier.subjectCode,
    occupationFile: document.pdfFilename.replace(/\.pdf$/i, '-raw.txt'),
    occupationExpected: questionCount,
    version: document.version,
    source: {
      pdfFilename: document.pdfFilename,
      officialUrl: document.officialUrl,
      sha256,
    },
    extraCommonCodes: null,
    inactiveIds: [],
    figureIds: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: isClassC ? 80 : 60,
      multipleCount: isClassC ? 0 : 20,
      weightSingle: isClassC ? 1.25 : 1,
      weightMultiple: isClassC ? 0 : 2,
    },
  }
}

function reportMarkdown({ specifier, document, config, audit, paths }) {
  const lines = [
    `# ${config.titleZh} import audit`,
    '',
    `- Status: **${audit.status}**`,
    `- Official source: [${document.pdfFilename}](${document.officialUrl})`,
    `- SHA-256: \`${config.source.sha256}\``,
    `- Questions: ${audit.questionCount} (${audit.singleCount} single / ${audit.multipleCount} multiple)`,
    `- Sections: ${audit.sectionCount}`,
    `- Figure questions detected: ${audit.figureQuestionCount}`,
    `- Pages requiring review: ${audit.flaggedPageCount}`,
    `- Answer keys: ${audit.answerIntegrity.agreed}/${audit.answerIntegrity.checked} agree`,
    `- Staging directory: \`${paths.outputDir}\``,
    '',
  ]
  if (audit.blockers.length) lines.push('## Blocking failures', '', ...audit.blockers.map((item) => `- ${item}`), '')
  if (audit.deletionCandidates.length) {
    lines.push('## Deletion candidates', '', ...audit.deletionCandidates.map((id) => `- ${id}`), '')
  }
  lines.push(
    '## Next gate',
    '',
    'Review `review-queue.json`, run PaddleOCR only where useful, fill every field in `candidate-config.json`, and promote through the normal publication gate. This staging output is never loaded by the app.',
    '',
    `Specifier: \`${specifier.input}\``,
  )
  return `${lines.join('\n')}\n`
}

async function downloadPdf(url, outputPath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(`${url} did not return a PDF`)
  await writeFile(outputPath, bytes)
  return bytes
}

async function readCategory(specifier) {
  try {
    const demand = JSON.parse(await readFile(new URL('../source/wda-demand-ranking.json', import.meta.url), 'utf8'))
    return demand.ranking?.find((item) => (
      item.code === specifier.subjectCode && item.level === specifier.level
    ))?.category ?? null
  } catch {
    return null
  }
}

async function stageCandidate(specifier, catalog, { force = false, offline = false, paddle = false } = {}) {
  const document = findOfficialDocument(catalog, specifier)
  if (!document) throw new Error(`${specifier.input}: no current theory PDF in the committed WDA catalog`)
  const stem = document.pdfFilename.replace(/\.pdf$/i, '')
  const outputDir = join('tmp', 'import-batch', stem)
  await mkdir(outputDir, { recursive: true })
  const pdfPath = join(outputDir, document.pdfFilename)
  const rawPath = join(outputDir, `${stem}-raw.txt`)
  let pdfBytes
  try {
    if (force) throw new Error('refresh requested')
    pdfBytes = await readFile(pdfPath)
  } catch {
    if (offline) throw new Error(`${specifier.input}: ${pdfPath} is not cached and --offline was requested`)
    pdfBytes = await downloadPdf(document.officialUrl, pdfPath)
  }
  if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(`${pdfPath} is not a PDF`)
  const sha256 = createHash('sha256').update(pdfBytes).digest('hex')
  execFileSync('pdftotext', ['-layout', pdfPath, rawPath])
  const raw = await readFile(rawPath, 'utf8')
  const questions = parseQuestionBank(raw)
  const officialKeys = extractOfficialKeysFromText(raw)
  const audit = auditCandidate({ subjectCode: specifier.subjectCode, questions, officialKeys })
  const category = await readCategory(specifier)
  const config = buildCandidateConfig({ specifier, document, category, questionCount: questions.length, sha256 })
  const paths = {
    outputDir,
    pdfPath,
    rawPath,
    questionsPath: join(outputDir, 'questions.json'),
    queuePath: join(outputDir, 'review-queue.json'),
    configPath: join(outputDir, 'candidate-config.json'),
    reportPath: join(outputDir, 'report.md'),
  }
  await Promise.all([
    writeFile(paths.questionsPath, `${JSON.stringify(questions, null, 2)}\n`),
    writeFile(paths.queuePath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      subjectCode: specifier.subjectCode,
      pdfFilename: document.pdfFilename,
      flaggedPageCount: audit.flaggedPageCount,
      plan: audit.reviewQueue,
    }, null, 2)}\n`),
    writeFile(paths.configPath, `${JSON.stringify(config, null, 2)}\n`),
    writeFile(paths.reportPath, reportMarkdown({ specifier, document, config, audit, paths })),
  ])
  if (paddle && audit.reviewQueue.length) {
    const runner = fileURLToPath(new URL('./paddleAudit.mjs', import.meta.url))
    execFileSync(process.execPath, [
      runner,
      pdfPath,
      paths.questionsPath,
      specifier.subjectCode,
      join(outputDir, 'paddle'),
      '--run',
    ], { stdio: 'inherit' })
  }
  return { specifier, document, config, audit, paths }
}

async function main() {
  const args = process.argv.slice(2)
  const flags = new Set(args.filter((arg) => arg.startsWith('--')))
  const inputs = args.filter((arg) => !arg.startsWith('--'))
  if (!inputs.length) {
    console.error('Usage: npm run stage:exams -- 028003 120003 016003 [--force] [--offline] [--paddle]')
    process.exit(1)
  }
  const catalog = JSON.parse(await readFile(new URL('../source/wda-catalog.json', import.meta.url), 'utf8'))
  let failed = false
  for (const input of inputs) {
    try {
      const result = await stageCandidate(parseExamSpecifier(input), catalog, {
        force: flags.has('--force'),
        offline: flags.has('--offline'),
        paddle: flags.has('--paddle'),
      })
      console.log(`${input} ${result.config.titleZh}: ${result.audit.questionCount} questions; ${result.audit.flaggedPageCount} review pages; ${result.audit.status}`)
      console.log(`  ${result.paths.reportPath}`)
    } catch (error) {
      failed = true
      console.error(`${input}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failed) process.exitCode = 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) await main()
