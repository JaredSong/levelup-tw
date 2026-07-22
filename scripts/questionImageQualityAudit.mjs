import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { analyzePngContent } from './pngPixelCheck.mjs'

const DEFAULT_BASELINE = new URL('../source/image-quality-baseline.json', import.meta.url)
const PUBLIC_ROOT = new URL('../public/', import.meta.url)
const EXAMS_ROOT = new URL('../public/data/exams/', import.meta.url)

function imageUrlFromPublicPath(image) {
  return new URL(`.${decodeURIComponent(image)}`, PUBLIC_ROOT)
}

function minMargin(bbox) {
  return Math.min(bbox.margins.left, bbox.margins.top, bbox.margins.right, bbox.margins.bottom)
}

function classifyImage(image, result) {
  const risks = []
  if (!result.supported) return risks
  if (result.flat) risks.push('flat')
  if (!result.bbox) risks.push('empty-content')
  if (!result.bbox) return risks

  const area = result.width * result.height
  const bboxArea = result.bbox.width * result.bbox.height
  const bboxRatio = bboxArea / area
  const margin = minMargin(result.bbox)
  const isSmall = result.width <= 240 && result.height <= 240
  const isWideStrip = result.width >= 500 && result.height <= 180

  if (isSmall && margin <= 1) risks.push('small-edge-touch')
  if (isWideStrip && bboxRatio < 0.18) risks.push('wide-sparse-crop')
  if (area >= 40_000 && bboxRatio < 0.02) risks.push('large-sparse-crop')

  return risks
}

async function collectActiveImages() {
  const exams = (await readdir(EXAMS_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const images = new Map()
  for (const examId of exams) {
    const questions = JSON.parse(await readFile(new URL(`${examId}/questions.json`, EXAMS_ROOT), 'utf8'))
    for (const question of questions) {
      if (question.active === false) continue
      const sources = question.sourceImages?.length
        ? question.sourceImages
        : question.sourceImage ? [question.sourceImage] : []
      for (const source of sources) {
        if (!source || !source.toLowerCase().endsWith('.png')) continue
        const entry = images.get(source) ?? { image: source, refs: [] }
        entry.refs.push(`${examId}:${question.id}`)
        images.set(source, entry)
      }
    }
  }
  return [...images.values()].sort((left, right) => left.image.localeCompare(right.image))
}

async function readBaseline(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return { knownRisks: {} }
    throw error
  }
}

function buildBaseline(audit) {
  const knownRisks = {}
  for (const item of audit.items) {
    for (const risk of item.risks) {
      if (risk === 'flat' || risk === 'empty-content') continue
      knownRisks[risk] ??= []
      knownRisks[risk].push(item.image)
    }
  }
  for (const images of Object.values(knownRisks)) images.sort()
  return {
    note: 'Reviewed image-quality risk baseline. New entries mean a crop needs manual PDF/Techcerti review before shipping.',
    rules: {
      smallEdgeTouch: 'PNG content touches an edge in an image no larger than 240x240.',
      wideSparseCrop: 'Wide strip image has a very small non-white bounding box.',
      largeSparseCrop: 'Large image has an extremely small non-white bounding box.',
    },
    knownRisks,
  }
}

export async function auditQuestionImages({ baselinePath = DEFAULT_BASELINE } = {}) {
  const activeImages = await collectActiveImages()
  const items = []
  const failures = []

  for (const entry of activeImages) {
    const imagePath = imageUrlFromPublicPath(entry.image)
    let buffer
    try {
      buffer = await readFile(imagePath)
    } catch (error) {
      failures.push(`${entry.image}: missing or unreadable (${error.code ?? error.message})`)
      continue
    }
    const result = analyzePngContent(buffer)
    const risks = classifyImage(entry.image, result)
    items.push({ ...entry, result, risks })
  }

  const baseline = await readBaseline(baselinePath)
  const knownRisks = baseline.knownRisks ?? {}
  const knownByRisk = new Map(
    Object.entries(knownRisks).map(([risk, images]) => [risk, new Set(images)]),
  )
  for (const item of items) {
    for (const risk of item.risks) {
      if (risk === 'flat' || risk === 'empty-content') {
        failures.push(`${item.image}: ${risk}`)
        continue
      }
      if (!knownByRisk.get(risk)?.has(item.image)) {
        failures.push(`${item.image}: new ${risk} risk (${item.refs.slice(0, 3).join(', ')})`)
      }
    }
  }

  const counts = items.reduce((acc, item) => {
    for (const risk of item.risks) acc[risk] = (acc[risk] ?? 0) + 1
    return acc
  }, {})

  return { activeImageCount: activeImages.length, items, counts, failures }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const audit = await auditQuestionImages()
  if (args.has('--write-baseline')) {
    await writeFile(DEFAULT_BASELINE, `${JSON.stringify(buildBaseline(audit), null, 2)}\n`)
    console.log(`Image quality baseline written: ${fileURLToPath(DEFAULT_BASELINE)}`)
  }

  console.log(`Question image audit: ${audit.activeImageCount} active PNGs`)
  for (const [risk, count] of Object.entries(audit.counts).sort()) {
    console.log(`risk ${risk}: ${count}`)
  }
  if (audit.failures.length > 0) {
    for (const failure of audit.failures.slice(0, 80)) console.error(`BLOCKED image-quality: ${failure}`)
    if (audit.failures.length > 80) console.error(`BLOCKED image-quality: ... ${audit.failures.length - 80} more`)
    process.exit(1)
  }
  console.log('Image quality audit: no new unreviewed crop risks')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) main()
