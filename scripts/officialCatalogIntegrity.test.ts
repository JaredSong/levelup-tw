import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDriftReport } from './wdaCatalog.mjs'

const LEVEL_CODES = new Map([
  ['甲級', '1'],
  ['乙級', '2'],
  ['丙級', '3'],
  ['單一級', '4'],
])

function installedManifests() {
  const root = new URL('../public/data/exams/', import.meta.url)
  return readdirSync(root).map((examId) => (
    JSON.parse(readFileSync(new URL(`${examId}/manifest.json`, root), 'utf8'))
  ))
}

describe('committed official WDA catalog', () => {
  it('matches every installed source filename and exact PDF hash', () => {
    const catalog = JSON.parse(readFileSync(new URL('../source/wda-catalog.json', import.meta.url), 'utf8'))
    const manifests = installedManifests()
    const documents = new Map(catalog.documents.map((document: { subjectCode: string; levelCode: string }) => (
      [`${document.subjectCode}:${document.levelCode}`, document]
    )))
    const examLevels = new Map(manifests.map((manifest) => [manifest.examId, LEVEL_CODES.get(manifest.level)]))
    const drift = buildDriftReport(manifests, documents, examLevels)

    expect(catalog.authority).toBe('official-primary')
    expect(catalog.errors).toEqual([])
    expect(drift).toEqual({ ok: true, mismatches: [], missing: [] })
  })
})
