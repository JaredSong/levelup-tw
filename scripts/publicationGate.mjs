import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { checkPngFlatness } from './pngPixelCheck.mjs'
import { auditQuestionImages } from './questionImageQualityAudit.mjs'
import { buildDriftReport } from './wdaCatalog.mjs'

// Publication gate. `npm run build` runs this via the npm `prebuild` hook, and
// Cloudflare Pages builds with `npm run build` — so an unverified or malformed
// pack cannot reach users. This is a contract, not a report: the build fails.
//
// Deliberately deterministic — no network, no poppler — so it runs identically
// on any build machine. The full answer-key re-extraction against the official
// PDFs lives in answerKeyVerification.test.ts (it needs pdftotext); this gate
// checks that verification's recorded outcome plus the manifest invariants
// every shipped pack must hold.

export function auditManifest(manifest) {
  const failures = []
  if (manifest.integrity?.status !== 'fully_verified') {
    failures.push(`integrity.status is ${JSON.stringify(manifest.integrity?.status ?? null)} — only fully_verified packs may ship`)
  }
  if (!Number.isInteger(manifest.activeQuestionCount) || manifest.activeQuestionCount <= 0) {
    failures.push(`activeQuestionCount is ${JSON.stringify(manifest.activeQuestionCount)} — a shipped pack must have practisable questions`)
  }
  // Official banks are versioned A1, A2, … — a pack that cannot name the
  // official version it was built from cannot be checked for staleness.
  if (typeof manifest.version !== 'string' || !/^A\d+$/.test(manifest.version)) {
    failures.push(`version is ${JSON.stringify(manifest.version)} — expected the official bank revision (A\\d+)`)
  }
  if (!Array.isArray(manifest.sections) || manifest.sections.length === 0) {
    failures.push('sections is empty — the pack maps to no official subject')
  } else {
    for (const section of manifest.sections) {
      if (!/^\d{5}$/.test(section.subjectCode ?? '')) {
        failures.push(`section ${JSON.stringify(section.id ?? section.title ?? '?')} has no 5-digit subjectCode — it cannot be traced to an official paper`)
      }
    }
  }
  if (typeof manifest.sourceUrl !== 'string' || !manifest.sourceUrl.startsWith('https://')) {
    failures.push(`sourceUrl is ${JSON.stringify(manifest.sourceUrl)} — every pack must point at its official source`)
  }
  const requiredSubjects = new Set((manifest.sections ?? []).map((section) => section.subjectCode))
  const sources = Array.isArray(manifest.sources) ? manifest.sources : []
  if (sources.length === 0) {
    failures.push('sources is empty — exact official PDFs and hashes are required')
  }
  const coveredSubjects = new Set()
  for (const source of sources) {
    coveredSubjects.add(source.subjectCode)
    if (!/^A\d+$/.test(source.version ?? '')) failures.push(`source ${source.subjectCode} has invalid version`)
    if (!/^[a-f0-9]{64}$/.test(source.sha256 ?? '')) failures.push(`source ${source.subjectCode} has invalid SHA-256`)
    const expectedUrl = `https://owinform.wdasec.gov.tw/owInform/DLowFile/${source.pdfFilename}`
    if (source.officialUrl !== expectedUrl) failures.push(`source ${source.subjectCode} does not use its exact official PDF URL`)
  }
  for (const subjectCode of requiredSubjects) {
    if (!coveredSubjects.has(subjectCode)) failures.push(`sources does not cover subject ${subjectCode}`)
  }
  return failures
}

// A crop that lands entirely off its source figure doesn't fail to import —
// it imports cleanly as a valid, correctly-sized PNG that happens to be a
// single flat colour (see the three questions pulled into INACTIVE_IDS in
// build-exam-packs.mjs on 2026-07-21: 21500-03-073, 14500-03-195,
// 22000-03-186, all min=max=255 on every pixel). auditManifest can't catch
// that — it only reads manifest.json, never the image bytes — so a pack
// with a blank figure still audited as fully_verified. This closes that
// hole by decoding every PNG an *active* question ships and rejecting an
// exactly-flat one.
//
// Threshold: exact flatness (min === max across every colour-channel
// sample), not a near-blank tolerance. A real scanned or rendered figure —
// even a sparse line diagram on a white background — always carries at
// least a few pixels of anti-aliasing or scan noise, so this has no known
// false-positive path against the packs currently shipped (verified: 1523
// of 1523 question-image PNGs decode cleanly, and exactly the three known-
// bad crops flag as flat, zero others). A variance/near-blank tolerance
// would catch more theoretical defects but risks flagging a genuinely
// sparse figure — and a gate that blocks a good deploy is its own failure,
// which this design treats as the worse failure mode to guard against here.
//
// Inactive questions are skipped: they are withheld from learners by
// definition, so a blank crop behind an inactive id is not a shipping risk
// (and the three questions this check exists to catch are already inactive
// — without the skip, this check would fail the very build it's meant to
// protect).
// Many packs share the same underlying crop (common-subject questions like
// 90008/90009/90011 ship in dozens of exams), so auditing every pack
// separately would decode the same PNG bytes over and over. Cache by
// resolved path — keyed by promise, not resolved value, so the concurrent
// per-exam audits below (Promise.all in auditInstalledPacks) dedupe the
// read+decode instead of racing each other into doing it twice.
const flatnessCache = new Map()

function checkImageFlatnessCached(imagePath) {
  const key = imagePath.href
  let pending = flatnessCache.get(key)
  if (!pending) {
    pending = readFile(imagePath).then(
      (buffer) => ({ ok: true, result: checkPngFlatness(buffer) }),
      (error) => ({ ok: false, error }),
    )
    flatnessCache.set(key, pending)
  }
  return pending
}

async function auditPackImages(examId, examsRoot) {
  const publicRoot = new URL('../public/', import.meta.url)
  let questions
  try {
    questions = JSON.parse(await readFile(new URL(`${examId}/questions.json`, examsRoot), 'utf8'))
  } catch (error) {
    return [`questions.json unreadable: ${error.message}`]
  }
  if (!Array.isArray(questions)) return [`questions.json is not an array`]

  const failures = []
  for (const question of questions) {
    if (question.active === false) continue
    const images = question.sourceImages?.length
      ? question.sourceImages
      : question.sourceImage ? [question.sourceImage] : []
    for (const image of images) {
      // Only PNG is decoded here — see pngPixelCheck.mjs header for why
      // JPEG (one file, repo-wide) is out of scope for this check.
      if (!image || !image.toLowerCase().endsWith('.png')) continue
      const imagePath = new URL(`.${decodeURIComponent(image)}`, publicRoot)
      const outcome = await checkImageFlatnessCached(imagePath)
      if (!outcome.ok) {
        failures.push(`${question.id}: image referenced but unreadable — ${image} (${outcome.error.code ?? outcome.error.message})`)
        continue
      }
      const result = outcome.result
      if (result.supported && result.flat) {
        failures.push(`${question.id}: ${image} is a single flat colour (value ${result.min} on every pixel) — the crop produced no figure`)
      }
    }
  }
  return failures
}

export async function auditInstalledPacks(root) {
  const directories = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  return Promise.all(directories.map(async (examId) => {
    let manifest
    try {
      manifest = JSON.parse(await readFile(new URL(`${examId}/manifest.json`, root), 'utf8'))
    } catch (error) {
      return { examId, manifest: null, failures: [`manifest.json unreadable: ${error.message}`] }
    }
    const imageFailures = await auditPackImages(examId, root)
    return { examId, manifest, failures: [...auditManifest(manifest), ...imageFailures] }
  }))
}

async function main() {
  const root = new URL('../public/data/exams/', import.meta.url)
  const results = await auditInstalledPacks(root)
  const failing = results.filter((result) => result.failures.length > 0)
  for (const { examId, failures } of results) {
    if (failures.length === 0) {
      console.log(`ok      ${examId}`)
    } else {
      for (const failure of failures) console.error(`BLOCKED ${examId}: ${failure}`)
    }
  }
  const catalog = JSON.parse(await readFile(new URL('../source/wda-catalog.json', import.meta.url), 'utf8'))
  const documents = new Map(catalog.documents.map((document) => [`${document.subjectCode}:${document.levelCode}`, document]))
  const levelCodes = new Map([['甲級', '1'], ['乙級', '2'], ['丙級', '3'], ['單一級', '4']])
  const manifests = results.flatMap((result) => result.manifest ? [result.manifest] : [])
  const examLevels = new Map(manifests.map((manifest) => [manifest.examId, levelCodes.get(manifest.level)]))
  const drift = buildDriftReport(manifests, documents, examLevels)
  for (const mismatch of drift.mismatches) {
    console.error(`BLOCKED ${mismatch.examId}: ${mismatch.subjectCode} ${mismatch.reason} differs from committed WDA catalog`)
  }
  for (const missing of drift.missing) {
    console.error(`BLOCKED ${missing.examId}: ${missing.subjectCode} is missing from committed WDA catalog`)
  }
  const imageQuality = await auditQuestionImages()
  for (const failure of imageQuality.failures) {
    console.error(`BLOCKED image-quality: ${failure}`)
  }
  console.log(`Publication gate: ${results.length - failing.length}/${results.length} packs publishable`)
  console.log(`Image quality gate: ${imageQuality.activeImageCount} active PNGs, ${imageQuality.failures.length} new unreviewed crop risks`)
  if (failing.length > 0 || !drift.ok || imageQuality.failures.length > 0) {
    console.error('Build refused: fix or unship the packs above. A pack that ships with wrong keys is worse than a pack that does not ship.')
    process.exit(1)
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) main()
