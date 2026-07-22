// GA4's automatic pageview fires on script load, before React decides whether to
// render the landing or the app — and a returning visitor is rendered straight
// into the app while the URL stays "/". So the automatic hit records "/" for both
// "a stranger read the landing" and "the owner opened the app again", which are
// the two numbers worth telling apart.
//
// index.html therefore sets send_page_view: false, and we send one hit ourselves
// once the route is known, reporting what the visitor actually sees:
//   LANDING -> "/"      discovery
//   APP     -> "/app"   usage
// Cloudflare Web Analytics is URL-based and still conflates the two; it stays as
// a cross-check on totals rather than the funnel.
//
// The gtag sink is injected (defaulting to window.gtag) so this stays testable in
// a plain node environment, like clearCurrentProfile does with storage.

export type Gtag = (command: string, ...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: Gtag
  }
}

export type ViewedSurface = 'landing' | 'app'

const PATHS: Record<ViewedSurface, string> = {
  landing: '/',
  app: '/app',
}

function windowGtag(): Gtag | undefined {
  return typeof window === 'undefined' ? undefined : window.gtag
}

function pageLocation(path: string): string | undefined {
  return typeof window === 'undefined' ? undefined : `${window.location.origin}${path}`
}

function pageTitle(): string | undefined {
  return typeof document === 'undefined' ? undefined : document.title
}

let sent = false

/**
 * Report the surface the visitor actually landed on. Only the first call counts:
 * React StrictMode double-invokes effects in development, and re-renders must not
 * inflate the pageview.
 */
export function trackInitialView(
  surface: ViewedSurface,
  gtag: Gtag | undefined = windowGtag(),
  path: string = PATHS[surface],
): void {
  if (sent) return
  sent = true
  gtag?.('event', 'page_view', {
    page_path: path,
    page_location: pageLocation(path),
    page_title: pageTitle(),
  })
}

/**
 * Landing -> app. Not a pageview: the document never navigates, and counting it
 * as one would double-count the same visit. It is the landing's conversion, so
 * it carries which exam was picked (undefined = the generic CTA).
 */
export function trackEnterApp(examId?: string, gtag: Gtag | undefined = windowGtag()): void {
  gtag?.('event', 'enter_app', {
    exam_id: examId ?? '(none)',
    from_featured_card: Boolean(examId),
  })
}

/**
 * A landing-page engagement click (nav jump, CTA, install step, external link,
 * FAQ open, language switch…). Distinct from enter_app: this captures intent and
 * which element drew it, so the funnel shows what people actually poke at before
 * (or instead of) converting. `action` is the element; extra params add detail.
 */
export function trackLanding(
  action: string,
  params: Record<string, unknown> = {},
  gtag: Gtag | undefined = windowGtag(),
): void {
  gtag?.('event', 'landing_click', { action, ...params })
}

/**
 * An in-app usage milestone — a practice or mock session started or finished.
 * Deliberately count-only: it carries the session MODE (practice / mock / …) and
 * nothing else. No question ids, no answers, no scores, no progress — so it keeps
 * the privacy promise ("anonymous usage counts, never your answers") while still
 * turning enter_app into a real funnel: opened → practised → finished.
 */
export function trackAppMilestone(
  action: 'session_start' | 'session_done',
  mode: string,
  gtag: Gtag | undefined = windowGtag(),
): void {
  gtag?.('event', 'app_milestone', { action, mode })
}

/** Test seam: lets a test observe a fresh first call. */
export function resetInitialViewForTests(): void {
  sent = false
}
