import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STATS_PAGE = 'https://www.wdasec.gov.tw/News_Content.aspx?n=5941D5DCC3DD7DDA&sms=CA0630966F34DA45&s=C8325D4465DF9769'

function parseCsvLine(line) {
  const fields = []
  let field = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      fields.push(field)
      field = ''
    } else field += char
  }
  fields.push(field)
  return fields
}

export function parseApplicantCsv(csv) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = parseCsvLine(lines.shift() ?? '')
  const column = Object.fromEntries(headers.map((header, index) => [header.trim(), index]))
  return lines.flatMap((line) => {
    const fields = parseCsvLine(line)
    const detailed = fields[column['細項職類名稱']]?.trim() ?? ''
    const match = detailed.match(/^(\d{5})(.+)$/)
    if (!match) return []
    return [{
      code: match[1],
      title: match[2].trim(),
      level: fields[column['級別']]?.trim(),
      category: fields[column['職類群']]?.trim(),
      applicantCount: Number(fields[column['報檢人次']] || 0),
      attendeeCount: Number(fields[column['到檢人次']] || 0),
      passedCount: Number(fields[column['合格人次']] || 0),
    }]
  })
}

export function buildDemandRanking(catalogEntries, statistics, installedKeys = new Set()) {
  const byKey = new Map(statistics.map((entry) => [`${entry.code}:${entry.level}`, entry]))
  return catalogEntries
    .map((entry) => {
      const stats = byKey.get(`${entry.code}:${entry.level}`)
      return {
        ...entry,
        installed: installedKeys.has(`${entry.code}:${entry.level}`),
        category: stats?.category ?? null,
        applicantCount: stats?.applicantCount ?? null,
        attendeeCount: stats?.attendeeCount ?? null,
        passedCount: stats?.passedCount ?? null,
      }
    })
    .sort((a, b) => (
      (b.applicantCount ?? -1) - (a.applicantCount ?? -1)
      || a.code.localeCompare(b.code)
      || a.level.localeCompare(b.level)
    ))
    .map((entry, index) => ({ ...entry, demandRank: index + 1 }))
}

function statsDownloadUrl(html) {
  const match = html.match(/href="(https:\/\/ws\.wda\.gov\.tw\/Download\.ashx\?[^"#]+)"[^>]*title="技能檢定當年度報檢、到檢及合格數\.zip"/)
  if (!match) throw new Error('Official statistics ZIP link was not found')
  return match[1].replaceAll('&amp;', '&')
}

function statsPeriod(html) {
  const description = html.match(/本表數據係([^，。<]+)[，。<]/)?.[1]
  return description ?? '當年度最新統計'
}

async function unzipCsv(bytes) {
  const directory = await mkdtemp(join(tmpdir(), 'level-up-wda-stats-'))
  const archive = join(directory, 'stats.zip')
  try {
    await writeFile(archive, bytes)
    return execFileSync('unzip', ['-p', archive], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function loadInstalledKeys() {
  const root = new URL('../public/data/exams/', import.meta.url)
  const manifests = await Promise.all((await readdir(root)).map(async (directory) => (
    JSON.parse(await readFile(new URL(`${directory}/manifest.json`, root), 'utf8'))
  )))
  return new Set(manifests.map((manifest) => {
    const occupation = manifest.sections.find((section) => section.sourceGroup === 'occupation')
    return `${occupation?.subjectCode}:${manifest.level}`
  }))
}

function markdownReport(output) {
  const pending = output.ranking.filter((entry) => !entry.installed && entry.applicantCount !== null).slice(0, 50)
  const lines = [
    '# Exam demand ranking',
    '',
    `Official source: ${output.source}`,
    '',
    `Period: ${output.period}`,
    '',
    'This ranking uses exact WDA occupation code and level. Applicant counts are a prioritization signal, not a publication queue; verification still gates release.',
    '',
    '| Rank | Code | Level | Exam | Category | Applicants |',
    '| ---: | --- | --- | --- | --- | ---: |',
    ...pending.map((entry) => `| ${entry.demandRank} | ${entry.code} | ${entry.level} | ${entry.title} | ${entry.category ?? ''} | ${entry.applicantCount.toLocaleString('en-US')} |`),
    '',
  ]
  return `${lines.join('\n')}\n`
}

async function main() {
  const pageResponse = await fetch(STATS_PAGE)
  if (!pageResponse.ok) throw new Error(`WDA statistics page returned HTTP ${pageResponse.status}`)
  const html = await pageResponse.text()
  const downloadUrl = statsDownloadUrl(html)
  const zipResponse = await fetch(downloadUrl)
  if (!zipResponse.ok) throw new Error(`WDA statistics ZIP returned HTTP ${zipResponse.status}`)
  const csv = await unzipCsv(Buffer.from(await zipResponse.arrayBuffer()))
  const statistics = parseApplicantCsv(csv)
  const officialCatalog = JSON.parse(await readFile(new URL('../source/wda-catalog.json', import.meta.url), 'utf8'))
  const ranking = buildDemandRanking(officialCatalog.entries, statistics, await loadInstalledKeys())
  const output = {
    generatedAt: new Date().toISOString(),
    source: STATS_PAGE,
    downloadUrl,
    authority: 'official-primary',
    period: statsPeriod(html),
    statisticsRows: statistics.length,
    catalogRows: officialCatalog.entries.length,
    matchedRows: ranking.filter((entry) => entry.applicantCount !== null).length,
    ranking,
  }
  await writeFile(new URL('../source/wda-demand-ranking.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`)
  await writeFile(new URL('../docs/exam-demand-ranking.md', import.meta.url), markdownReport(output))
  console.log(`Demand: ${output.statisticsRows} statistics rows; ${output.matchedRows}/${output.catalogRows} catalog rows matched`)
  console.log(`Top pending: ${ranking.filter((entry) => !entry.installed && entry.applicantCount !== null).slice(0, 10).map((entry) => `${entry.code} ${entry.level} ${entry.title} (${entry.applicantCount})`).join('; ')}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) await main()
