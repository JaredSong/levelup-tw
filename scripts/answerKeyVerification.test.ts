import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

describe.skipIf(!hasPdfToText)('published answer keys match the official PDFs', () => {
  // Every official subject currently shipped by the app. This is deliberately
  // broader than any one exam pack because shared banks are reused.
  for (const subjectCode of [
    '06000',
    '06700',
    '07602',
    '07700',
    '10000',
    '11800',
    '14900',
    '15400',
    '17800',
    '17300',
    '19500',
    '22200',
    '02000',
    '90006',
    '90007',
    '90008',
    '90009',
    '90010',
    '90011',
    '90012',
  ]) {
    it(`${subjectCode}: every key agrees with the source paper`, () => {
      const { ok, output } = verify(subjectCode)
      expect(output, output).toMatch(/DISAGREE\s+: 0/)
      expect(output, output).toMatch(/no key matched\s+: 0/)
      expect(ok, output).toBe(true)
    })
  }

  it('keeps verification metadata internal for every generated pack', () => {
    for (const examId of [
      'web-design-b',
      'man-haircut-c',
      'women-hairdressing-c',
      'employment-service-b',
      'computer-software-application-c',
      'chinese-cooking-meat-c',
      'baking-food-c',
      'car-repair-c',
      'beauty-c',
      'accounting-c',
      'childcare-single',
      'care-service-single',
      'occupational-safety-health-management-b',
    ]) {
      const manifest = JSON.parse(
        readFileSync(new URL(`../public/data/exams/${examId}/manifest.json`, import.meta.url), 'utf8'),
      ) as { integrity?: { status?: string } }
      expect(manifest.integrity?.status).toBe('fully_verified')
    }
  })
})
