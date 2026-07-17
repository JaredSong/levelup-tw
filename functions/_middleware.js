// Canonical-host redirect. levelup.tw is the one true host; the production
// pages.dev host and the www subdomain serve identical content, so a 301 from
// each consolidates SEO signals onto the real domain and sends old links there.
//
// Only these exact hosts redirect — preview deployments live at
// <hash>.levelup-tw.pages.dev and must keep working, and the canonical host plus
// local dev fall straight through.
const CANONICAL_HOST = 'levelup.tw'
const REDIRECT_HOSTS = new Set(['levelup-tw.pages.dev', 'www.levelup.tw'])

export const onRequest = async (context) => {
  const url = new URL(context.request.url)
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST
    url.protocol = 'https:'
    url.port = ''
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
