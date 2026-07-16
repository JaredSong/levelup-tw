import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const TECHCERTI_ORIGIN = 'https://techcerti.bookmarks.tw'

function plainText(value) {
  return value
    .replace(/<!--.*?-->/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function numberFrom(text, pattern) {
  const match = text.match(pattern)
  return match ? Number(match[1].replaceAll(',', '')) : null
}

export function parseTechcertiCatalog(html) {
  const entries = []
  const anchorPattern = /<a\b[^>]*href="\/exams\/([^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/g
  let match

  while ((match = anchorPattern.exec(html)) !== null) {
    const [, slug, block] = match
    const text = plainText(block)
    const level = text.match(/(?:^|\s)(甲級|乙級|丙級|單一級)(?:\s|$)/)?.[1]
    const code = text.match(/(?:^|\s)(\d{5})(?:\s|$)/)?.[1]
    const title = block.match(/<h3\b[^>]*title="([^"]+)"/)?.[1]
    const questionCount = numberFrom(text, /([\d,]+)\s*題/)
    const sectionCount = numberFrom(text, /([\d,]+)\s*章節/)
    const version = text.match(/版本\s*(A\d+)/)?.[1]
    if (!level || !code || !title || questionCount === null || sectionCount === null || !version) continue

    entries.push({
      slug,
      url: `${TECHCERTI_ORIGIN}/exams/${slug}`,
      level,
      code,
      title,
      questionCount,
      sectionCount,
      version,
    })
  }

  const claimedTotal = numberFrom(html, /完整收錄[\s\S]{0,160}?<strong[^>]*>(\d+)<\/strong>/)
  const metadataTotal = numberFrom(html, /<meta[^>]+(?:name="description"[^>]+content|content="[^"]*"[^>]+name="description")[^>]*共\s*(\d+)\s*個/)
    ?? numberFrom(html, /<meta[^>]+content="[^"]*共\s*(\d+)\s*個[^"]*"/)
  const warnings = []
  if (claimedTotal !== null && metadataTotal !== null && claimedTotal !== metadataTotal) {
    warnings.push(`Rendered total ${claimedTotal} differs from metadata total ${metadataTotal}.`)
  }
  if (claimedTotal !== null && entries.length !== claimedTotal) {
    warnings.push(`Parsed ${entries.length} cards but the rendered page claims ${claimedTotal}.`)
  }

  return { claimedTotal, metadataTotal, entries, warnings }
}

export function buildCatalogCoverage(catalog, installedManifests) {
  const installed = new Map(installedManifests.map((manifest) => [
    `${manifest.occupationCode}:${manifest.level}`,
    manifest,
  ]))
  const entries = catalog.entries.map((entry) => {
    const manifest = installed.get(`${entry.code}:${entry.level}`)
    return {
      ...entry,
      installed: Boolean(manifest),
      ...(manifest ? {
        examId: manifest.examId,
        installedVersion: manifest.version,
        // A hint for discovery, never a publication signal: techcerti's own
        // metadata disagrees with its rendered page, so only the official WDA
        // catalog may decide whether an installed version is stale.
        versionMatchesTechcerti: manifest.version === entry.version,
      } : {}),
    }
  })
  return {
    catalogTotal: entries.length,
    installedCount: entries.filter((entry) => entry.installed).length,
    pendingCount: entries.filter((entry) => !entry.installed).length,
    entries,
  }
}

async function loadInstalledManifests() {
  const root = new URL('../public/data/exams/', import.meta.url)
  const directories = await readdir(root)
  return Promise.all(directories.map(async (directory) => {
    const manifest = JSON.parse(await readFile(new URL(`${directory}/manifest.json`, root), 'utf8'))
    const occupationSection = manifest.sections.find((section) => section.sourceGroup === 'occupation')
    return { ...manifest, occupationCode: occupationSection?.subjectCode }
  }))
}

async function main() {
  const response = await fetch(`${TECHCERTI_ORIGIN}/exams`)
  if (!response.ok) throw new Error(`Techcerti catalog returned HTTP ${response.status}`)
  const catalog = parseTechcertiCatalog(await response.text())
  const coverage = buildCatalogCoverage(catalog, await loadInstalledManifests())
  const output = {
    generatedAt: new Date().toISOString(),
    source: `${TECHCERTI_ORIGIN}/exams`,
    authority: 'secondary-discovery-only',
    claimedTotal: catalog.claimedTotal,
    metadataTotal: catalog.metadataTotal,
    warnings: catalog.warnings,
    ...coverage,
  }
  const outputPath = new URL('../source/techcerti-catalog.json', import.meta.url)
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  // "Pending" is an inventory of what exists, not an import queue: packs ship
  // when their keys verify, and the bottleneck is verification, not extraction.
  console.log(`Techcerti discovery inventory: ${output.catalogTotal} banks · ${output.installedCount} installed · ${output.pendingCount} pending (inventory, not a queue)`)
  for (const warning of output.warnings) console.warn(`Warning: ${warning}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) main()
