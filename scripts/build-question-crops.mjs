import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
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
  {
    code: '11800',
    source: '118002A15',
    cropPrefix: '118002',
    figureRects: {
      // The prompt starts at the bottom of page 36, but its Excel table is on
      // the top of the next page.
      '11800-02-096': { page: 37, x: 132, y: 62, width: 274, height: 112 },
    },
  },
  {
    code: '00700',
    source: '007002A15',
    cropPrefix: '007002',
    splitImageOptions: true,
    includeLeftFigures: true,
    extraFigures: ['00700-11-063', '00700-12-043'],
    excludedFigures: ['00700-06-018', '00700-11-086'],
    mixedFigureOptions: ['00700-09-007'],
    figureRects: {
      '00700-09-007': { x: 110, y: 458, width: 175, height: 120 },
      '00700-11-063': { x: 120, y: 708, width: 420, height: 87 },
      '00700-12-043': { x: 125, y: 570, width: 230, height: 155 },
    },
  },
  {
    code: '00700',
    source: '007003A13',
    cropPrefix: '007003',
    // Same fix as 007002 above: the marker-only line for these image-option
    // questions was cropped whole (one combined strip with all four symbols
    // in it), so the frontend could not slice out an image per option and
    // fell back to the literal "圖示選項 N" placeholder text.
    splitImageOptions: true,
    extraFigures: ['00700-13-005'],
    // Option 1's marker sits at the end of its prompt line with blank room
    // after it — nothing is actually there; the option's symbol wraps onto
    // the start of the next line, before option 2. The auto heuristic only
    // catches a wrap when the leftover room is too narrow to hold anything,
    // so blank-but-still-wrapped room like this needs an explicit rect.
    optionRectOverrides: {
      '00700-01-006': [{ x: 110, y: 404, width: 40, height: 40 }, null, null, null],
    },
  },
  { code: '15100', source: '151004A14', splitImageOptions: true },
  {
    code: '12600',
    source: '126002A12',
    splitImageOptions: true,
    // These three ask for a projection (正視圖/右側視圖/右側視圖) of a shape
    // drawn above the option line. Keep that reference shape as a base image
    // alongside the four option crops, same as 00700-09-007. The automatic
    // "largest gap" heuristic that finds the base figure for a bare 4-option
    // line misreads this pack's layout (grabs the wrapped option 4 image
    // instead of the isometric shape for 044, or clips the isometric shape's
    // bottom edge for 043/045), so all three get an explicit rect measured
    // from the rendered PDF page.
    mixedFigureOptions: ['12600-01-043', '12600-01-044', '12600-01-045'],
    figureRects: {
      '12600-01-043': { x: 98, y: 571, width: 84, height: 72 },
      '12600-01-044': { x: 95, y: 680, width: 88, height: 62 },
      '12600-01-045': { x: 98, y: 39, width: 49, height: 50 },
    },
    // 043 and 044 each run their four option markers along one line, but
    // option 4's symbol has no room left before the page edge and wraps onto
    // a blank row of its own, well below the marker — the auto heuristic has
    // no marker to anchor that row on and produces a sliver crop. Measured
    // directly from the rendered page. 045's four options all fit inline
    // (period follows marker 4 on the same line), so it needs no override.
    optionRectOverrides: {
      '12600-01-043': [null, null, null, { x: 100, y: 648, width: 72, height: 31 }],
      '12600-01-044': [null, null, null, { x: 94, y: 743, width: 53, height: 35 }],
      // Same wrap, no base figure involved here — just option 4 dropping to
      // its own line with a period two lines below the marker row.
      '12600-01-060': [null, null, null, { x: 110, y: 258, width: 62, height: 40 }],
    },
  },
  { code: '20600', source: '206003A13', splitImageOptions: true },
  {
    code: '02800',
    source: '028003A11',
    cropPrefix: '028003',
    embeddedImages: true,
    // These embedded objects are formula glyphs. Their choices are restored as
    // text by build-exam-packs rather than shown as detached image fragments.
    excludedEmbeddedQuestions: [
      '02800-08-006', '02800-08-012', '02800-08-013', '02800-08-021',
      '02800-08-022', '02800-08-080', '02800-08-089', '02800-09-010',
      '02800-09-029', '02800-09-052', '02800-09-072', '02800-10-025',
      '02800-10-026', '02800-10-030', '02800-10-061',
    ],
    // These bands contain formula glyphs followed by one real question diagram.
    lastEmbeddedImageOnly: [
      '02800-08-015', '02800-09-006', '02800-10-003', '02800-10-004',
      '02800-10-005', '02800-10-006', '02800-10-021', '02800-10-023',
      '02800-10-029', '02800-10-060',
    ],
    // The PDF stores this question's four gate choices before its truth-table
    // prompt image. Keep the learner-facing order as prompt, then choices 1-4.
    embeddedImageOrder: {
      '02800-10-012': [4, 0, 1, 2, 3],
    },
  },
  {
    code: '07002',
    source: '070024A10',
    cropPrefix: '070024',
    embeddedImages: true,
    imageReferenceFile: '070024A10-image-reference.json',
  },
  { code: '14500', source: '145003A13', cropPrefix: '145003' },
  {
    code: '21500',
    source: '215003A11',
    cropPrefix: '215003',
    splitImageOptions: true,
    optionRectOverrides: {
      // 098's four glass choices are taller than the generic 40pt option band.
      // The auto crops cut off the lower half of options 2-4, so keep measured
      // rectangles from the official PDF page.
      '21500-03-098': [
        { x: 110, y: 366, width: 67, height: 62 },
        { x: 192, y: 366, width: 75, height: 62 },
        { x: 281, y: 374, width: 75, height: 74 },
        { x: 370, y: 374, width: 77, height: 74 },
      ],
    },
  },
  { code: '22000', source: '220001A15', cropPrefix: '220001' },
  {
    code: '22100',
    source: '221001A14',
    cropPrefix: '221001',
    splitImageOptions: true,
    optionRectOverrides: {
      // 039's option markers sit on the prompt row, but the four certification
      // marks wrap onto the next row. The first auto crop lands on whitespace;
      // keep explicit measured rectangles from the official PDF page.
      '22100-03-039': [
        { x: 134, y: 574, width: 43, height: 40 },
        { x: 190, y: 574, width: 49, height: 40 },
        { x: 258, y: 574, width: 47, height: 40 },
        { x: 331, y: 574, width: 47, height: 48 },
      ],
    },
  },
  { code: '07004', source: '070044A12', cropPrefix: '070044', splitImageOptions: true },
  {
    code: '11700',
    source: '117002A13',
    cropPrefix: '117002',
    embeddedImages: true,
    imageReferenceFile: '117002A13-image-reference.json',
    // Options drawn as vector formulas. The external reference catalogue has no
    // asset for them, so they never reached the reference file and the embedded
    // pass found no raster image to place — the question shipped with four
    // "圖示選項 N" placeholders and nothing to look at. Crop them from the
    // official PDF instead. See VECTOR_OPTION_QUESTIONS below.
    vectorOptionQuestions: {
      // The stacked fractions in options 3 and 4 hang below the default
      // single-line crop height, which cut their denominators off.
      '11700-05-028': { optionRects: [null, null, { height: 48 }, { height: 48 }] },
      '11700-05-033': {},
      '11700-05-114': {},
      // Same defect: all four options are vector formulas the reference
      // catalogue never described. Each of these three also has a real
      // circuit diagram the catalogue *does* know about (a single
      // 'prompt'-role reference asset) — the fix below keeps that image and
      // appends the four vector-cropped options after it.
      // Options 2 and 4 here wrap onto the start of the next line the same
      // way option 4 does in 05-028/033/114/039, but there's blank room left
      // on their own marker's line first — the auto wrap-detector only fires
      // when that room is too narrow to hold anything, so it doesn't catch
      // this case. Rects taken directly from the rendered PDF page.
      '11700-05-023': { optionRects: [null, { x: 110, y: 421, width: 163, height: 40 }, null, { x: 110, y: 455, width: 163, height: 60 }] },
      '11700-05-039': {},
      // 11700-05-051 looked like the same defect (three blank option markers)
      // but checking the page showed options 1-3 are plain "1/2π√(...)"
      // formulas, not graphics — the radical/vinculum glyphs just didn't come
      // through as inline text. Text-representable beats an image crop for
      // learner quality, so that one is fixed via QUESTION_OPTION_OVERRIDES in
      // build-exam-packs.mjs instead of here.
    },
  },
  {
    code: '18100',
    source: '181003A13',
    cropPrefix: '181003',
    embeddedImages: true,
    imageReferenceFile: '181003A13-image-reference.json',
  },
  {
    code: '18201',
    source: '182012A10',
    cropPrefix: '182012',
    embeddedImages: true,
    imageReferenceFile: '182012A10-image-reference.json',
    excludedQuestionIds: ['18201-02-140', '18201-04-240'],
    compositeEmbeddedQuestions: ['18201-04-208'],
    vectorOptionQuestions: {
      '18201-05-048': {},
      // Same defect as 05-048: Z-coordinate options rendered as blank vector
      // glyphs. This one also has a real diagram the reference catalogue
      // knows about (the ball-nose-cutter-on-hemisphere figure) — preserve
      // it and append the four vector-cropped options after it.
      '18201-05-047': {},
    },
  },
  {
    code: '90001',
    source: '900012A10',
    cropPrefix: '900012',
    embeddedImages: true,
    excludedQuestionIds: [
      '90001-07-012',
      '90001-07-019',
      '90001-09-003',
      '90001-09-029',
      '90001-02-010',
      '90001-02-016',
      '90001-02-017',
      '90001-02-018',
      '90001-02-019',
      '90001-02-020',
      '90001-02-021',
      '90001-02-022',
      '90001-02-023',
      '90001-02-024',
      '90001-02-025',
      '90001-02-026',
      '90001-02-027',
      '90001-02-031',
      '90001-02-033',
      '90001-02-048',
      '90001-08-002',
      '90001-09-032',
      '90001-09-033',
      '90001-09-036',
      '90001-09-037',
    ],
  },
  {
    code: '12000',
    source: '120003A12',
    cropPrefix: '120003',
    splitImageOptions: true,
    // "下圖之右側視圖為" — the isometric reference shape sits above the
    // option line, so keep it as a base image alongside the four option crops.
    mixedFigureOptions: ['12000-01-003'],
  },
  {
    code: '01600',
    source: '016003A12',
    cropPrefix: '016003',
    splitImageOptions: true,
    // Same "blank room, but the symbol actually wraps onto the next line"
    // gap as 007003/00700-01-006 above, at various option positions.
    optionRectOverrides: {
      '01600-01-006': [null, { x: 110, y: 344, width: 88, height: 40 }, null, null],
      '01600-01-007': [null, null, { x: 110, y: 439, width: 79, height: 40 }, null],
      '01600-01-015': [null, { x: 110, y: 278, width: 88, height: 40 }, null, null],
      '01600-01-020': [null, null, { x: 110, y: 559, width: 76, height: 40 }, null],
      '01600-03-013': [
        null,
        { x: 110, y: 672, width: 190, height: 40 },
        null,
        { x: 110, y: 704, width: 190, height: 40 },
      ],
    },
  },
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

function renderPage({ rendered, work, pdfPath, sourcePage }) {
  let renderedPage = rendered.get(sourcePage)
  if (!renderedPage) {
    const prefix = join(work, `page-${sourcePage}`)
    execFileSync('pdftoppm', [
      '-f', String(sourcePage), '-l', String(sourcePage),
      '-r', '144', '-png', '-singlefile',
      pdfPath, prefix,
    ], { stdio: 'ignore' })
    renderedPage = `${prefix}.png`
    rendered.set(sourcePage, renderedPage)
  }
  return renderedPage
}

function embeddedPages(xml) {
  return [...xml.matchAll(/<page number="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)].map((pageMatch) => {
    const body = pageMatch[2]
    const markers = [...body.matchAll(/<text top="(\d+)" left="(\d+)"[^>]*>([\s\S]*?)<\/text>/g)]
      .map((match) => ({
        top: Number(match[1]),
        left: Number(match[2]),
        text: match[3].replace(/<[^>]+>/g, ''),
      }))
      .filter((text) => text.left < 130 && /^(\d+)\.\s*\(/.test(text.text))
      .map((text) => ({ ...text, number: Number(text.text.match(/^(\d+)\./)[1]) }))
    const images = [...body.matchAll(/<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"\/>/g)]
      .map((match) => ({
        top: Number(match[1]),
        left: Number(match[2]),
        width: Number(match[3]),
        height: Number(match[4]),
        source: match[5],
      }))
      // Every page contains this decorative WDA watermark. Real question
      // photos may also be JPEGs, so filtering by extension would lose data.
      .filter((image) => !(image.left === 576 && image.width === 268 && image.height === 263))
    return { number: Number(pageMatch[1]), markers, images }
  })
}

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

function hashDistance(left, right) {
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let count = 0
  while (value) {
    count += Number(value & 1n)
    value >>= 1n
  }
  return count
}

function matchReferenceImages(images, referenceAssets, questionId) {
  if (images.length === referenceAssets.length) return images
  const candidates = images.map((image, index) => ({
    image,
    index,
    differenceHash: differenceHash(image.source),
  }))
  const matches = []
  const used = new Set()
  for (const asset of referenceAssets) {
    const ranked = candidates
      .filter((candidate) => !used.has(candidate.index))
      .map((candidate) => ({
        ...candidate,
        distance: hashDistance(candidate.differenceHash, asset.differenceHash),
      }))
      .sort((left, right) => left.distance - right.distance)
    const best = ranked[0]
    if (!best || best.distance > 18) {
      throw new Error(`${questionId}: cannot match ${asset.reference} to an official embedded image`)
    }
    used.add(best.index)
    matches.push(best.image)
  }
  return matches
}

function matchPartialReferenceImages(images, referenceAssets, questionId) {
  const matches = new Map()
  const usedAssets = new Set()
  for (const image of images) {
    const imageHash = differenceHash(image.source)
    const ranked = referenceAssets
      .map((asset, index) => ({
        index,
        distance: hashDistance(imageHash, asset.differenceHash),
      }))
      .filter((candidate) => !usedAssets.has(candidate.index))
      .sort((left, right) => left.distance - right.distance)
    const best = ranked[0]
    if (!best || best.distance > 18) {
      throw new Error(`${questionId}: an official embedded image has no matching reference role`)
    }
    usedAssets.add(best.index)
    matches.set(best.index, image)
  }
  return matches
}

async function copyEmbeddedImage(source, output) {
  if (source.endsWith('.png')) {
    await copyFile(source, output)
    return
  }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', source, '-frames:v', '1', output], { stdio: 'ignore' })
}

function stackEmbeddedImages(images, output) {
  const inputs = images.flatMap((image) => ['-i', image.source])
  const layout = images
    .map((_, index) => `0_${index === 0 ? '0' : Array.from({ length: index }, (__, previous) => `h${previous}`).join('+')}`)
    .join('|')
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', `xstack=inputs=${images.length}:layout=${layout}:fill=white`,
    '-frames:v', '1', output,
  ], { stdio: 'ignore' })
}

async function buildEmbeddedBank({
  source,
  cropPrefix,
  excludedEmbeddedQuestions = [],
  excludedQuestionIds = [],
  lastEmbeddedImageOnly = [],
  compositeEmbeddedQuestions = [],
  embeddedImageOrder = {},
  vectorOptionQuestions = {},
  imageReferenceFile,
}) {
  const pdfPath = fileURLToPath(new URL(`../source/${source}.pdf`, import.meta.url))
  const raw = await readFile(new URL(`../source/${source}-raw.txt`, import.meta.url), 'utf8')
  const questions = parseQuestionBank(raw)
  const excluded = new Set([...excludedEmbeddedQuestions, ...excludedQuestionIds])
  const lastOnly = new Set(lastEmbeddedImageOnly)
  const composites = new Set(compositeEmbeddedQuestions)
  const reference = imageReferenceFile
    ? JSON.parse(await readFile(new URL(`../source/${imageReferenceFile}`, import.meta.url), 'utf8'))
    : null
  const work = join(tmpdir(), `level-up-embedded-${source}`)
  await mkdir(work, { recursive: true })
  const xmlPath = join(work, 'embedded.xml')
  execFileSync('pdftohtml', ['-xml', '-hidden', '-nodrm', pdfPath, xmlPath], { stdio: 'ignore' })
  const pages = embeddedPages(await readFile(xmlPath, 'utf8'))
  const outputRoot = new URL('../public/question-images/', import.meta.url)
  await mkdir(outputRoot, { recursive: true })
  let bboxPages
  const renderedPages = new Map()

  async function vectorFallback(question, referenceAssets, rectOverrides = null) {
    if (!bboxPages) {
      const bboxPath = join(work, 'bbox.html')
      execFileSync('pdftotext', ['-bbox-layout', pdfPath, bboxPath])
      bboxPages = pagesFromBbox(await readFile(bboxPath, 'utf8'))
    }
    const page = bboxPages[question.sourcePage - 1]
    if (!page) throw new Error(`${question.id}: vector page ${question.sourcePage} missing`)
    const markerIndex = page.markers.findIndex((marker) => marker.number === question.number)
    if (markerIndex < 0) throw new Error(`${question.id}: vector question marker missing`)
    const marker = page.markers[markerIndex]
    const next = page.markers[markerIndex + 1]
    const top = Math.max(0, marker.y - 5)
    const bottom = Math.min(page.height - 24, next ? next.y - 4 : page.height - 30)

    let renderedPage = renderedPages.get(question.sourcePage)
    if (!renderedPage) {
      const prefix = join(work, `vector-page-${question.sourcePage}`)
      execFileSync('pdftoppm', [
        '-f', String(question.sourcePage), '-l', String(question.sourcePage),
        '-r', '144', '-png', '-singlefile', pdfPath, prefix,
      ], { stdio: 'ignore' })
      renderedPage = `${prefix}.png`
      renderedPages.set(question.sourcePage, renderedPage)
    }

    const allOptions = referenceAssets.length > 0
      && referenceAssets.every((asset) => asset.role.startsWith('option-'))
    const computedOptionRects = allOptions ? optionCropRects(page, top, bottom) : null
    // Per-option geometry repairs for formulas the single-line default clips.
    const allOptionRects = computedOptionRects && rectOverrides
      ? computedOptionRects.map((rect, index) => ({ ...rect, ...(rectOverrides[index] ?? {}) }))
      : computedOptionRects
    const rects = allOptionRects
      ? referenceAssets.map((asset) => allOptionRects[Number(asset.role.slice('option-'.length)) - 1])
      : referenceAssets.length === 1
        ? [figureCropRect(question, page, top, bottom)]
        : null
    if (!rects || rects.length !== referenceAssets.length) {
      throw new Error(`${question.id}: cannot isolate ${referenceAssets.length} vector images`)
    }

    return rects.map((rect, index) => {
      const output = join(work, `${question.id}-${index + 1}.png`)
      cropImage(renderedPage, output, page, rect)
      return {
        top: rect.y,
        left: rect.x,
        width: rect.width,
        height: rect.height,
        source: output,
      }
    })
  }

  for (const file of await readdir(outputRoot)) {
    if (file.startsWith(`${cropPrefix}-`) && file.endsWith('.png')) await unlink(new URL(file, outputRoot))
  }

  const imageMap = {}
  const imageAudit = {}
  for (const question of questions) {
    if (excluded.has(question.id)) continue

    // Questions whose four options are vector formulas rather than embedded
    // raster images. Nothing in the reference catalogue describes them, so the
    // normal path finds zero images and skips the question — which is how these
    // shipped as unanswerable. Crop all four options straight from the official
    // PDF, which is the authoritative source in any case.
    const vectorOptions = vectorOptionQuestions[question.id]
    if (vectorOptions) {
      // Some of these questions also have a real figure (e.g. the shape the
      // options describe) that the reference catalogue *does* know about —
      // recover it the same way the normal path below would, so fixing the
      // vector-formula options doesn't drop a base image that was already
      // correct. Only prompt-role assets are supported here; anything else
      // means this question needs the normal per-question path instead.
      const referenceAssets = reference?.questions?.[question.id] ?? []
      if (referenceAssets.some((asset) => asset.role !== 'prompt')) {
        throw new Error(`${question.id}: vectorOptionQuestions expects only prompt-role reference assets, got ${referenceAssets.map((asset) => asset.role).join(',')}`)
      }
      let promptImages = []
      if (referenceAssets.length) {
        const page = pages.find((candidate) => candidate.number === question.sourcePage)
        if (!page) throw new Error(`${question.id}: embedded-image page ${question.sourcePage} missing`)
        const markerIndex = page.markers.findIndex((marker) => marker.number === question.number)
        if (markerIndex < 0) throw new Error(`${question.id}: embedded-image marker missing on page ${question.sourcePage}`)
        const top = page.markers[markerIndex].top - 4
        const bottom = page.markers[markerIndex + 1] ? page.markers[markerIndex + 1].top - 4 : 1260
        const bandImages = page.images.filter((image) => image.top >= top && image.top < bottom)
        promptImages = matchReferenceImages(bandImages, referenceAssets, question.id)
      }

      const optionAssets = [1, 2, 3, 4].map((index) => ({
        role: `option-${index}`,
        reference: `official-vector-option-${index}`,
      }))
      const optionImages = await vectorFallback(question, optionAssets, vectorOptions.optionRects ?? null)

      const assetMeta = [...referenceAssets, ...optionAssets]
      const assetImages = [...promptImages, ...optionImages]
      const roleTotals = new Map()
      for (const asset of assetMeta) roleTotals.set(asset.role, (roleTotals.get(asset.role) ?? 0) + 1)
      const roleSeen = new Map()
      const files = assetMeta.map((asset) => {
        const occurrence = (roleSeen.get(asset.role) ?? 0) + 1
        roleSeen.set(asset.role, occurrence)
        const repeatedSuffix = (roleTotals.get(asset.role) ?? 0) > 1 ? `-${occurrence}` : ''
        const suffix = asset.role.startsWith('option-')
          ? `-${asset.role}${repeatedSuffix}`
          : asset.role === 'prompt' && (roleTotals.get(asset.role) ?? 0) > 1 ? `-prompt-${occurrence}` : ''
        return `${cropPrefix}-${question.id}${suffix}.png`
      })
      await Promise.all(assetImages.map((image, index) => copyEmbeddedImage(
        image.source,
        fileURLToPath(new URL(files[index], outputRoot)),
      )))
      imageMap[question.id] = files
      imageAudit[question.id] = await Promise.all(files.map(async (file, index) => ({
        file,
        reference: assetMeta[index].reference,
        role: assetMeta[index].role,
        sha256: createHash('sha256').update(await readFile(new URL(file, outputRoot))).digest('hex'),
      })))
      continue
    }

    const page = pages.find((candidate) => candidate.number === question.sourcePage)
    if (!page) throw new Error(`${question.id}: embedded-image page ${question.sourcePage} missing`)
    const markerIndex = page.markers.findIndex((marker) => marker.number === question.number)
    if (markerIndex < 0) throw new Error(`${question.id}: embedded-image marker missing on page ${question.sourcePage}`)
    const top = page.markers[markerIndex].top - 4
    const bottom = page.markers[markerIndex + 1]
      ? page.markers[markerIndex + 1].top - 4
      : 1260
    let images = page.images.filter((image) => image.top >= top && image.top < bottom)
    if (lastOnly.has(question.id)) images = images.slice(-1)
    const requestedOrder = embeddedImageOrder[question.id]
    if (requestedOrder) {
      if (requestedOrder.length !== images.length || new Set(requestedOrder).size !== images.length) {
        throw new Error(`${question.id}: invalid embedded-image order ${requestedOrder.join(',')}`)
      }
      images = requestedOrder.map((index) => images[index])
    }
    if (composites.has(question.id) && images.length > 1) {
      const output = join(work, `${question.id}-composite.png`)
      stackEmbeddedImages(images, output)
      images = [{
        top: images[0].top,
        left: Math.min(...images.map((image) => image.left)),
        width: Math.max(...images.map((image) => image.width)),
        height: images.reduce((sum, image) => sum + image.height, 0),
        source: output,
      }]
    }
    const hasImageOptions = question.options.some((option) => option.includes('圖示選項'))
    if (source === '900012A10' && !hasImageOptions && images.length > 1) {
      const hashes = images.map((image) => differenceHash(image.source))
      images = images.filter((image, index) => {
        const duplicateCount = hashes.filter((hash) => hash === hashes[index]).length
        return duplicateCount === 1 || image.width * image.height > 2_000
      })
    }
    const referenceAssets = reference?.questions?.[question.id]
    if (reference) {
      const expectedCount = referenceAssets?.length ?? 0
      if (images.length < expectedCount && markerIndex === page.markers.length - 1) {
        const nextPage = pages.find((candidate) => candidate.number === question.sourcePage + 1)
        const firstMarkerTop = nextPage?.markers[0]?.top
        if (nextPage && firstMarkerTop !== undefined) {
          images = [
            ...images,
            ...nextPage.images.filter((image) => image.top < firstMarkerTop),
          ]
        }
      }
      if (images.length < expectedCount) {
        const matched = matchPartialReferenceImages(images, referenceAssets ?? [], question.id)
        const missing = referenceAssets
          .map((asset, index) => ({ asset, index }))
          .filter(({ index }) => !matched.has(index))
        const vectorImages = await vectorFallback(question, missing.map(({ asset }) => asset))
        missing.forEach(({ index }, vectorIndex) => matched.set(index, vectorImages[vectorIndex]))
        images = referenceAssets.map((_, index) => matched.get(index))
      }
      if (images.length > expectedCount) {
        images = matchReferenceImages(images, referenceAssets ?? [], question.id)
      }
    }
    if (!images.length) continue

    const imageOptions = referenceAssets?.length === 4
      && referenceAssets.every((asset) => asset.role.startsWith('option-'))
      || (!reference && !lastOnly.has(question.id) && hasImageOptions)
    if (imageOptions && images.length !== 4 && images.length !== 5) {
      throw new Error(`${question.id}: expected four graphical options plus at most one prompt image, received ${images.length}`)
    }
    const roleTotals = new Map()
    for (const asset of referenceAssets ?? []) {
      roleTotals.set(asset.role, (roleTotals.get(asset.role) ?? 0) + 1)
    }
    const roleSeen = new Map()
    const files = images.map((image, index) => {
      const role = referenceAssets?.[index]?.role
      const occurrence = role ? (roleSeen.get(role) ?? 0) + 1 : 1
      if (role) roleSeen.set(role, occurrence)
      const repeatedSuffix = role && (roleTotals.get(role) ?? 0) > 1 ? `-${occurrence}` : ''
      const suffix = role?.startsWith('option-')
        ? `-option-${role.slice('option-'.length)}${repeatedSuffix}`
        : role === 'prompt' && (roleTotals.get(role) ?? 0) > 1 ? `-prompt-${occurrence}` : index === 0 ? '' : `-${index + 1}`
      return `${cropPrefix}-${question.id}${suffix}.png`
    })
    await Promise.all(images.map((image, index) => copyEmbeddedImage(
      image.source,
      fileURLToPath(new URL(files[index], outputRoot)),
    )))
    imageMap[question.id] = files
    imageAudit[question.id] = await Promise.all(files.map(async (file, index) => ({
      file,
      reference: referenceAssets?.[index]?.reference ?? `official-${index + 1}`,
      role: referenceAssets?.[index]?.role ?? (index === 0 ? 'prompt' : `image-${index + 1}`),
      sha256: createHash('sha256').update(await readFile(new URL(file, outputRoot))).digest('hex'),
    })))
  }

  await writeFile(
    new URL(`../source/${source}-image-map.json`, import.meta.url),
    `${JSON.stringify({ source: `${source}.pdf`, questions: imageMap }, null, 2)}\n`,
  )
  await writeFile(
    new URL(`../source/${source}-image-audit.json`, import.meta.url),
    `${JSON.stringify({
      officialSource: `source/${source}.pdf`,
      referenceCatalog: reference?.referenceCatalog ?? null,
      note: reference?.note ?? 'Images are extracted directly from the official WDA PDF.',
      questions: imageAudit,
    }, null, 2)}\n`,
  )
  return Object.keys(imageMap).length
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
  optionRectOverrides = {},
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

    const rectOverride = figureRects[question.id]
    const cropPageNumber = rectOverride?.page ?? question.sourcePage
    const cropPage = pages[cropPageNumber - 1]
    if (!cropPage) throw new Error(`${question.id}: crop page ${cropPageNumber} missing`)
    const renderedPage = renderPage({ rendered, work, pdfPath, sourcePage: cropPageNumber })

    const imageOptions = splitImageOptions && question.options.some((option) => option.includes('圖示選項'))
    const hasQuestionFigure = mixedFigureOptions.includes(question.id)
    if (figuresOnly && imageOptions && !hasQuestionFigure) continue
    const optionRects = imageOptions ? optionCropRects(page, top, bottom) : null
    // The auto heuristic anchors an option's crop on its own marker line. When
    // an option's symbol has no room left on that line and wraps onto a blank
    // row of its own — with nothing to anchor on but a "。" several lines down
    // — the heuristic has no way to find it and produces a sliver crop. Rather
    // than guess a general detector from one pack's hand-tuned layout, take an
    // explicit per-option rect straight from the PDF.
    const optionOverride = optionRectOverrides[question.id]
    if (optionRects && optionOverride) {
      optionOverride.forEach((rect, index) => {
        if (rect) optionRects[index] = rect
      })
    }
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
        cropImage(renderedPage, output, cropPage, rectOverride
          ?? figureCropRect(question, page, top, bottom, { ignoreInlineGap: true }))
      }
      if (!figuresOnly) {
        optionRects.forEach((rect, index) => cropImage(renderedPage, optionOutputs[index], page, rect))
      }
    } else {
      cropImage(renderedPage, output, cropPage, rectOverride
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
  const count = bank.embeddedImages ? await buildEmbeddedBank(bank) : await buildBank(bank)
  total += count
  console.log(`${bank.source}: ${count} question crops`)
}
console.log(`Question crops: ${total} generated from ${selectedBanks.length} official PDFs`)
