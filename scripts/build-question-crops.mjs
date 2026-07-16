import { execFileSync } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
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
  { code: '00700', source: '007002A15', cropPrefix: '007002' },
  { code: '00700', source: '007003A13', cropPrefix: '007003', extraFigures: ['00700-13-005'] },
  { code: '15100', source: '151004A14' },
  { code: '12600', source: '126002A12' },
  { code: '20600', source: '206003A13' },
]

const SCALE = 2 // 144 DPI: two pixels per PDF point.
const missingOnly = process.argv.includes('--missing')

function pagesFromBbox(html) {
  return [...html.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((match) => {
    const markers = [...match[3].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)"[^>]*>(\d+)\.<\/word>/g)]
      .map((word) => ({ x: Number(word[1]), y: Number(word[2]), number: Number(word[3]) }))
      .filter((marker) => marker.x >= 45 && marker.x <= 105)
      .sort((a, b) => a.y - b.y)
    return { width: Number(match[1]), height: Number(match[2]), markers }
  })
}

async function buildBank({ source, cropPrefix, extraFigures = [] }) {
  const pdfPath = fileURLToPath(new URL(`../source/${source}.pdf`, import.meta.url))
  const raw = await readFile(new URL(`../source/${source}-raw.txt`, import.meta.url), 'utf8')
  const questions = parseQuestionBank(raw)
  const figures = questions.filter((question) => question.hasFigure
    || EXTRA_FIGURES.has(question.id)
    || extraFigures.includes(question.id)
    || / {2,}/.test(`${question.prompt}${question.options.join('')}`))
  const work = join(tmpdir(), `level-up-crops-${source}`)
  await mkdir(work, { recursive: true })
  const bboxPath = join(work, 'bbox.html')
  execFileSync('pdftotext', ['-bbox-layout', pdfPath, bboxPath])
  const pages = pagesFromBbox(await readFile(bboxPath, 'utf8'))
  const rendered = new Map()
  const outputRoot = new URL('../public/question-images/', import.meta.url)
  await mkdir(outputRoot, { recursive: true })

  for (const question of figures) {
    const output = fileURLToPath(new URL(`${cropPrefix ? `${cropPrefix}-` : ''}${question.id}.png`, outputRoot))
    if (missingOnly) {
      try {
        await access(output)
        continue
      } catch {
        // Generate the missing crop below.
      }
    }
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

    await writeFile(output, await readFile(renderedPage))
    execFileSync('sips', [
      '-c', String(Math.ceil((bottom - top) * SCALE)), String(Math.floor((page.width - 115) * SCALE)),
      '--cropOffset', String(Math.floor(top * SCALE)), String(105 * SCALE),
      output,
    ], { stdio: 'ignore' })
  }
  return figures.length
}

let total = 0
const requestedSources = new Set(process.argv.slice(2).filter((arg) => arg !== '--missing'))
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
