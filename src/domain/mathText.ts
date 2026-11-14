/**
 * Inline math in question text.
 *
 * Official PDFs draw some formulas as images (fractions with a bar, a root
 * sign over a whole product, a bar over a line segment). Typed as plain text
 * they lose that shape — 「1/3」 is not how the exam paper prints ⅓. Those
 * formulas are stored between ⟦ and ⟧ in a small LaTeX-like notation and
 * rendered as MathML, so they stay text (sharp, searchable) but look like the
 * paper:
 *
 *   ⟦\frac{1}{3}⟧  ⟦\sqrt{3^{2}×4^{2}×6}⟧  ⟦\overline{AB}⟧  ⟦\arc{AC}⟧  ⟦\bar{x}⟧
 *   ⟦\sin A⟧  ⟦x^{2}⟧  ⟦a_{1}⟧
 *
 * ⟦ ⟧ never occur in an official bank, so text without them is untouched.
 * Malformed math throws — the bank integrity test parses every question, so a
 * typo fails the build instead of reaching a learner.
 */

export type MathNode =
  | { kind: 'row'; children: MathNode[] }
  | { kind: 'num' | 'ident' | 'op' | 'fn'; text: string }
  | { kind: 'frac'; num: MathNode; den: MathNode }
  | { kind: 'sqrt'; body: MathNode }
  | { kind: 'sup' | 'sub'; base: MathNode; script: MathNode }
  | { kind: 'over'; body: MathNode; accent: 'overline' | 'arc' | 'bar' }

export type MathSegment = { kind: 'text'; text: string } | { kind: 'math'; node: MathNode; source: string }

const OPEN = '⟦'
const CLOSE = '⟧'
const FUNCTIONS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log']
const ACCENTS: Record<string, 'overline' | 'arc' | 'bar'> = { overline: 'overline', arc: 'arc', bar: 'bar' }

export function hasMath(text: string): boolean {
  return text.includes(OPEN)
}

export function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = []
  let rest = text
  while (rest) {
    const start = rest.indexOf(OPEN)
    const stray = rest.indexOf(CLOSE)
    if (stray !== -1 && (start === -1 || stray < start)) throw new Error(`math: ${CLOSE} without ${OPEN} in "${text}"`)
    if (start === -1) {
      segments.push({ kind: 'text', text: rest })
      break
    }
    if (start > 0) segments.push({ kind: 'text', text: rest.slice(0, start) })
    const end = rest.indexOf(CLOSE, start)
    if (end === -1) throw new Error(`math: unclosed ${OPEN} in "${text}"`)
    const source = rest.slice(start + 1, end)
    segments.push({ kind: 'math', node: parseMath(source), source })
    rest = rest.slice(end + 1)
  }
  return segments
}

export function parseMath(source: string): MathNode {
  let at = 0
  const fail = (why: string): never => {
    throw new Error(`math: ${why} at ${at} in "${source}"`)
  }

  function group(): MathNode {
    while (source[at] === ' ') at += 1
    if (source[at] !== '{') fail('expected {')
    at += 1
    const node = row('}')
    if (source[at] !== '}') fail('expected }')
    at += 1
    return node
  }

  function atom(): MathNode | null {
    const ch = source[at]
    if (ch === '\\') {
      const name = /^\\([a-zA-Z]+)/.exec(source.slice(at))?.[1] ?? fail('bad command')
      at += name.length + 1
      if (name === 'frac') return { kind: 'frac', num: group(), den: group() }
      if (name === 'sqrt') return { kind: 'sqrt', body: group() }
      if (ACCENTS[name]) return { kind: 'over', body: group(), accent: ACCENTS[name] }
      if (FUNCTIONS.includes(name)) return { kind: 'fn', text: name }
      if (name === 'pi') return { kind: 'ident', text: 'π' }
      if (name === 'theta') return { kind: 'ident', text: 'θ' }
      return fail(`unknown command \\${name}`)
    }
    if (/[0-9.]/.test(ch)) {
      const text = /^[0-9.]+/.exec(source.slice(at))![0]
      at += text.length
      return { kind: 'num', text }
    }
    if (/[a-zA-Z]/.test(ch)) {
      const fn = FUNCTIONS.find((name) => source.startsWith(name, at) && !/[a-zA-Z]/.test(source[at + name.length] ?? ''))
      if (fn) {
        at += fn.length
        return { kind: 'fn', text: fn }
      }
      at += 1
      return { kind: 'ident', text: ch }
    }
    if ('{}^_'.includes(ch)) fail(`unexpected ${ch}`)
    at += 1
    return { kind: /[πθα-ω]/.test(ch) ? 'ident' : 'op', text: ch }
  }

  function row(until?: string): MathNode {
    const children: MathNode[] = []
    while (at < source.length && source[at] !== until) {
      if (source[at] === ' ') {
        at += 1
        continue
      }
      if (source[at] === '^' || source[at] === '_') {
        const kind = source[at] === '^' ? 'sup' : 'sub'
        at += 1
        const base = children.pop() ?? fail(`${kind} without a base`)
        children.push({ kind, base, script: source[at] === '{' ? group() : (atom() ?? fail('empty script')) })
        continue
      }
      if (source[at] === '}') fail('unexpected }')
      const node = atom()
      if (node) children.push(node)
    }
    if (until === undefined && at < source.length) fail('trailing input')
    return children.length === 1 ? children[0] : { kind: 'row', children }
  }

  const node = row()
  if (node.kind === 'row' && !node.children.length) fail('empty math')
  return node
}

/** Readable plain text for places that can't show MathML: voice notes, export, search, meta. */
export function mathToPlain(text: string): string {
  return splitMath(text).map((segment) => (segment.kind === 'text' ? segment.text : plainNode(segment.node))).join('')
}

const SUPERSCRIPT: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '−': '⁻' }

function plainNode(node: MathNode): string {
  switch (node.kind) {
    case 'row':
      return node.children.map((child, index) => {
        const text = plainNode(child)
        return child.kind === 'fn' && index < node.children.length - 1 ? `${text} ` : text
      }).join('')
    case 'num':
    case 'ident':
    case 'op':
    case 'fn':
      return node.text
    case 'frac':
      return `${wrap(node.num)}/${wrap(node.den)}`
    case 'sqrt':
      return `√${wrap(node.body)}`
    case 'sup': {
      const script = plainNode(node.script)
      const small = [...script].every((ch) => SUPERSCRIPT[ch]) ? [...script].map((ch) => SUPERSCRIPT[ch]).join('') : `^(${script})`
      return `${wrap(node.base)}${small}`
    }
    case 'sub':
      return `${wrap(node.base)}_${wrap(node.script)}`
    case 'over':
      if (node.accent === 'arc') return `弧${plainNode(node.body)}`
      // Combining macron / overline after each letter: x̄, A̅B̅.
      return [...plainNode(node.body)].map((ch) => ch + (node.accent === 'bar' ? '\u0304' : '\u0305')).join('')
  }
}

function wrap(node: MathNode): string {
  const text = plainNode(node)
  return node.kind === 'row' && node.children.length > 1 ? `(${text})` : text
}
