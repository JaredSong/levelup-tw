import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function normalizeAuditText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\$_SESSIO\s+N/g, '$_SESSION')
    .replace(/\s*([=+\-*/<>])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 0; i < a.length; i += 1) {
    let last = previous[0]
    previous[0] = i + 1
    for (let j = 0; j < b.length; j += 1) {
      const old = previous[j + 1]
      previous[j + 1] = Math.min(
        previous[j + 1] + 1,
        previous[j] + 1,
        last + (a[i] === b[j] ? 0 : 1),
      )
      last = old
    }
  }
  return previous[b.length]
}

function questionText(question) {
  return [question.prompt, ...(question.options ?? []).map((option, index) => `${index + 1}${option}`)].join(' ')
}

function riskReasons(question) {
  const reasons = []
  if (question.hasFigure) reasons.push('figure')
  if ((question.options?.length ?? 0) !== 4) reasons.push(`option-count:${question.options?.length ?? 0}`)
  const text = questionText(question)
  if (/[$_][A-Za-z0-9_]{2,}\s+[A-Za-z]\b/.test(text)) reasons.push('suspicious-spacing')
  return reasons
}

export function buildOcrReviewQueue(questions) {
  const pages = new Map()
  for (const question of questions) {
    const reasons = riskReasons(question)
    if (!reasons.length || !Number.isInteger(question.sourcePage)) continue
    const page = pages.get(question.sourcePage) ?? {
      page: question.sourcePage,
      engine: 'paddle-pp-structure-v3',
      questionIds: [],
      reasons: [],
    }
    page.questionIds.push(question.id)
    for (const reason of reasons) {
      if (!page.reasons.includes(reason)) page.reasons.push(reason)
    }
    pages.set(question.sourcePage, page)
  }
  return [...pages.values()].sort((a, b) => a.page - b.page)
}

export function compareQuestionToOcr(question, ocrRecord) {
  const current = normalizeAuditText(questionText(question))
  const ocr = normalizeAuditText(ocrRecord?.text ?? '')
  const distance = levenshtein(current, ocr)
  const maxLength = Math.max(current.length, ocr.length, 1)
  const diffRatio = distance / maxLength

  const flagged = diffRatio > 0.01
  return {
    id: question.id,
    flagged,
    reason: flagged ? `diff ratio ${diffRatio.toFixed(3)}` : 'matches',
    diffRatio,
    current,
    ocr,
  }
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const [, , ocrPath, outPath = 'tmp/ocr-audit-report.json'] = process.argv
  if (!ocrPath) {
    console.error('Usage: node scripts/ocrAudit.mjs <ocr-records.json> [out.json]')
    console.error('OCR JSON format: [{ "id": "17300-02-156", "text": "..." }] or { "records": [...] }')
    process.exit(1)
  }

  const questions = loadJson(new URL('../source/questions.json', import.meta.url))
  const raw = loadJson(ocrPath)
  const records = Array.isArray(raw) ? raw : raw.records
  if (!Array.isArray(records)) throw new Error('OCR JSON must be an array or an object with a records array.')
  const byId = new Map(records.map((record) => [record.id, record]))
  const report = questions
    .filter((question) => byId.has(question.id))
    .map((question) => compareQuestionToOcr(question, byId.get(question.id)))
    .filter((item) => item.flagged)
    .sort((a, b) => b.diffRatio - a.diffRatio)

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), count: report.length, report }, null, 2)}\n`)
  console.log(`Wrote ${report.length} flagged OCR differences to ${outPath}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))) main()
