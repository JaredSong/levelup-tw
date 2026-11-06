import { describe, expect, it } from 'vitest'
import { buildPayload, findKey, sitemapUrls } from './indexnow.mjs'

describe('IndexNow submission', () => {
  it('finds the single public key file', () => {
    expect(findKey(['robots.txt', 'db269278c2c97390025cf2431c780927.txt', 'sitemap.xml'])).toBe('db269278c2c97390025cf2431c780927')
    expect(() => findKey(['robots.txt'])).toThrow()
  })

  it('ships exactly one key file from public/', () => {
    expect(findKey()).toMatch(/^[a-f0-9]{32}$/)
  })

  it('reads sitemap locs and only submits levelup.tw URLs', () => {
    const urls = sitemapUrls('<urlset><url><loc>https://levelup.tw/</loc></url><url><loc>https://levelup.tw/exam/a/</loc></url></urlset>')
    expect(urls).toEqual(['https://levelup.tw/', 'https://levelup.tw/exam/a/'])
    expect(buildPayload('k', urls)).toEqual({ host: 'levelup.tw', key: 'k', keyLocation: 'https://levelup.tw/k.txt', urlList: urls })
    expect(() => buildPayload('k', ['https://evil.example/'])).toThrow()
    expect(() => buildPayload('k', [])).toThrow()
  })
})
