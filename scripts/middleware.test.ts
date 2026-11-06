import { describe, expect, it } from 'vitest'
import { markUnknownExamPage, onRequest } from '../functions/_middleware.js'

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
const get = (path: string, method = 'GET') => new Request(`https://levelup.tw${path}`, { method })

describe('unknown exam pages', () => {
  it('turns the SPA fallback under /exam/ into a noindex 404 that keeps the landing body', async () => {
    const res = await markUnknownExamPage(get('/exam/nope/'), html('<div class="landing-hero">landing</div>'))
    expect(res.status).toBe(404)
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(await res.text()).toContain('landing-hero')
  })

  it('applies to the bare spelling and to HEAD', async () => {
    expect((await markUnknownExamPage(get('/exam/nope'), html('landing'))).status).toBe(404)
    expect((await markUnknownExamPage(get('/exam/nope/', 'HEAD'), html('landing'))).status).toBe(404)
  })

  it('passes a real prerendered exam page through untouched', async () => {
    const page = html('<section class="exam-hero exam-hero-split">烘焙</section>')
    const res = await markUnknownExamPage(get('/exam/baking-food-c/'), page)
    expect(res).toBe(page)
  })

  it('leaves redirects, assets and other routes alone', async () => {
    const redirect = new Response(null, { status: 308, headers: { location: '/exam/baking-food-c/' } })
    expect(await markUnknownExamPage(get('/exam/baking-food-c'), redirect)).toBe(redirect)
    const landing = html('landing')
    expect(await markUnknownExamPage(get('/'), landing)).toBe(landing)
    const nested = html('landing')
    expect(await markUnknownExamPage(get('/exam/a/b'), nested)).toBe(nested)
    const json = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    expect(await markUnknownExamPage(get('/exam/x/'), json)).toBe(json)
  })

  it('still redirects non-canonical hosts before anything else', async () => {
    const res = await onRequest({
      request: new Request('https://www.levelup.tw/exam/nope/'),
      next: async () => html('landing'),
    })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://levelup.tw/exam/nope/')
  })
})
