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

const { renderLanding, renderLandingEn, renderExamPage, EXAM_META, EN_FAQ_JSONLD, EN_APP_DESCRIPTION } = await import(new URL('entry-prerender.js', SSR_OUT))

function inject(html, bodyHtml, sentinel = 'landing-hero') {
  if (!bodyHtml.includes(sentinel)) {
    throw new Error(`prerender: rendered HTML is missing "${sentinel}" — output looks wrong`)
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
// Structured data: everything is English on the English page. Swap the whole
// FAQ block via its markers, translate the WebApplication description, and flip
// every inLanguage (WebApplication, WebSite, FAQPage) to en.
en = replaceOnce(
  en,
  /<!-- faq-jsonld:start -->[\s\S]*?<!-- faq-jsonld:end -->/,
  `<!-- faq-jsonld:start -->\n    <script type="application/ld+json">\n${EN_FAQ_JSONLD}\n    </script>\n    <!-- faq-jsonld:end -->`,
  'FAQ JSON-LD block',
)
en = replaceOnce(en, /("@type": "WebApplication"[\s\S]*?"description": ")[^"]*(")/, `$1${EN_APP_DESCRIPTION}$2`, 'WebApplication description')
en = en.replaceAll('"inLanguage": "zh-Hant-TW"', '"inLanguage": "en"')
en = inject(en, renderLandingEn())
mkdirSync(EN_DIR, { recursive: true })
writeFileSync(EN_INDEX, en)

// --- Per-exam pages at /exam/<id> (Traditional Chinese, SEO landings) ---
function examHead(html, m) {
  const url = `https://levelup.tw/exam/${m.id}`
  const count = m.count.toLocaleString()
  const title = `${m.titleZh}學科題庫｜${count} 題免費線上練習 - 升級吧`
  const desc = `線上練習${m.titleZh}（${m.subjectCode}）的官方公開學科題庫，共 ${count} 題。寫錯自動進錯題本、依遺忘曲線排進複習、考前計時模擬考；免費、免註冊、可離線。`
  const ogTitle = `${m.titleZh}學科題庫 · 升級吧`
  let h = html
  h = replaceOnce(h, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'exam <title>')
  h = replaceOnce(h, /(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`, 'exam description')
  h = replaceOnce(h, /(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`, 'exam canonical')
  h = replaceOnce(h, /(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`, 'exam og:url')
  h = replaceOnce(h, /(<meta property="og:title" content=")[^"]*(")/, `$1${ogTitle}$2`, 'exam og:title')
  h = replaceOnce(h, /(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`, 'exam og:description')
  h = replaceOnce(h, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${ogTitle}$2`, 'exam twitter:title')
  h = replaceOnce(h, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${desc}$2`, 'exam twitter:description')
  // Exam pages are Chinese-only — drop the zh/en hreflang alternates.
  h = h.replace(/\n\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
  // The generic FAQ schema doesn't match an exam page; swap in a breadcrumb that
  // mirrors the on-page trail (首頁 › 考科題庫 › <exam>).
  const breadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://levelup.tw/' },
      { '@type': 'ListItem', position: 2, name: '考科題庫', item: 'https://levelup.tw/' },
      { '@type': 'ListItem', position: 3, name: `${m.titleZh}學科題庫` },
    ],
  }, null, 2)
  h = replaceOnce(
    h,
    /<!-- faq-jsonld:start -->[\s\S]*?<!-- faq-jsonld:end -->/,
    `<!-- faq-jsonld:start -->\n    <script type="application/ld+json">\n${breadcrumb}\n    </script>\n    <!-- faq-jsonld:end -->`,
    'exam FAQ→breadcrumb',
  )
  return h
}

for (const m of EXAM_META) {
  const dir = new URL(`../dist/exam/${m.id}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('index.html', dir), inject(examHead(base, m), renderExamPage(m.id), 'exam-hero'))
}

// --- Sitemap incl. every exam page, kept in sync with the published packs ---
const today = new Date().toISOString().slice(0, 10)
const pairAlt = '    <xhtml:link rel="alternate" hreflang="zh-Hant-TW" href="https://levelup.tw/" />\n    <xhtml:link rel="alternate" hreflang="en" href="https://levelup.tw/en" />'
const entries = [
  `  <url>\n    <loc>https://levelup.tw/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n${pairAlt}\n  </url>`,
  `  <url>\n    <loc>https://levelup.tw/en</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n${pairAlt}\n  </url>`,
  ...EXAM_META.map((m) => `  <url>\n    <loc>https://levelup.tw/exam/${m.id}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), sitemap)

rmSync(SSR_OUT, { recursive: true, force: true })
console.log(`prerender: wrote zh + en landings, ${EXAM_META.length} exam pages, and sitemap`)
