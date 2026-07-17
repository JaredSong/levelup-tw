import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseQuestionBank } from './questionParser.mjs'

function usage() {
  throw new Error(
    'Usage: node scripts/build-image-reference.mjs '
    + '<official-raw.txt> <techcerti.json> <catalog-url> <output.json> [inactive-id,...]',
  )
}

const [, , rawPath, referencePath, catalogUrl, outputPath, inactiveArg = ''] = process.argv
if (!rawPath || !referencePath || !catalogUrl || !outputPath) usage()

const inactive = new Set(inactiveArg.split(',').filter(Boolean))
const official = parseQuestionBank(await readFile(rawPath, 'utf8'))
  .filter((question) => !inactive.has(question.id))
const referenceBank = JSON.parse(await readFile(referencePath, 'utf8'))
const reference = referenceBank.questions

if (!Array.isArray(reference)) throw new Error(`${referencePath}: questions must be an array`)
if (official.length !== reference.length) {
  throw new Error(`Question count mismatch: official ${official.length}, reference ${reference.length}`)
}

const questions = {}
const answerDisagreements = []
const referenceSlug = new URL(catalogUrl).pathname.split('/').filter(Boolean).at(-1)
const imageCache = new Map()

function differenceHash(path) {
  const pixels = execFileSync('ffmpeg', [
    '-loglevel', 'error', '-i', path,
    '-vf', 'scale=9:8,format=gray', '-f', 'rawvideo', '-',
  ])
  let bits = ''
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column
      bits += pixels[offset] > pixels[offset + 1] ? '1' : '0'
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}

function jpegDimensions(bytes) {
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    const length = bytes.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  throw new Error('Reference image has no JPEG dimensions')
}

async function referenceImage(reference) {
  if (!imageCache.has(reference)) {
    imageCache.set(reference, (async () => {
      const url = `https://techcerti.bookmarks.tw/exam-images/${referenceSlug}_${reference}.jpg`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      const path = join(tmpdir(), `level-up-${referenceSlug}-${reference}.jpg`)
      await writeFile(path, bytes)
      const result = {
        ...jpegDimensions(bytes),
        differenceHash: differenceHash(path),
        referenceSha256: createHash('sha256').update(bytes).digest('hex'),
      }
      await unlink(path)
      return result
    })())
  }
  return imageCache.get(reference)
}
for (let index = 0; index < official.length; index += 1) {
  const question = official[index]
  const external = reference[index]
  if (Number(external.id) !== index + 1) {
    throw new Error(`${question.id}: expected sequential reference id ${index + 1}, got ${external.id}`)
  }

  const officialAnswer = question.answers.join('')
  const referenceAnswer = String(external.answer).split('').sort().join('')
  if (officialAnswer !== referenceAnswer) {
    answerDisagreements.push({
      questionId: question.id,
      official: officialAnswer,
      reference: referenceAnswer,
    })
  }

  const imageRefs = Array.isArray(external.imageRefs) ? external.imageRefs : []
  if (Boolean(external.hasImage) !== (imageRefs.length > 0)) {
    throw new Error(`${question.id}: inconsistent reference image metadata`)
  }
  if (imageRefs.length) {
    questions[question.id] = await Promise.all(imageRefs.map(async (reference) => {
      const token = `src='${reference}'`
      if (String(external.title).includes(token)) {
        return { reference, role: 'prompt', ...await referenceImage(reference) }
      }
      const optionIndex = external.options.findIndex((option) => String(option).includes(token))
      if (optionIndex >= 0) {
        return { reference, role: `option-${optionIndex + 1}`, ...await referenceImage(reference) }
      }
      throw new Error(`${question.id}: ${reference} has no prompt or option role`)
    }))
  }
}

await writeFile(outputPath, `${JSON.stringify({
  officialQuestionCount: official.length,
  referenceCatalog: catalogUrl,
  note: 'The official WDA PDF is authoritative. This external catalog is used only to audit image role and order.',
  answerDisagreements,
  questions,
}, null, 2)}\n`)

console.log(`${outputPath}: ${Object.keys(questions).length} image questions, ${Object.values(questions).flat().length} assets`)
if (answerDisagreements.length) {
  console.warn(`${outputPath}: ignored ${answerDisagreements.length} external answer-key disagreements`)
}
