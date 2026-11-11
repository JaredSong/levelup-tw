// iOS 26 home-screen apps can launch with the layout viewport measured too
// short: `position: fixed; bottom: 0` then sits well above the real bottom of
// the screen, with a band of page background under the tab bar. Anything that
// changes the document's height makes WebKit measure again — switching tabs
// did, which is why the bar "came back" after a tab change. This does the same
// on launch and whenever the app returns to the foreground, so the learner
// never has to.

interface ViewportHost {
  innerHeight: number
  scrollY: number
  scrollTo: (x: number, y: number) => void
  requestAnimationFrame: (callback: () => void) => number
  setTimeout: (callback: () => void, ms: number) => number
  clearTimeout: (id: number) => void
  matchMedia: (query: string) => { matches: boolean }
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  navigator: { standalone?: boolean }
  document: {
    visibilityState: string
    body: { style: { minHeight: string }, offsetHeight: number } | null
    addEventListener: (type: string, listener: () => void) => void
    removeEventListener: (type: string, listener: () => void) => void
  }
}

export function isStandalone(host: Pick<ViewportHost, 'matchMedia' | 'navigator'>): boolean {
  return host.matchMedia('(display-mode: standalone)').matches || Boolean(host.navigator.standalone)
}

/** Force a fresh viewport measurement: grow the document by a pixel, read
 *  layout, restore, and nudge the scroll position back to where it was. */
export function remeasureViewport(host: ViewportHost): void {
  const body = host.document.body
  if (!body) return
  const previous = body.style.minHeight
  body.style.minHeight = `${host.innerHeight + 1}px`
  void body.offsetHeight
  body.style.minHeight = previous
  const y = host.scrollY
  host.scrollTo(0, y + 1)
  host.scrollTo(0, y)
}

export function installStandaloneViewportFix(host: ViewportHost): () => void {
  if (!isStandalone(host)) return () => {}
  // Two frames: the first lets the launch layout settle, the second runs after it.
  const schedule = () => { host.requestAnimationFrame(() => { host.requestAnimationFrame(() => remeasureViewport(host)) }) }
  const onVisible = () => { if (host.document.visibilityState === 'visible') schedule() }
  schedule()
  // iOS sometimes reports the final size a beat after the first frames.
  const late = host.setTimeout(() => remeasureViewport(host), 500)
  host.addEventListener('pageshow', schedule)
  host.addEventListener('orientationchange', schedule)
  host.document.addEventListener('visibilitychange', onVisible)
  return () => {
    host.clearTimeout(late)
    host.removeEventListener('pageshow', schedule)
    host.removeEventListener('orientationchange', schedule)
    host.document.removeEventListener('visibilitychange', onVisible)
  }
}
