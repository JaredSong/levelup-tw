import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { auditInstalledPacks, auditManifest } from './publicationGate.mjs'

const examsRoot = new URL('../public/data/exams/', import.meta.url)

const publishable = {
  examId: 'sample-c',
  version: 'A13',
  sourceUrl: 'https://techbank.wdasec.gov.tw/',
  sources: [
    {
      subjectCode: '17300',
      version: 'A13',
      pdfFilename: '173002A13.pdf',
      officialUrl: 'https://owinform.wdasec.gov.tw/owInform/DLowFile/173002A13.pdf',
      sha256: 'a'.repeat(64),
    },
    {
      subjectCode: '90006',
      version: 'A18',
      pdfFilename: '900060A18.pdf',
      officialUrl: 'https://owinform.wdasec.gov.tw/owInform/DLowFile/900060A18.pdf',
      sha256: 'b'.repeat(64),
    },
  ],
  activeQuestionCount: 1200,
  sections: [
    { id: 'occupation-1', subjectCode: '17300' },
    { id: 'common-1', subjectCode: '90006' },
  ],
  integrity: { status: 'fully_verified' },
}

describe('publication gate', () => {
  it('accepts a publishable manifest', () => {
    expect(auditManifest(publishable)).toEqual([])
  })

  // Each broken variant must fail on its own: a gate that cannot be watched
  // failing proves nothing.
  it('blocks a pack whose keys were never verified', () => {
    const failures = auditManifest({ ...publishable, integrity: { status: 'unchecked' } })
    expect(failures.some((failure) => failure.includes('fully_verified'))).toBe(true)
  })

  it('blocks a pack missing integrity entirely', () => {
    expect(auditManifest({ ...publishable, integrity: undefined })).not.toEqual([])
  })

  it('blocks a pack that cannot name its official revision', () => {
    expect(auditManifest({ ...publishable, version: '2018' })).not.toEqual([])
    expect(auditManifest({ ...publishable, version: undefined })).not.toEqual([])
  })

  it('blocks a pack with no practisable questions', () => {
    expect(auditManifest({ ...publishable, activeQuestionCount: 0 })).not.toEqual([])
  })

  it('blocks a section that cannot be traced to an official paper', () => {
    const failures = auditManifest({
      ...publishable,
      sections: [{ id: 'occupation-1', subjectCode: 'A13' }],
    })
    expect(failures.some((failure) => failure.includes('subjectCode'))).toBe(true)
  })

  it('blocks a pack without an official source URL', () => {
    expect(auditManifest({ ...publishable, sourceUrl: 'techbank.wdasec.gov.tw' })).not.toEqual([])
  })

  it('blocks a pack without exact PDF provenance for every subject', () => {
    const failures = auditManifest({ ...publishable, sources: undefined })
    expect(failures.some((failure) => failure.includes('sources'))).toBe(true)

    const incomplete = auditManifest({ ...publishable, sources: publishable.sources.slice(0, 1) })
    expect(incomplete.some((failure) => failure.includes('90006'))).toBe(true)
  })

  it('every installed pack is currently publishable', async () => {
    // Now decodes every active question's PNG crops to catch a blank one
    // (see auditPackImages in publicationGate.mjs) — ~1500 unique images,
    // cached across packs but still real I/O + zlib work. That runs ~4.3s
    // locally; give it real headroom above vitest's 5000ms default instead
    // of living on a margin that flakes on a slower CI machine.
    const results = await auditInstalledPacks(examsRoot)
    expect(results.length).toBeGreaterThan(0)
    const failing = results.filter((result) => result.failures.length > 0)
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
  }, 20_000)

  it('stays wired into the build', async () => {
    // The gate only blocks deploys while `npm run build` (what Cloudflare
    // Pages runs) triggers it via the prebuild hook. Unwiring it must fail
    // loudly here, not silently reopen the door.
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts?: Record<string, string> }
    expect(packageJson.scripts?.prebuild).toContain('scripts/publicationGate.mjs')
  })
})
