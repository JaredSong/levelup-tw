// Canonical-host redirect. levelup.tw is the one true host; the production
// pages.dev host and the www subdomain serve identical content, so a 301 from
// each consolidates SEO signals onto the real domain and sends old links there.
//
// Only these exact hosts redirect — preview deployments live at
// <hash>.levelup-tw.pages.dev and must keep working, and the canonical host plus
// local dev fall straight through.
const CANONICAL_HOST = 'levelup.tw'
const REDIRECT_HOSTS = new Set(['levelup-tw.pages.dev', 'www.levelup.tw'])

// Unknown exam pages. _redirects rewrites /exam/:id to its prerendered file and
// everything unmatched to the SPA landing, so /exam/<typo-or-removed-pack> came
// back 200 with the landing — a soft 404 that search engines index as a copy of
// the home page. Every real exam page is prerendered with the ExamPage hero
// (prerender.mjs fails the build without it), so a 200 HTML response under
// /exam/ that lacks it is the fallback. Keep the landing body (it still helps a
// person who mistyped) but say 404 and keep it out of the index.
const EXAM_PATH = /^\/exam\/[^/]+\/?$/
const EXAM_PAGE_SENTINEL = 'exam-hero'

export async function markUnknownExamPage(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return response
  if (!EXAM_PATH.test(new URL(request.url).pathname)) return response
  if (response.status !== 200) return response
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response
  const body = await response.clone().text()
  if (body.includes(EXAM_PAGE_SENTINEL)) return response
  const headers = new Headers(response.headers)
  headers.set('X-Robots-Tag', 'noindex')
  headers.set('Cache-Control', 'no-store')
  return new Response(request.method === 'HEAD' ? null : body, { status: 404, headers })
}

export const onRequest = async (context) => {
  const url = new URL(context.request.url)
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST
    url.protocol = 'https:'
    url.port = ''
    return Response.redirect(url.toString(), 301)
  }
  return markUnknownExamPage(context.request, await context.next())
}
