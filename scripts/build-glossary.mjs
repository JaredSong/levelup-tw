import { readFile, writeFile } from 'node:fs/promises'

// Hybrid glossary: curated language content (human-approved) + auto-linked
// question IDs/sections computed from the active bank, so links never drift.
const curated = JSON.parse(await readFile(new URL('../source/glossary.curated.json', import.meta.url), 'utf8'))
const bank = JSON.parse(await readFile(new URL('../public/data/questions.json', import.meta.url), 'utf8'))
  .filter((question) => question.active !== false)

const MAX_IDS = 12

const glossary = curated.map((entry) => {
  const needles = [entry.term, ...(entry.aliases ?? [])].filter(Boolean)
  const qids = []
  const sections = new Set()
  for (const question of bank) {
    const haystack = [question.prompt, ...question.options].join('\n')
    if (needles.some((needle) => haystack.includes(needle))) {
      sections.add(question.section)
      if (qids.length < MAX_IDS) qids.push(question.id)
    }
  }
  return {
    term: entry.term,
    pinyin: entry.pinyin,
    en: entry.en,
    cue: entry.cue,
    aliases: entry.aliases ?? [],
    kind: entry.kind ?? 'term',
    sections: [...sections].sort(),
    qids,
  }
})

await writeFile(new URL('../public/data/glossary.json', import.meta.url), `${JSON.stringify(glossary)}\n`)

const linked = glossary.filter((entry) => entry.qids.length).length
const unlinked = glossary.filter((entry) => !entry.qids.length).map((entry) => entry.term)
console.log(JSON.stringify({ entries: glossary.length, linked, unlinkedCount: unlinked.length, unlinked }, null, 2))
