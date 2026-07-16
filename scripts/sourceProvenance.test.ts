import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface ManifestSource {
  subjectCode: string
  version: string
  pdfFilename: string
  localFilename: string
  officialUrl: string
  sha256: string
}

interface Manifest {
  examId: string
  sections: Array<{ subjectCode: string }>
  sources?: ManifestSource[]
}

const manifestRoot = new URL('../public/data/exams/', import.meta.url)

function manifests(): Manifest[] {
  return readdirSync(manifestRoot)
    .map((examId) => JSON.parse(readFileSync(new URL(`${examId}/manifest.json`, manifestRoot), 'utf8')) as Manifest)
}

function sha256(path: URL): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

describe('published source provenance', () => {
  it('covers every subject in every installed pack with an exact official PDF', () => {
    for (const manifest of manifests()) {
      const subjectCodes = new Set(manifest.sections.map((section) => section.subjectCode))
      const sources = manifest.sources ?? []

      expect(
        new Set(sources.map((source) => source.subjectCode)),
        `${manifest.examId} must identify every source bank`,
      ).toEqual(subjectCodes)

      for (const source of sources) {
        expect(source.version, `${manifest.examId}/${source.subjectCode} version`).toMatch(/^A\d+$/)
        expect(source.pdfFilename, `${manifest.examId}/${source.subjectCode} filename`).toMatch(/\.pdf$/i)
        expect(source.officialUrl, `${manifest.examId}/${source.subjectCode} official URL`).toBe(
          `https://owinform.wdasec.gov.tw/owInform/DLowFile/${source.pdfFilename}`,
        )
        expect(source.sha256, `${manifest.examId}/${source.subjectCode} SHA-256`).toMatch(/^[a-f0-9]{64}$/)
      }
    }
  })

  it('records hashes that match the exact local PDFs used during import', () => {
    for (const manifest of manifests()) {
      for (const source of manifest.sources ?? []) {
        const localPdf = new URL(`../source/${source.localFilename}`, import.meta.url)
        expect(existsSync(localPdf), `${source.localFilename} must be retained as import evidence`).toBe(true)
        expect(source.sha256, `${manifest.examId}/${source.subjectCode} hash`).toBe(sha256(localPdf))
      }
    }
  })
})
