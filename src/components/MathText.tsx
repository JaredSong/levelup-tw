import { createElement, Fragment, type ReactNode } from 'react'
import { splitMath, type MathNode } from '../domain/mathText'

/**
 * Question text with ⟦…⟧ formulas rendered as MathML (see domain/mathText).
 * Text without ⟦ renders exactly as before, as a plain string.
 */
export function MathText({ text }: { text: string }) {
  if (!text.includes('⟦')) return <>{text}</>
  return (
    <>
      {splitMath(text).map((segment, index) =>
        segment.kind === 'text'
          ? <Fragment key={index}>{segment.text}</Fragment>
          // displaystyle: fractions at full text size, as printed on the paper.
          : createElement('math', { key: index, className: 'inline-math', displaystyle: 'true' }, mathNode(segment.node)))}
    </>
  )
}

// ‾ draws a full-width bar in every math font; ¯ (macron) vanished over x in testing.
// ⏜ is the stretchy top arc; ⌒ came out as a small hat.
const ACCENT_MARK = { overline: '‾', arc: '⏜', bar: '‾' } as const

function mathNode(node: MathNode, key?: number): ReactNode {
  switch (node.kind) {
    case 'row':
      return createElement('mrow', { key }, node.children.map((child, index) => mathNode(child, index)))
    case 'num':
      return createElement('mn', { key }, node.text)
    case 'ident':
      return createElement('mi', { key }, node.text)
    case 'fn':
      // Upright function name with the thin space a reader expects before its argument.
      return createElement('mi', { key, mathvariant: 'normal', style: { paddingInlineEnd: '0.17em' } }, node.text)
    case 'op':
      return createElement('mo', { key }, node.text)
    case 'frac':
      return createElement('mfrac', { key }, mathNode(node.num), mathNode(node.den))
    case 'sqrt':
      return createElement('msqrt', { key }, mathNode(node.body))
    case 'sup':
      return createElement('msup', { key }, mathNode(node.base), mathNode(node.script))
    case 'sub':
      return createElement('msub', { key }, mathNode(node.base), mathNode(node.script))
    case 'over':
      return createElement('mover', { key, accent: 'true' }, mathNode(node.body), createElement('mo', { stretchy: 'true' }, ACCENT_MARK[node.accent]))
  }
}
