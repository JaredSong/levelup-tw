// Injects server-rendered landing HTML into the built pages after `vite build`.
//
// Why: the app is a client-rendered SPA, so the built page ships an empty
// <div id="root"> — a crawler that doesn't execute JS sees no content at all.
// This renders src/entry-prerender.tsx (the landing page with the bundled exam
// manifests) via a throwaway SSR build and splices the markup into #root.
// main.tsx's createRoot().render() replaces it as soon as the bundle loads.
//
// Two pages come out of one base index.html:
//   dist/index.html      Traditional Chinese landing (canonical /)
//   dist/en/index.html   English landing (canonical /en), served by _redirects
// Both carry the same hreflang set; only the head (lang, title, description,
// canonical, og/twitter, locale) differs for the English page.
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const SSR_OUT = new URL('../dist-ssr/', import.meta.url)
const INDEX = new URL('../dist/index.html', import.meta.url)
const EN_DIR = new URL('../dist/en/', import.meta.url)
const EN_INDEX = new URL('../dist/en/index.html', import.meta.url)
const MARKER = '<div id="root"></div>'

const EN_TITLE = 'Level Up｜Taiwan Skills-Certification Written-Exam Question Bank · Free Offline Practice'
const EN_DESC = 'Free, offline-first question bank for Taiwan\'s national skills-certification (技術士技能檢定) written exams. Practise official questions with an automatic mistake book, spaced review and timed mock exams. No sign-up, progress stays on your device.'
const EN_OG_TITLE = 'Level Up · Taiwan skills-certification question bank'
const EN_OG_DESC = 'Drill the official questions until they stick. Free, offline-first, progress stays yours.'

execSync('npx vite build --ssr src/entry-prerender.tsx --outDir dist-ssr --emptyOutDir', {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
})

// renderToString never runs effects, but LandingPage reads the current theme
// during render — give it just enough DOM to answer "light".
globalThis.document = { documentElement: { dataset: { theme: 'light' } } }
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  scrollY: 0,
}

const { renderLanding, renderLandingEn } = await import(new URL('entry-prerender.js', SSR_OUT))

function inject(html, bodyHtml) {
  if (!bodyHtml.includes('landing-hero')) {
    throw new Error('prerender: rendered HTML is missing the landing hero — output looks wrong')
  }
  if (!html.includes(MARKER)) {
    throw new Error(`prerender: ${MARKER} not found in base index.html`)
  }
  return html.replace(MARKER, `<div id="root">${bodyHtml}</div>`)
}

// One attribute swap; throws if the tag it targets isn't found so a head change
// upstream can't silently leave the English page stale.
function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${label} to localise for /en`)
  return html.replace(pattern, replacement)
}

const base = readFileSync(INDEX, 'utf8')

// --- Chinese page (canonical) ---
writeFileSync(INDEX, inject(base, renderLanding()))

// --- English page at /en ---
let en = base
en = replaceOnce(en, /<html lang="zh-Hant-TW">/, '<html lang="en">', '<html lang>')
en = replaceOnce(en, /<title>[^<]*<\/title>/, `<title>${EN_TITLE}</title>`, '<title>')
en = replaceOnce(en, /(<meta name="description" content=")[^"]*(")/, `$1${EN_DESC}$2`, 'meta description')
en = replaceOnce(en, /(<link rel="canonical" href=")[^"]*(")/, '$1https://levelup.tw/en$2', 'canonical')
en = replaceOnce(en, /(<meta property="og:url" content=")[^"]*(")/, '$1https://levelup.tw/en$2', 'og:url')
en = replaceOnce(en, /(<meta property="og:locale" content=")[^"]*(")/, '$1en$2', 'og:locale')
en = replaceOnce(en, /(<meta property="og:title" content=")[^"]*(")/, `$1${EN_OG_TITLE}$2`, 'og:title')
en = replaceOnce(en, /(<meta property="og:description" content=")[^"]*(")/, `$1${EN_OG_DESC}$2`, 'og:description')
en = replaceOnce(en, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${EN_OG_TITLE}$2`, 'twitter:title')
en = replaceOnce(en, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${EN_OG_DESC}$2`, 'twitter:description')
en = inject(en, renderLandingEn())
mkdirSync(EN_DIR, { recursive: true })
writeFileSync(EN_INDEX, en)

rmSync(SSR_OUT, { recursive: true, force: true })
console.log('prerender: wrote dist/index.html (zh) and dist/en/index.html (en)')
