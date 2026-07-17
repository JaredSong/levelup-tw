import { execFileSync } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseQuestionBank } from './questionParser.mjs'

const EXTRA_FIGURES = new Set([
  '12600-01-008',
  '12600-01-011',
  '12600-01-012',
  '12600-01-013',
  '12600-01-014',
  '12600-01-018',
  '12600-01-031',
])

const BANKS = [
  { code: '11800', source: '118002A15', cropPrefix: '118002' },
  {
    code: '00700',
    source: '007002A15',
    cropPrefix: '007002',
    splitImageOptions: true,
    includeLeftFigures: true,
    extraFigures: ['00700-11-063', '00700-12-043'],
    excludedFigures: ['00700-06-018'],
    mixedFigureOptions: ['00700-09-007'],
    figureRects: {
      '00700-09-007': { x: 110, y: 458, width: 175, height: 120 },
      '00700-11-063': { x: 120, y: 708, width: 420, height: 87 },
      '00700-12-043': { x: 125, y: 570, width: 230, height: 155 },
    },
  },
  { code: '00700', source: '007003A13', cropPrefix: '007003', extraFigures: ['00700-13-005'] },
  { code: '15100', source: '151004A14' },
  { code: '12600', source: '126002A12' },
  { code: '20600', source: '206003A13' },
  { code: '02800', source: '028003A11', cropPrefix: '028003' },
  { code: '12000', source: '120003A12', cropPrefix: '120003' },
  { code: '01600', source: '016003A12', cropPrefix: '016003' },
]

const SCALE = 2 // 144 DPI: two pixels per PDF point.
const missingOnly = process.argv.includes('--missing')
const figuresOnly = process.argv.includes('--figures-only')

function pagesFromBbox(html) {
  return [...html.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((match) => {
    const words = [...match[3].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
      .map((word) => ({
        x: Number(word[1]),
        y: Number(word[2]),
        xMax: Number(word[3]),
        yMax: Number(word[4]),
        text: word[5],
      }))
    const markers = words
      .filter((word) => /^\d+\.$/.test(word.text) && word.x >= 45 && word.x <= 105)
      .map((word) => ({ ...word, number: Number(word.text.slice(0, -1)) }))
      .filter((marker) => marker.x >= 45 && marker.x <= 105)
      .sort((a, b) => a.y - b.y)
    return { width: Number(match[1]), height: Number(match[2]), markers, words }
  })
}

function clampRect(rect, page) {
  const x = Math.max(0, rect.x)
  const y = Math.max(0, rect.y)
  const right = Math.min(page.width, rect.x + rect.width)
  const bottom = Math.min(page.height - 24, rect.y + rect.height)
  return { x, y, width: right - x, height: bottom - y }
}

function cropImage(renderedPage, output, page, rect) {
  const crop = clampRect(rect, page)
  if (crop.width <= 3 || crop.height <= 3) {
    throw new Error(`${output}: invalid crop ${JSON.stringify(crop)}`)
  }
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-i', renderedPage,
    '-vf', `crop=${Math.floor(crop.width * SCALE)}:${Math.ceil(crop.height * SCALE)}:${Math.floor(crop.x * SCALE)}:${Math.floor(crop.y * SCALE)}`,
    '-frames:v', '1', output,
  ], { stdio: 'ignore' })
}

function wordsInBand(page, top, bottom) {
  return page.words.filter((word) => word.y >= top && word.y < bottom && word.x >= 105)
}

function optionCropRects(page, top, bottom) {
  const words = wordsInBand(page, top, bottom)
  const markers = words
    .filter((word) => /^[①②③④]/.test(word.text))
    .map((word) => ({ ...word, text: word.text[0], xMax: Math.min(word.xMax, word.x + 12) }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  if (markers.length !== 4) return null

  return markers.map((marker, index) => {
    const next = markers[index + 1]
    const sameLineNext = next && Math.abs(next.y - marker.y) < 3 ? next : null
    const punctuation = words.find((word) => word.text === '。'
      && Math.abs(word.y - marker.y) < 3
      && word.x > marker.x)
    let x = marker.xMax + 1
    let y = marker.y - 6
    let right = sameLineNext?.x ?? punctuation?.x ?? page.width - 55

    // The option number can sit at the end of the prompt while its symbol wraps
    // to the next line. In that layout, the following option marker is the
    // right boundary of option 1's symbol.
    if (next && next.y > marker.y + 3 && right - x < 32) {
      x = 110
      y = next.y - 6
      right = next.x - 2
    }

    return {
      x,
      y,
      width: Math.max(8, right - x - 2),
      height: Math.max(18, Math.min(bottom, y + 40) - y),
    }
  })
}

function figureCropRect(question, page, top, bottom, { ignoreInlineGap = false } = {}) {
  if (question.prompt.includes('左圖')) {
    return { x: 105, y: top - 3, width: 32, height: Math.min(38, bottom - top + 2) }
  }

  const words = wordsInBand(page, top, bottom).sort((a, b) => a.y - b.y || a.x - b.x)
  const horizontalGaps = []
  for (let index = 0; index < words.length - 1; index += 1) {
    const current = words[index]
    const next = words[index + 1]
    if (Math.abs(current.y - next.y) >= 3) continue
    const gap = next.x - current.xMax
    if (gap >= 18) horizontalGaps.push({ gap, current, next })
  }
  if (!ignoreInlineGap && / {2,}/.test(`${question.prompt}${question.options.join('')}`) && horizontalGaps.length) {
    const largest = horizontalGaps.sort((a, b) => b.gap - a.gap)[0]
    return {
      x: largest.current.xMax + 1,
      y: largest.current.y - 10,
      width: largest.gap - 2,
      height: 34,
    }
  }

  const lines = [...words.reduce((result, word) => {
    const key = Math.round(word.y * 10) / 10
    const line = result.get(key) ?? { y: word.y, yMax: word.yMax }
    line.y = Math.min(line.y, word.y)
    line.yMax = Math.max(line.yMax, word.yMax)
    result.set(key, line)
    return result
  }, new Map()).values()].sort((a, b) => a.y - b.y)
  const verticalGaps = [
    ...(lines[0] && lines[0].y - top >= 10 ? [{ y: top, next: lines[0].y, gap: lines[0].y - top }] : []),
    ...lines.slice(0, -1).map((line, index) => ({
      y: line.yMax,
      next: lines[index + 1].y,
      gap: lines[index + 1].y - line.yMax,
    })),
    ...(lines.at(-1) && bottom - lines.at(-1).yMax >= 10
      ? [{ y: lines.at(-1).yMax, next: bottom, gap: bottom - lines.at(-1).yMax }]
      : []),
  ]
  const largestVertical = verticalGaps.sort((a, b) => b.gap - a.gap)[0]
  if (largestVertical?.gap >= 10) {
    return {
      x: 105,
      y: largestVertical.y + 1,
      width: page.width - 160,
      height: largestVertical.gap - 2,
    }
  }

  return { x: 105, y: top, width: page.width - 160, height: bottom - top }
}

async function buildBank({
  source,
  cropPrefix,
  extraFigures = [],
  excludedFigures = [],
  mixedFigureOptions = [],
  figureRects = {},
  splitImageOptions = false,
  includeLeftFigures = false,
}) {
  const pdfPath = fileURLToPath(new URL(`../source/${source}.pdf`, import.meta.url))
  const raw = await readFile(new URL(`../source/${source}-raw.txt`, import.meta.url), 'utf8')
  const questions = parseQuestionBank(raw)
  const figures = questions.filter((question) => !excludedFigures.includes(question.id) && (
    question.hasFigure
      || EXTRA_FIGURES.has(question.id)
      || extraFigures.includes(question.id)
      || (includeLeftFigures && question.prompt.includes('左圖'))
      || / {2,}/.test(`${question.prompt}${question.options.join('')}`)
  ))
  const work = join(tmpdir(), `level-up-crops-${source}`)
  await mkdir(work, { recursive: true })
  const bboxPath = join(work, 'bbox.html')
  execFileSync('pdftotext', ['-bbox-layout', pdfPath, bboxPath])
  const pages = pagesFromBbox(await readFile(bboxPath, 'utf8'))
  const rendered = new Map()
  const outputRoot = new URL('../public/question-images/', import.meta.url)
  await mkdir(outputRoot, { recursive: true })

  for (const question of figures) {
    const outputName = `${cropPrefix ? `${cropPrefix}-` : ''}${question.id}`
    const output = fileURLToPath(new URL(`${outputName}.png`, outputRoot))
    const pageIndex = question.sourcePage - 1
    const page = pages[pageIndex]
    if (!page) throw new Error(`${question.id}: source page ${question.sourcePage} missing`)
    const markerIndex = page.markers.findIndex((marker) => marker.number === question.number)
    if (markerIndex < 0) throw new Error(`${question.id}: question marker missing on page ${question.sourcePage}`)
    const marker = page.markers[markerIndex]
    const next = page.markers[markerIndex + 1]
    const top = Math.max(0, marker.y - 5)
    const bottom = Math.min(page.height - 24, next ? next.y - 4 : page.height - 30)
    if (bottom <= top) throw new Error(`${question.id}: invalid crop bounds ${top}-${bottom}`)

    let renderedPage = rendered.get(question.sourcePage)
    if (!renderedPage) {
      const prefix = join(work, `page-${question.sourcePage}`)
      execFileSync('pdftoppm', [
        '-f', String(question.sourcePage), '-l', String(question.sourcePage),
        '-r', '144', '-png', '-singlefile',
        pdfPath, prefix,
      ], { stdio: 'ignore' })
      renderedPage = `${prefix}.png`
      rendered.set(question.sourcePage, renderedPage)
    }

    const imageOptions = splitImageOptions && question.options.some((option) => option.includes('圖示選項'))
    const hasQuestionFigure = mixedFigureOptions.includes(question.id)
    if (figuresOnly && imageOptions && !hasQuestionFigure) continue
    const optionRects = imageOptions ? optionCropRects(page, top, bottom) : null
    const optionOutputs = optionRects
      ? optionRects.map((_, index) => fileURLToPath(new URL(`${outputName}-${index + 1}.png`, outputRoot)))
      : []
    const outputs = optionRects
      ? [...(hasQuestionFigure ? [output] : []), ...optionOutputs]
      : [output]
    if (missingOnly) {
      const present = await Promise.all(outputs.map(async (candidate) => {
        try {
          await access(candidate)
          return true
        } catch {
          return false
        }
      }))
      if (present.every(Boolean)) continue
    }
    if (imageOptions && !optionRects) {
      throw new Error(`${question.id}: expected four graphical option markers on page ${question.sourcePage}`)
    }
    if (optionRects) {
      if (hasQuestionFigure) {
        cropImage(renderedPage, output, page, figureRects[question.id]
          ?? figureCropRect(question, page, top, bottom, { ignoreInlineGap: true }))
      }
      if (!figuresOnly) {
        optionRects.forEach((rect, index) => cropImage(renderedPage, optionOutputs[index], page, rect))
      }
    } else {
      cropImage(renderedPage, output, page, figureRects[question.id]
        ?? figureCropRect(question, page, top, bottom))
    }
  }
  return figures.length
}

let total = 0
const requestedSources = new Set(process.argv.slice(2).filter((arg) => !['--missing', '--figures-only'].includes(arg)))
const selectedBanks = requestedSources.size ? BANKS.filter((bank) => requestedSources.has(bank.source)) : BANKS
if (requestedSources.size && selectedBanks.length !== requestedSources.size) {
  const known = BANKS.map((bank) => bank.source).join(', ')
  throw new Error(`Unknown crop source. Known sources: ${known}`)
}
for (const bank of selectedBanks) {
  const count = await buildBank(bank)
  total += count
  console.log(`${bank.source}: ${count} question crops`)
}
console.log(`Question crops: ${total} generated from ${selectedBanks.length} official PDFs`)
