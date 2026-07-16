import { beforeEach, describe, expect, it } from 'vitest'
import { type Gtag, resetInitialViewForTests, trackEnterApp, trackInitialView } from './analytics'

/** Collects what would have been sent to GA4, with no DOM involved. */
function sink() {
  const hits: unknown[][] = []
  const gtag: Gtag = (...args) => { hits.push(args) }
  return { hits, gtag }
}

describe('analytics', () => {
  beforeEach(resetInitialViewForTests)

  // The whole point: a returning visitor is rendered into the app while the URL
  // stays "/", so reporting the URL would blend discovery with usage.
  it('reports the surface rendered, not the URL', () => {
    const { hits, gtag } = sink()
    trackInitialView('app', gtag)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.[0]).toBe('event')
    expect(hits[0]?.[1]).toBe('page_view')
    expect(hits[0]?.[2]).toMatchObject({ page_path: '/app' })
  })

  it('reports the landing as /', () => {
    const { hits, gtag } = sink()
    trackInitialView('landing', gtag)
    expect(hits[0]?.[2]).toMatchObject({ page_path: '/' })
  })

  it('sends at most one pageview per load', () => {
    const { hits, gtag } = sink()
    trackInitialView('landing', gtag)
    trackInitialView('app', gtag) // a re-render, or StrictMode's second effect pass
    expect(hits).toHaveLength(1)
    expect(hits[0]?.[2]).toMatchObject({ page_path: '/' })
  })

  it('counts entering the app as a conversion, not a pageview', () => {
    const { hits, gtag } = sink()
    trackEnterApp('beauty-c', gtag)
    expect(hits[0]?.[1]).toBe('enter_app')
    expect(hits[0]?.[2]).toMatchObject({ exam_id: 'beauty-c', from_featured_card: true })
  })

  it('marks the generic CTA as not coming from a card', () => {
    const { hits, gtag } = sink()
    trackEnterApp(undefined, gtag)
    expect(hits[0]?.[2]).toMatchObject({ exam_id: '(none)', from_featured_card: false })
  })

  // Analytics is blocked, offline or simply absent for most of a PWA's life.
  it('never throws when gtag is missing', () => {
    expect(() => trackInitialView('app', undefined)).not.toThrow()
    expect(() => trackEnterApp('web-design-b', undefined)).not.toThrow()
  })
})
