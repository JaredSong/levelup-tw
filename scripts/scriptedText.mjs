// Restore the sub/superscripts pdftotext -layout flattens, using the PDF's own
// word boxes as evidence.
//
// `pdftotext -layout` prints `H₂SO₄` as `H 2 SO 4` and `8×10⁻³⁷` as
// `8×10 - 3 7`, which reads as "8×10 minus 37" — a correctness problem, not
// cosmetics. `pdftotext -bbox` keeps each glyph run's box, so a run that is
// clearly smaller than the line's text and sits right against its neighbour is
// a script; its centre above or below the base decides sup or sub.
//
// The repair only ever (a) swaps a scripted character for its Unicode
// sub/superscript form and (b) drops whitespace the PDF does not have between
// a script and the glyph it is attached to. `scriptInvariant` undoes both, so a
// test can prove the scripted text loses or adds nothing.
//
// Usage: node scripts/scriptedText.mjs <stem>
//   reads  source/<stem>.pdf and source/<stem>-raw.txt (pdftotext -layout)
//   writes source/<stem>-scripted-raw.txt and prints a report

import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPERSCRIPT = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '－': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
}
const SUBSCRIPT = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
  '+': '₊', '-': '₋', '−': '₋', '－': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ',
  i: 'ᵢ', r: 'ᵣ', u: 'ᵤ', v: 'ᵥ', j: 'ⱼ',
}
const BACK = new Map([
  ...Object.entries(SUPERSCRIPT).map(([plain, sup]) => [sup, plain === '−' || plain === '－' ? '-' : plain]),
  ...Object.entries(SUBSCRIPT).map(([plain, sub]) => [sub, plain === '−' || plain === '－' ? '-' : plain]),
])

/** A run counts as scripted below this fraction of the page's body text height. */
const SCRIPT_HEIGHT_RATIO = 0.8
/** Gaps under this many points are glyphs touching, not a typed space. */
const JOIN_GAP = 2.5

/** Map scripted text back to plain characters and drop all whitespace. */
export function scriptInvariant(text) {
  return [...text].map((char) => BACK.get(char) ?? char).join('')
    .replace(/[−－]/g, '-').replace(/\s+/g, '')
}

export function parseBboxWords(bboxXml) {
  const pages = []
  let words = null
  for (const line of bboxXml.split('\n')) {
    if (line.includes('<page ')) {
      words = []
      pages.push(words)
      continue
    }
    const match = line.match(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*)<\/word>/)
    if (!match || !words) continue
    const [x0, y0, x1, y1] = match.slice(1, 5).map(Number)
    words.push({ x0, y0, x1, y1, h: y1 - y0, cy: (y0 + y1) / 2, text: decodeEntities(match[5]) })
  }
  return pages
}

function decodeEntities(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function bodyHeight(words) {
  const counts = new Map()
  for (const word of words) {
    const key = Math.round(word.h * 2) / 2
    counts.set(key, (counts.get(key) ?? 0) + word.text.length)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
}

/** b starts right where a ends, on the same line (scripts sit off the baseline, so compare centres). */
const touches = (a, b, body) => Boolean(a && b) && b.x0 >= a.x1 - 0.5 && b.x0 - a.x1 < JOIN_GAP && Math.abs(a.cy - b.cy) < body

/**
 * Mark each word of a page: `kind` is 'sup', 'sub' or undefined, and `joinLeft`
 * says the word touches the one before it (no typed space between them).
 */
export function classifyPage(words) {
  const body = bodyHeight(words)
  const marked = words.map((word) => ({ ...word }))
  for (let index = 0; index < marked.length; index += 1) {
    const word = marked[index]
    const prev = marked[index - 1]
    if (touches(prev, word, body)) word.joinLeft = true
    if (word.h >= SCRIPT_HEIGHT_RATIO * body) continue
    // Unit squares like ㎝ carry wide side bearing, so a script hangs further off them.
    if (!word.joinLeft && /[\u3380-\u33ff]$/.test(prev?.text ?? '') && prev.h >= SCRIPT_HEIGHT_RATIO * body && touches(prev, { ...word, x0: word.x0 - body / 2 + JOIN_GAP }, body)) word.joinLeft = true
    // Find the full-size glyph this run hangs off: walk left through touching runs.
    let base
    for (let back = index - 1; back >= 0; back -= 1) {
      const candidate = marked[back]
      const next = marked[back + 1]
      if (!touches(candidate, next, body) && !(next === word && word.joinLeft)) break
      if (candidate.h >= SCRIPT_HEIGHT_RATIO * body) { base = candidate; break }
    }
    if (!base) {
      // A script can also lead its base (an isotope's mass number, ¹⁰B); look right.
      for (let ahead = index + 1; ahead < marked.length; ahead += 1) {
        if (!touches(marked[ahead - 1], marked[ahead], body)) break
        if (marked[ahead].h >= SCRIPT_HEIGHT_RATIO * body) { base = marked[ahead]; break }
      }
    }
    if (!base) {
      // An exponent the PDF wraps onto the next line (`4×10⁻` / `⁹`): a run at the
      // start of a line, the same size as the script that ended the line above.
      if (prev?.kind && word.x0 < prev.x0 && Math.abs(word.h - prev.h) < 0.3 && word.y0 > prev.y1 - 1) {
        word.kind = prev.kind
        word.joinLeft = true
      }
      continue
    }
    word.kind = word.cy < base.cy - 1 ? 'sup' : word.cy > base.cy + 1 ? 'sub' : undefined
  }
  return marked
}

/**
 * Rewrite one page of -layout text. Words are found in order from a moving
 * cursor; a word that can't be found nearby is reported and skipped, never
 * guessed at.
 */
export function restorePage(rawPage, words, pageNumber) {
  const marked = classifyPage(words)
  const edits = []
  const problems = []
  let cursor = 0
  const located = []
  const used = []
  const free = (start, end) => !used.some((span) => start < span.end && end > span.start)
  for (const word of marked) {
    let at = rawPage.indexOf(word.text, cursor)
    if (at === -1 || at - cursor > 400) {
      // Reading order differs between -bbox and -layout around wrapped lines:
      // take the unused occurrence closest to the cursor, in either direction.
      at = -1
      for (let from = rawPage.indexOf(word.text); from !== -1; from = rawPage.indexOf(word.text, from + 1)) {
        if (free(from, from + word.text.length) && (at === -1 || Math.abs(from - cursor) < Math.abs(at - cursor))) at = from
      }
    }
    if (at === -1) {
      if (word.kind) problems.push({ page: pageNumber, text: word.text, reason: 'not found in layout text' })
      located.push(undefined)
      continue
    }
    const span = { start: at, end: at + word.text.length }
    used.push(span)
    located.push(span)
    cursor = span.end
  }
  let scripted = 0
  for (let index = 0; index < marked.length; index += 1) {
    const word = marked[index]
    const span = located[index]
    if (!span || !word.kind) continue
    const table = word.kind === 'sup' ? SUPERSCRIPT : SUBSCRIPT
    const converted = [...word.text].map((char) => table[char])
    if (converted.some((char) => char === undefined)) {
      problems.push({ page: pageNumber, text: word.text, kind: word.kind, reason: 'no Unicode form', context: rawPage.slice(Math.max(0, span.start - 20), span.end + 10).replace(/\s+/g, ' ') })
      continue
    }
    // The script must sit right after the run it touches in the PDF (only
    // whitespace between them in the layout text); otherwise the match is a
    // different occurrence of the same characters and we leave it alone.
    const prevSpan = located[index - 1]
    const between = prevSpan ? rawPage.slice(prevSpan.end, span.start) : null
    if (word.joinLeft && (between === null || !/^\s*$/.test(between))) {
      problems.push({ page: pageNumber, text: word.text, kind: word.kind, reason: 'not next to its base in layout text', context: rawPage.slice(Math.max(0, span.start - 20), span.end + 10).replace(/\s+/g, ' ') })
      continue
    }
    scripted += 1
    edits.push({ start: span.start, end: span.end, text: converted.join('') })
    // Close the gaps the PDF doesn't have, on both sides of the script.
    if (word.joinLeft && between) edits.push({ start: prevSpan.end, end: span.start, text: '' })
    const next = marked[index + 1]
    const nextSpan = located[index + 1]
    if (next?.joinLeft && !next.kind && nextSpan && /^\s+$/.test(rawPage.slice(span.end, nextSpan.start))) {
      edits.push({ start: span.end, end: nextSpan.start, text: '' })
    }
  }
  const unique = [...new Map(edits.map((edit) => [`${edit.start}:${edit.end}`, edit])).values()]
    .sort((a, b) => b.start - a.start)
  let out = rawPage
  for (const edit of unique) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return { text: out, scripted, problems }
}

export function restoreScriptedText(raw, bboxXml) {
  const rawPages = raw.split('\f')
  const bboxPages = parseBboxWords(bboxXml)
  const problems = []
  let scripted = 0
  const pages = rawPages.map((rawPage, index) => {
    const words = bboxPages[index]
    if (!words) return rawPage
    const result = restorePage(rawPage, words, index + 1)
    scripted += result.scripted
    problems.push(...result.problems)
    return result.text
  })
  return { text: pages.join('\f'), scripted, problems, pageCount: { raw: rawPages.length, bbox: bboxPages.length } }
}

async function main() {
  const stem = process.argv[2]
  if (!stem) throw new Error('usage: node scripts/scriptedText.mjs <stem>')
  const pdf = fileURLToPath(new URL(`../source/${stem}.pdf`, import.meta.url))
  const raw = await readFile(new URL(`../source/${stem}-raw.txt`, import.meta.url), 'utf8')
  const bbox = execFileSync('pdftotext', ['-bbox', pdf, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const result = restoreScriptedText(raw, bbox)
  if (scriptInvariant(result.text) !== scriptInvariant(raw)) throw new Error(`${stem}: scripted text changed more than scripts and spacing`)
  await writeFile(new URL(`../source/${stem}-scripted-raw.txt`, import.meta.url), result.text)
  console.log(`${stem}: ${result.scripted} scripted runs, pages raw ${result.pageCount.raw} / bbox ${result.pageCount.bbox}, ${result.problems.length} problems`)
  for (const problem of result.problems) console.log('  ', JSON.stringify(problem))
}

// Compare paths, not URLs: a repo path with a space ("level b") is %20 in the URL.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main()
