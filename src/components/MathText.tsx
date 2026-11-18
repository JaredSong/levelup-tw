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

// overline/arc stretch across a whole segment (A̅B̅, arc AC): ‾ and ⏜, stretchy.
// x̄ is a short accent: a non-stretchy macron, centred, lifted 0.14em so it
// clears the top of the x as on the printed paper (at rest it touched the x).
const ACCENT_MARK = { overline: '‾', arc: '⏜', bar: '¯' } as const
const BAR_LIFT = { position: 'relative', top: '-0.14em' } as const

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
      // x^{a}_{b}: both scripts stacked on one base (a toleranced size 30⁺⁰·⁰⁵₀).
      if (node.base.kind === 'sup') return createElement('msubsup', { key }, mathNode(node.base.base), mathNode(node.script), mathNode(node.base.script))
      return createElement('msub', { key }, mathNode(node.base), mathNode(node.script))
    case 'over':
      return createElement('mover', { key, accent: 'true' }, mathNode(node.body), createElement('mo', node.accent === 'bar' ? { stretchy: 'false', style: BAR_LIFT } : { stretchy: 'true' }, ACCENT_MARK[node.accent]))
  }
}
