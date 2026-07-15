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
  // Every subject in web-design-b, the pack that claims fully_verified.
  for (const subjectCode of ['17300', '90006', '90007', '90008', '90009', '90011']) {
    it(`${subjectCode}: every key agrees with the source paper`, () => {
      const { ok, output } = verify(subjectCode)
      expect(output, output).toMatch(/DISAGREE\s+: 0/)
      expect(output, output).toMatch(/no key matched\s+: 0/)
      expect(ok, output).toBe(true)
    })
  }

  it('only claims fully_verified for a pack whose keys are actually all checked', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../public/data/exams/web-design-b/manifest.json', import.meta.url), 'utf8'),
    ) as { integrity?: { status?: string } }
    // If someone downgrades the claim, that is fine — but a fully_verified claim
    // must be backed by the checks above, which run in this same file.
    expect(manifest.integrity?.status).toBe('fully_verified')
  })
})
