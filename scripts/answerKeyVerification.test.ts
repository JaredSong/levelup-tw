import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Locks in the answer-key verification so it cannot rot.
//
// A wrong answer key is the one defect this app cannot survive: a learner
// memorises it and finds out on exam day. Verifying once by hand protects
// nothing — the importer changes, the source is re-issued, a correction lands.
// This re-runs the independent extraction on every test run, so any drift
// between the published bank and the official PDFs fails the build.

function verify(subjectCode: string) {
  try {
    const output = execFileSync('node', ['scripts/verifyAnswerKeys.mjs', subjectCode], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    })
    return { ok: true, output }
  } catch (error) {
    const failure = error as { stdout?: string; message: string }
    return { ok: false, output: failure.stdout ?? failure.message }
  }
}

// Skipped where poppler is unavailable, rather than failing a machine that
// simply lacks the tool.
const hasPdfToText = (() => {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

// Both lists derive from the shipped packs, never from a hand-written list:
// a new pack is gated the moment it lands in public/data/exams/, and a shipped
// subject code that verifyAnswerKeys.mjs has no official source for fails its
// "No official source mapped" error instead of silently going unverified.
const examsRoot = new URL('../public/data/exams/', import.meta.url)
const examIds = readdirSync(examsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const manifests = examIds.map((examId) => ({
  examId,
  manifest: JSON.parse(
    readFileSync(new URL(`${examId}/manifest.json`, examsRoot), 'utf8'),
  ) as { integrity?: { status?: string }; sections?: { subjectCode?: string }[] },
}))
const subjectCodes = [...new Set(
  manifests.flatMap(({ manifest }) => manifest.sections?.map((section) => section.subjectCode) ?? []),
)].filter((code): code is string => Boolean(code)).sort()

// Runs unconditionally: it reads committed JSON, so no machine has an excuse.
describe('every shipped pack records verified integrity', () => {
  it('found packs to check', () => {
    expect(examIds.length).toBeGreaterThan(0)
    expect(subjectCodes.length).toBeGreaterThan(0)
  })

  for (const { examId, manifest } of manifests) {
    it(`${examId}: integrity is fully_verified`, () => {
      expect(manifest.integrity?.status).toBe('fully_verified')
    })
  }
})

describe.skipIf(!hasPdfToText)('published answer keys match the official PDFs', () => {
  for (const subjectCode of subjectCodes) {
    it(`${subjectCode}: every key agrees with the source paper`, () => {
      const { ok, output } = verify(subjectCode)
      expect(output, output).toMatch(/DISAGREE\s+: 0/)
      expect(output, output).toMatch(/no key matched\s+: 0/)
      expect(ok, output).toBe(true)
    })
  }
})
