// Canonical-host redirect. levelup.tw and levelup-tw.pages.dev serve identical
// content; a 301 from the production pages.dev host consolidates SEO signals onto
// the real domain and sends old links/bookmarks there too.
//
// Only the *bare* production host is redirected — preview deployments live at
// <hash>.levelup-tw.pages.dev and must keep working, and the custom domains
// (levelup.tw, www.levelup.tw) plus local dev fall straight through.
const CANONICAL_HOST = 'levelup.tw'
const REDIRECT_HOSTS = new Set(['levelup-tw.pages.dev'])

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
