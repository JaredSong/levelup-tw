import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OptionSymbolText } from './OptionSymbolText'

// renderToStaticMarkup prepends an image preload <link>; only the span matters here.
const render = (text: string) => renderToStaticMarkup(<OptionSymbolText symbol="/s.png" text={text} />).replace(/^<link[^>]*>/, '')

describe('OptionSymbolText', () => {
  it('puts the symbol inside the empty 「」 the official text leaves for it', () => {
    const html = render('「」表示溫度計')
    expect(html).toMatch(/^<span class="option-symbol-inline">「<img class="option-symbol" src="\/s.png" alt=""\/>」/)
    expect(html).toContain('表示溫度計')
    expect(html).not.toContain('「」')
  })

  it('keeps text before the brackets in place', () => {
    const html = render('②「」表示電磁閥')
    expect(html.indexOf('②')).toBeLessThan(html.indexOf('<img'))
  })

  it('shows the symbol before the text when there are no brackets', () => {
    const html = render('表示鋼筋混凝土')
    expect(html).toMatch(/^<span class="option-symbol-row"><img/)
  })
})
