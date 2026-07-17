import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const WDA_ORIGIN = 'https://owinform.wdasec.gov.tw'
const WDA_INDEX_URL = `${WDA_ORIGIN}/`
const WDA_AJAX_URL = `${WDA_ORIGIN}/inc/ExtAjaxFgetList.ashx`
const WDA_DOWNLOAD_ROOT = `${WDA_ORIGIN}/owInform/DLowFile`
const LEVELS = { '1': '甲級', '2': '乙級', '3': '丙級', '4': '單一級' }

function cleanText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseRocDate(value) {
  if (!/^\d{7}$/.test(String(value ?? ''))) return null
  const raw = String(value)
  const year = Number(raw.slice(0, 3)) + 1911
  return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`
}

export function parseWdaCatalogIndex(html) {
  const entries = []
  const seen = new Set()
  const cellPattern = /<td\b[^>]*id=["'](\d{5})["'][^>]*>([\s\S]*?)<\/td>/gi
  let cell
  while ((cell = cellPattern.exec(html)) !== null) {
    const [, code, block] = cell
    const title = cleanText(block.match(/<span\b[^>]*class=["']Roflabelup["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
      .replace(new RegExp(`^${code}\\s*`), '')
    const callPattern = /ShowKnowdiv\('(\d{7})','(\d{5})','([1-4])'\)/g
    let call
    while ((call = callPattern.exec(block)) !== null) {
      const [, , callCode, levelCode] = call
      if (callCode !== code) continue
      const key = `${code}:${levelCode}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({ code, title, levelCode, level: LEVELS[levelCode] })
    }
  }
  const effectiveRocDate = html.match(/ShowKnowdiv\('(\d{7})'/)?.[1] ?? null
  return { effectiveRocDate, entries }
}

function isEffective(row, effectiveRocDate) {
  return !row.EnableDay || String(row.EnableDay) <= effectiveRocDate
}

export function selectCurrentTheoryPdf(rows, subjectCode, levelCode, effectiveRocDate) {
  const candidates = rows.filter((row) => (
    row.PROFID === subjectCode
    && String(row.MYLEVEL) === levelCode
    && row.PLATYPE === 'A'
    && String(row.PLAFILETYPE) === '1'
    && String(row.Lang) === '1'
    && /\.pdf$/i.test(row.PLAFILE ?? '')
    && isEffective(row, effectiveRocDate)
  ))
  candidates.sort((a, b) => (
    String(b.EnableDay ?? '').localeCompare(String(a.EnableDay ?? ''))
    || Number(b.PLAFNO ?? 0) - Number(a.PLAFNO ?? 0)
  ))
  const current = candidates[0]
  if (!current) return null
  const version = current.PLAFILE.match(/(A\d+)\.pdf$/i)?.[1]?.toUpperCase() ?? null
  return {
    subjectCode,
    title: current.ROFNAME,
    levelCode,
    level: LEVELS[levelCode] ?? '共同科目',
    version,
    pdfFilename: current.PLAFILE,
    officialUrl: `${WDA_DOWNLOAD_ROOT}/${current.PLAFILE}`,
    effectiveFrom: parseRocDate(current.EnableDay),
    effectiveFromRoc: current.EnableDay ?? null,
    remark: current.PLAREMARK?.trim() || null,
  }
}

export function buildDriftReport(manifests, officialDocuments, examLevelCodes) {
  const mismatches = []
  const missing = []
  for (const manifest of manifests) {
    const occupationLevel = examLevelCodes.get(manifest.examId)
    for (const source of manifest.sources ?? []) {
      const levelCode = source.subjectCode.startsWith('900') ? '0' : occupationLevel
      const official = officialDocuments.get(`${source.subjectCode}:${levelCode}`)
      if (!official) {
        missing.push({ examId: manifest.examId, subjectCode: source.subjectCode, levelCode })
      } else if (source.pdfFilename !== official.pdfFilename || (official.sha256 && source.sha256 !== official.sha256)) {
        mismatches.push({
          examId: manifest.examId,
          subjectCode: source.subjectCode,
          installed: source.pdfFilename,
          official: official.pdfFilename,
          officialUrl: official.officialUrl,
          reason: source.pdfFilename !== official.pdfFilename ? 'filename' : 'sha256',
          ...(official.sha256 ? { installedSha256: source.sha256, officialSha256: official.sha256 } : {}),
        })
      }
    }
  }
  return { ok: mismatches.length === 0 && missing.length === 0, mismatches, missing }
}

export async function hashInstalledOfficialDocuments(documents, manifests, fetchFn = fetch, concurrency = 4) {
  const installedSources = manifests.flatMap((manifest) => manifest.sources ?? [])
  const installedUrls = new Set(installedSources.map((source) => source.officialUrl))
  const byKey = new Map(documents.map((document) => [`${document.subjectCode}:${document.levelCode}`, document]))
  for (const source of installedSources) {
    if (!source.subjectCode.startsWith('900') || byKey.has(`${source.subjectCode}:0`)) continue
    byKey.set(`${source.subjectCode}:0`, {
      subjectCode: source.subjectCode,
      title: '職類共同科目',
      levelCode: '0',
      level: '共同科目',
      version: source.version,
      pdfFilename: source.pdfFilename,
      officialUrl: source.officialUrl,
      effectiveFrom: null,
      effectiveFromRoc: null,
      remark: 'WDA occupation catalog does not enumerate this common bank; verified from its official WDA file URL.',
    })
  }
  const mergedDocuments = [...byKey.values()]
  const targets = mergedDocuments.filter((document) => installedUrls.has(document.officialUrl))
  const hashed = await mapConcurrent(targets, concurrency, async (document) => {
    const response = await fetchFn(document.officialUrl)
    if (!response.ok) throw new Error(`${document.pdfFilename} returned HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`${document.pdfFilename} response is not a PDF`)
    }
    return { ...document, sha256: createHash('sha256').update(bytes).digest('hex') }
  })
  for (const document of hashed) byKey.set(`${document.subjectCode}:${document.levelCode}`, document)
  return [...byKey.values()]
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

async function fetchRows(fetchFn, effectiveRocDate, entry) {
  const response = await fetchFn(WDA_AJAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sPLACRTDAY: effectiveRocDate, sPROFID: entry.code, sMYLEVEL: entry.levelCode }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.successYN !== 1 || !Array.isArray(payload.Jsondt)) {
    throw new Error(payload.Msg || 'Unexpected WDA response')
  }
  return payload.Jsondt
}

export async function collectWdaCatalog({ fetchFn = fetch, concurrency = 4 } = {}) {
  const indexResponse = await fetchFn(WDA_INDEX_URL)
  if (!indexResponse.ok) throw new Error(`WDA catalog returned HTTP ${indexResponse.status}`)
  const parsed = parseWdaCatalogIndex(await indexResponse.text())
  if (!parsed.effectiveRocDate) throw new Error('WDA catalog did not expose an effective date')

  const errors = []
  const collected = await mapConcurrent(parsed.entries, concurrency, async (entry) => {
    try {
      const rows = await fetchRows(fetchFn, parsed.effectiveRocDate, entry)
      return { entry, rows }
    } catch (error) {
      errors.push({ code: entry.code, level: entry.level, message: error instanceof Error ? error.message : String(error) })
      return { entry, rows: [] }
    }
  })

  const documents = new Map()
  const entries = collected.map(({ entry, rows }) => {
    const current = selectCurrentTheoryPdf(rows, entry.code, entry.levelCode, parsed.effectiveRocDate)
    if (current) documents.set(`${entry.code}:${entry.levelCode}`, current)
    for (const row of rows) {
      if (!String(row.PROFID).startsWith('900')) continue
      const shared = selectCurrentTheoryPdf(rows, row.PROFID, '0', parsed.effectiveRocDate)
      if (shared) documents.set(`${row.PROFID}:0`, shared)
    }
    return { ...entry, current }
  })

  return {
    generatedAt: new Date().toISOString(),
    source: WDA_INDEX_URL,
    authority: 'official-primary',
    effectiveRocDate: parsed.effectiveRocDate,
    effectiveDate: parseRocDate(parsed.effectiveRocDate),
    entryCount: entries.length,
    documentCount: documents.size,
    errors,
    entries,
    documents: [...documents.values()].sort((a, b) => `${a.subjectCode}:${a.levelCode}`.localeCompare(`${b.subjectCode}:${b.levelCode}`)),
  }
}

async function loadInstalledManifests() {
  const root = new URL('../public/data/exams/', import.meta.url)
  return Promise.all((await readdir(root)).map(async (directory) => (
    JSON.parse(await readFile(new URL(`${directory}/manifest.json`, root), 'utf8'))
  )))
}

function examLevelCodes(manifests) {
  return new Map(manifests.map((manifest) => [manifest.examId, Object.entries(LEVELS).find(([, level]) => level === manifest.level)?.[0]]))
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const catalog = await collectWdaCatalog()
  const manifests = await loadInstalledManifests()
  if (args.has('--hash')) {
    catalog.documents = await hashInstalledOfficialDocuments(catalog.documents, manifests)
  }
  const documentMap = new Map(catalog.documents.map((document) => [`${document.subjectCode}:${document.levelCode}`, document]))
  const drift = buildDriftReport(manifests, documentMap, examLevelCodes(manifests))
  const output = { ...catalog, installedDrift: drift }

  if (args.has('--write')) {
    await writeFile(new URL('../source/wda-catalog.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`)
  }
  console.log(`WDA: ${catalog.entryCount} exam levels; ${catalog.documentCount} current PDFs; ${catalog.errors.length} errors`)
  for (const mismatch of drift.mismatches) {
    console.error(`STALE ${mismatch.examId}/${mismatch.subjectCode}: ${mismatch.installed} -> ${mismatch.official}`)
  }
  for (const missing of drift.missing) {
    console.error(`MISSING ${missing.examId}/${missing.subjectCode}:${missing.levelCode}`)
  }
  if (catalog.errors.length || !drift.ok) process.exitCode = 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) await main()
