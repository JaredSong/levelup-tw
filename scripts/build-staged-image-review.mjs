import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const source = process.argv[2]
if (!/^\d{6}A\d+$/.test(source ?? '')) {
  throw new Error('Usage: node scripts/build-staged-image-review.mjs 042003A11')
}

const root = resolve('tmp/import-batch', source)
const config = JSON.parse(await readFile(join(root, 'candidate-config.json'), 'utf8'))
const questions = JSON.parse(await readFile(join(root, 'questions.json'), 'utf8'))
const cropNames = (await readdir(join(root, 'crops')).catch((error) => {
  if (error.code === 'ENOENT') return []
  throw error
})).filter((name) => name.endsWith('.png'))
const prefix = source.slice(0, 6)
const cropIds = cropNames.map((name) => name.match(new RegExp(`^${prefix}-(\\d{5}-\\d{2}-\\d{3})(?:-[1-4])?\\.png$`))?.[1]).filter(Boolean)
const reviewQueue = JSON.parse(await readFile(join(root, 'review-queue.json'), 'utf8'))
const queueIds = cropNames.length ? [] : reviewQueue.plan.flatMap((item) => item.questionIds)
const missingFormula = (question) => question.options.some((option) => /±\s*㎜|\s{2,}㎡/.test(option))
  || /差為，其中|差為，F 為|大於，K 為/.test(question.prompt)
const textGapIds = questions.filter(missingFormula).map((question) => question.id)
const ids = [...new Set([...cropIds, ...queueIds, ...textGapIds])].sort()
const byId = new Map(questions.map((question) => [question.id, question]))
const pagesDir = join(root, 'pages')
await mkdir(pagesDir, { recursive: true })
execFileSync('pdftoppm', ['-r', '110', '-png', join(root, config.source.pdfFilename), join(pagesDir, 'page')])

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

const cards = ids.map((id) => {
  const question = byId.get(id)
  if (!question) throw new Error(`No staged question for ${id}`)
  const images = cropNames.filter((name) => name.startsWith(`${prefix}-${id}`)).sort()
  const page = String(question.sourcePage).padStart(2, '0')
  const options = question.options.map((option, index) => `<li>${index + 1}. ${escapeHtml(option)}</li>`).join('')
  const imageReview = images.map((name) => `<figure><img loading="lazy" src="crops/${name}" alt="${escapeHtml(name)}"><figcaption>${escapeHtml(name)}</figcaption></figure>`).join('')
  const candidateReview = `<h2>Candidate crops (${images.length})</h2>${imageReview || '<p>No crop: compare the text against the source page.</p>'}`
  return `<article id="${id}">
    <header><strong>${id}${missingFormula(question) ? ' · missing formula suspected' : ''}</strong><span>PDF page ${question.sourcePage}</span></header>
    <p>${escapeHtml(question.prompt)}</p><ol>${options}</ol>
    <div class="compare">
      <div><h2>Source page</h2><a href="pages/page-${page}.png" target="_blank"><img class="page" loading="lazy" src="pages/page-${page}.png" alt="Official PDF page ${page}"></a></div>
      <div>${candidateReview}</div>
    </div>
  </article>`
}).join('\n')

const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(config.titleZh)} source review</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#18211e;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:24px}h1{font-size:24px;margin:0 0 8px}h2{font-size:14px;margin:0 0 12px}p{margin:10px 0}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}nav a{color:#12583c;text-decoration:none;border:1px solid #cbd5d0;padding:4px 8px}article{background:#fff;border:1px solid #cbd5d0;border-radius:6px;margin:24px 0;padding:20px;scroll-margin-top:16px}article header{display:flex;justify-content:space-between;gap:16px}ol{padding-left:24px}.compare{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.compare>div{min-width:0}.page{max-width:100%;max-height:700px;object-fit:contain;border:1px solid #cbd5d0}figure{margin:0 0 12px;padding:12px;border:1px solid #d8dfdb}figure img{max-width:100%;max-height:180px;object-fit:contain}figcaption{font-size:12px;color:#64716a;overflow-wrap:anywhere}@media(max-width:760px){main{padding:12px}.compare{grid-template-columns:1fr}}
</style></head><body><main><h1>${escapeHtml(config.titleZh)} · source review</h1><p>${ids.length} candidates (${new Set(cropIds).size} with crops, ${textGapIds.length} suspected text gaps). These are staged, not published. Compare each against its official PDF page before approval.</p><nav>${ids.map((id) => `<a href="#${id}">${id}</a>`).join('')}</nav>${cards}</main></body></html>`

await writeFile(join(root, 'image-review.html'), html)
console.log(`${source}: ${ids.length} source-review candidates; review at ${join(root, 'image-review.html')}`)
