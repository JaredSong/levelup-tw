#!/usr/bin/env node
// Write src/app/bankRevisions/generated-<id>.ts: what a bank revision does to saved
// progress. Compares every live pack at a git ref (the version learners have
// studied) with the packs in public/data now.
//
//   node scripts/bankRevisions.mjs <revision-id> <base-ref> <effective-from>
//   e.g. node scripts/bankRevisions.mjs 116-1 origin/main 2027-01-01
//
// Per question id in the old pack:
//   kept    same id, identical question (text, options, answer, figure bytes)
//   moved   identical question now under another id → progress follows it
//   retired anything else (reworded, answer changed, removed) → progress is
//           archived, never attached to whatever now holds that number
// Run once per revision, before the packs ship; the output is committed, and
// the revision is appended to src/app/bankRevisions/index.ts by hand.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const [revision, baseRef, effectiveFrom] = process.argv.slice(2)
if (!revision || !baseRef || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom ?? '')) {
  console.error('usage: node scripts/bankRevisions.mjs <revision-id> <base-ref> <effective-from YYYY-MM-DD>')
  process.exit(1)
}

const git = (args) => execFileSync('git', args, { maxBuffer: 1 << 30 })
const readQuestions = (json) => {
  const parsed = JSON.parse(json)
  return Array.isArray(parsed) ? parsed : parsed.questions
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16)

function imageHashes(question, readFile) {
  const paths = [question.sourceImage, ...(question.sourceImages ?? []), ...(question.optionImages ?? [])].filter(Boolean)
  return [...new Set(paths)].map((path) => {
    const file = `public${decodeURIComponent(path.split('?')[0])}`
    const bytes = readFile(file)
    return bytes ? hash(bytes) : `missing:${file}`
  })
}

const readOld = (file) => {
  try { return git(['show', `${baseRef}:${file}`]) } catch { return null }
}
const readNew = (file) => (existsSync(file) ? readFileSync(file) : null)

function signature(question, readFile) {
  const text = [question.prompt, ...question.options].join('\u0001').replace(/\s+/g, '').normalize('NFKC')
  return `${text}#${question.kind}#${question.answers.join(',')}#${imageHashes(question, readFile).join(',')}`
}

const setsByContent = new Map()
const exams = {}
const examIds = readdirSync('public/data/exams').sort()
const oldExamIds = new Set(git(['ls-tree', '--name-only', `${baseRef}:public/data/exams`]).toString().split('\n').filter(Boolean))

for (const examId of examIds) {
  if (!oldExamIds.has(examId)) continue // new pack: nobody has progress yet
  const file = `public/data/exams/${examId}/questions.json`
  const oldQuestions = readQuestions(git(['show', `${baseRef}:${file}`]).toString())
  const newQuestions = readQuestions(readFileSync(file, 'utf8'))
  const newById = new Map(newQuestions.map((q) => [q.id, q]))
  const newSig = new Map(newQuestions.map((q) => [q.id, signature(q, readNew)]))
  const oldSig = new Map(oldQuestions.map((q) => [q.id, signature(q, readOld)]))

  // A signature that appears more than once on either side is ambiguous; never
  // move progress through it.
  const count = (values) => values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())
  const oldCount = count([...oldSig.values()])
  const newCount = count([...newSig.values()])
  const newIdBySig = new Map([...newSig].map(([id, sig]) => [sig, id]))

  const bySubject = new Map()
  const bucket = (subject) => {
    if (!bySubject.has(subject)) bySubject.set(subject, { retired: [], moved: [] })
    return bySubject.get(subject)
  }
  let kept = 0
  for (const question of oldQuestions) {
    const sig = oldSig.get(question.id)
    if (newById.has(question.id) && newSig.get(question.id) === sig) { kept += 1; continue }
    const target = oldCount.get(sig) === 1 && newCount.get(sig) === 1 ? newIdBySig.get(sig) : undefined
    if (target) bucket(question.subjectCode).moved.push([question.id, target])
    else bucket(question.subjectCode).retired.push(question.id)
  }
  const oldSigs = new Set(oldSig.values())
  const added = newQuestions.filter((q) => !oldSigs.has(newSig.get(q.id))).length

  const setIds = []
  for (const [subject, set] of [...bySubject].sort()) {
    set.retired.sort()
    set.moved.sort((a, b) => a[0].localeCompare(b[0]))
    const content = JSON.stringify(set)
    if (!setsByContent.has(content)) {
      const sameSubject = [...setsByContent.values()].filter((entry) => entry.subject === subject).length
      setsByContent.set(content, { id: sameSubject ? `${subject}-${sameSubject + 1}` : subject, subject, set })
    }
    setIds.push(setsByContent.get(content).id)
  }
  if (!setIds.length) continue
  const retired = [...bySubject.values()].reduce((n, s) => n + s.retired.length, 0)
  const moved = [...bySubject.values()].reduce((n, s) => n + s.moved.length, 0)
  exams[examId] = { sets: setIds, kept, moved, retired, added, total: newQuestions.length }
}

const sets = Object.fromEntries([...setsByContent.values()].map(({ id, set }) => [id, set]))
const header = `// Generated by scripts/bankRevisions.mjs — do not edit by hand.
// Revision ${revision}: every live pack at ${baseRef} compared with public/data.
`
const body = `import type { BankRevision } from '../../storage/bankRevision'

export const BANK_REVISION: BankRevision = ${JSON.stringify({ id: revision, effectiveFrom, sets, exams })}
`
const out = `src/app/bankRevisions/generated-${revision}.ts`
mkdirSync('src/app/bankRevisions', { recursive: true })
writeFileSync(out, header + body)

const totals = Object.values(exams).reduce((t, e) => ({ kept: t.kept + e.kept, moved: t.moved + e.moved, retired: t.retired + e.retired, added: t.added + e.added }), { kept: 0, moved: 0, retired: 0, added: 0 })
console.log(`bank revision ${revision}: ${Object.keys(exams).length} packs changed, ${Object.keys(sets).length} change sets`, totals)
console.log(`${out}: ${(header + body).length} bytes`)
