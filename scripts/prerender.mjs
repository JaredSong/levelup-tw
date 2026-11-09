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

const { renderLanding, renderLandingEn, renderExamPage, renderGuidePage, renderCatalogPage, EXAM_META, EN_FAQ_JSONLD, EN_APP_DESCRIPTION, GUIDE_FAQ_JSONLD, CATALOG_TITLE, CATALOG_DESC, CATALOG_ITEMLIST_JSONLD, SITE_ORIGIN, EN_PATH, EN_TITLE, GUIDE_PATH, CATALOG_PATH } = await import(new URL('entry-prerender.js', SSR_OUT))

// Every public URL below uses the trailing-slash form from src/app/seoUrls.ts —
// the spelling Cloudflare Pages serves without a 308 (see that file).
const EN_URL = `${SITE_ORIGIN}${EN_PATH}`
const GUIDE_URL = `${SITE_ORIGIN}${GUIDE_PATH}`
const CATALOG_URL = `${SITE_ORIGIN}${CATALOG_PATH}`

const GUIDE_TITLE = '免費技能檢定題庫：線上刷題與模擬考完整指南 - 升級吧'
const GUIDE_DESC = '技術士技能檢定學科題庫是官方公開的，可以免費線上練習。本指南說明題庫哪裡找、怎麼免費刷題、學科怎麼準備，並比較官方 PDF、線上刷題與付費題庫。'
const GUIDE_OG_TITLE = '免費技能檢定題庫：線上刷題完整指南 · 升級吧'

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

// Preserve the PWA's existing /app URL. Its direct response has no marketing
// content and is crawlable so search engines can see noindex.
const appDir = new URL('../dist/app/', import.meta.url)
mkdirSync(appDir, { recursive: true })
let app = base.replace(/(<meta name="robots" content=")[^"]*(")/, '$1noindex, follow$2')
app = app.replace(/<title>[^<]*<\/title>/, '<title>我的練習 · 升級吧</title>')
app = app.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1https://levelup.tw/app$2')
app = app.replace(/\n\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
app = app.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
writeFileSync(new URL('index.html', appDir), app)

// --- English page at /en ---
let en = base
en = replaceOnce(en, /<html lang="zh-Hant-TW">/, '<html lang="en">', '<html lang>')
en = replaceOnce(en, /<title>[^<]*<\/title>/, `<title>${EN_TITLE}</title>`, '<title>')
en = replaceOnce(en, /(<meta name="description" content=")[^"]*(")/, `$1${EN_DESC}$2`, 'meta description')
en = replaceOnce(en, /(<link rel="canonical" href=")[^"]*(")/, `$1${EN_URL}$2`, 'canonical')
en = replaceOnce(en, /(<meta property="og:url" content=")[^"]*(")/, `$1${EN_URL}$2`, 'og:url')
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
  const url = `${SITE_ORIGIN}${m.path}`
  const count = m.count.toLocaleString('en-US')
  const title = m.title
  const desc = `${m.titleZh}（${m.subjectCode}）學科題庫，共 ${count} 題。查看官方題庫 PDF 與來源版本，免費線上練習、錯題複習與計時模擬考；免註冊，進度保存在裝置。`
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
  // mirrors the on-page trail (首頁 › 考科題庫 › <exam>) plus this exam's own
  // FAQPage, built by the same function as the visible Q&As (src/app/examFaqs.ts).
  const breadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://levelup.tw/' },
      { '@type': 'ListItem', position: 2, name: '考科題庫', item: CATALOG_URL },
      { '@type': 'ListItem', position: 3, name: `${m.titleZh}學科題庫` },
    ],
  }, null, 2)
  h = replaceOnce(
    h,
    /<!-- faq-jsonld:start -->[\s\S]*?<!-- faq-jsonld:end -->/,
    `<!-- faq-jsonld:start -->\n    <script type="application/ld+json">\n${breadcrumb}\n    </script>\n    <script type="application/ld+json">\n${m.faqJsonLd}\n    </script>\n    <!-- faq-jsonld:end -->`,
    'exam FAQ→breadcrumb + exam FAQ',
  )
  return h
}

for (const m of EXAM_META) {
  const dir = new URL(`../dist/exam/${m.id}/`, import.meta.url)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('index.html', dir), inject(examHead(base, m), renderExamPage(m.id), 'exam-hero'))
}

// --- AEO guide page at /guide ---
let guide = base
guide = replaceOnce(guide, /<title>[^<]*<\/title>/, `<title>${GUIDE_TITLE}</title>`, 'guide <title>')
guide = replaceOnce(guide, /(<meta name="description" content=")[^"]*(")/, `$1${GUIDE_DESC}$2`, 'guide description')
guide = replaceOnce(guide, /(<link rel="canonical" href=")[^"]*(")/, `$1${GUIDE_URL}$2`, 'guide canonical')
guide = replaceOnce(guide, /(<meta property="og:url" content=")[^"]*(")/, `$1${GUIDE_URL}$2`, 'guide og:url')
guide = replaceOnce(guide, /(<meta property="og:title" content=")[^"]*(")/, `$1${GUIDE_OG_TITLE}$2`, 'guide og:title')
guide = replaceOnce(guide, /(<meta property="og:description" content=")[^"]*(")/, `$1${GUIDE_DESC}$2`, 'guide og:description')
guide = replaceOnce(guide, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${GUIDE_OG_TITLE}$2`, 'guide twitter:title')
guide = replaceOnce(guide, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${GUIDE_DESC}$2`, 'guide twitter:description')
guide = guide.replace(/\n\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
guide = replaceOnce(
  guide,
  /<!-- faq-jsonld:start -->[\s\S]*?<!-- faq-jsonld:end -->/,
  `<!-- faq-jsonld:start -->\n    <script type="application/ld+json">\n${GUIDE_FAQ_JSONLD}\n    </script>\n    <!-- faq-jsonld:end -->`,
  'guide FAQ JSON-LD',
)
const guideDir = new URL('../dist/guide/', import.meta.url)
mkdirSync(guideDir, { recursive: true })
writeFileSync(new URL('index.html', guideDir), inject(guide, renderGuidePage(), 'guide-lead'))

// --- Exam catalog at /exams/ (the hub linking every exam page) ---
let catalog = base
catalog = replaceOnce(catalog, /<title>[^<]*<\/title>/, `<title>${CATALOG_TITLE}</title>`, 'catalog <title>')
catalog = replaceOnce(catalog, /(<meta name="description" content=")[^"]*(")/, `$1${CATALOG_DESC}$2`, 'catalog description')
catalog = replaceOnce(catalog, /(<link rel="canonical" href=")[^"]*(")/, `$1${CATALOG_URL}$2`, 'catalog canonical')
catalog = replaceOnce(catalog, /(<meta property="og:url" content=")[^"]*(")/, `$1${CATALOG_URL}$2`, 'catalog og:url')
catalog = replaceOnce(catalog, /(<meta property="og:title" content=")[^"]*(")/, `$1${CATALOG_TITLE}$2`, 'catalog og:title')
catalog = replaceOnce(catalog, /(<meta property="og:description" content=")[^"]*(")/, `$1${CATALOG_DESC}$2`, 'catalog og:description')
catalog = replaceOnce(catalog, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${CATALOG_TITLE}$2`, 'catalog twitter:title')
catalog = replaceOnce(catalog, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${CATALOG_DESC}$2`, 'catalog twitter:description')
catalog = catalog.replace(/\n\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>/g, '')
const catalogBreadcrumb = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首頁', item: `${SITE_ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name: '考科題庫' },
  ],
}, null, 2)
catalog = replaceOnce(
  catalog,
  /<!-- faq-jsonld:start -->[\s\S]*?<!-- faq-jsonld:end -->/,
  `<!-- faq-jsonld:start -->\n    <script type="application/ld+json">\n${catalogBreadcrumb}\n    </script>\n    <script type="application/ld+json">\n${CATALOG_ITEMLIST_JSONLD}\n    </script>\n    <!-- faq-jsonld:end -->`,
  'catalog breadcrumb + ItemList',
)
const catalogDir = new URL('../dist/exams/', import.meta.url)
mkdirSync(catalogDir, { recursive: true })
writeFileSync(new URL('index.html', catalogDir), inject(catalog, renderCatalogPage(), 'catalog-hero'))

// --- Sitemap incl. every exam page, kept in sync with the published packs ---
// Omit optional lastmod until we have per-page content revision dates.
// A rebuild is not a significant update to every exam page.
const pairAlt = `    <xhtml:link rel="alternate" hreflang="zh-Hant-TW" href="https://levelup.tw/" />\n    <xhtml:link rel="alternate" hreflang="en" href="${EN_URL}" />`
const entries = [
  `  <url>\n    <loc>https://levelup.tw/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n${pairAlt}\n  </url>`,
  `  <url>\n    <loc>${EN_URL}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n${pairAlt}\n  </url>`,
  `  <url>\n    <loc>${CATALOG_URL}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`,
  `  <url>\n    <loc>${GUIDE_URL}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
  ...EXAM_META.map((m) => `  <url>\n    <loc>${SITE_ORIGIN}${m.path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), sitemap)

// --- llms.txt: a Markdown map of the site for AI agents (llmstxt.org). Built
// from the same EXAM_META as the sitemap, so it can never drift from the packs. ---
const llmsExamLines = EXAM_META
  .map((m) => `- [${m.titleZh}學科題庫](${SITE_ORIGIN}${m.path}): 官方公開學科題庫（${m.subjectCode}），共 ${m.count.toLocaleString('en-US')} 題，可免費線上練習。`)
  .join('\n')
const llms = `# 升級吧 Level Up

> 免費、免註冊、可離線的技術士技能檢定學科題庫。題目整理自勞動部勞動力發展署技能檢定中心公開的學科題庫；練習時寫錯的自動進錯題本、快忘的依遺忘曲線排進複習、考前用計時模擬考驗收。個人專案，不隸屬於官方機構，一切以官方最新公告為準。

## 指南
- [免費技能檢定題庫：線上刷題與模擬考完整指南](${GUIDE_URL}): 技能檢定學科題庫哪裡找、怎麼免費刷題、學科怎麼準備，以及官方 PDF、線上刷題與付費題庫的比較。

## 考科題庫
- [技能檢定學科題庫總覽](${CATALOG_URL}): 全部考科依職類與級別分類，可用名稱或代碼搜尋。
${llmsExamLines}
`
writeFileSync(new URL('../dist/llms.txt', import.meta.url), llms)

// Self-check: each indexable page's canonical must be exactly its own sitemap
// <loc>, and in the trailing-slash form Pages serves without a redirect. A
// mismatch splits indexing across two URLs, so fail the build instead.
const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]))
const indexable = [
  ['dist/index.html', `${SITE_ORIGIN}/`],
  ['dist/en/index.html', EN_URL],
  ['dist/guide/index.html', GUIDE_URL],
  ['dist/exams/index.html', CATALOG_URL],
  ...EXAM_META.map((m) => [`dist${m.path}index.html`, `${SITE_ORIGIN}${m.path}`]),
]
for (const [file, expected] of indexable) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]
  if (canonical !== expected) throw new Error(`prerender: ${file} canonical is ${canonical}, expected ${expected}`)
  if (!expected.endsWith('/')) throw new Error(`prerender: ${expected} must use the trailing-slash form`)
  if (!sitemapLocs.has(expected)) throw new Error(`prerender: ${expected} is missing from sitemap.xml`)
}
if (sitemapLocs.size !== indexable.length) {
  throw new Error(`prerender: sitemap has ${sitemapLocs.size} URLs but ${indexable.length} indexable pages were written`)
}
// functions/_middleware.js tells a real exam page from the SPA fallback by the
// "exam-hero" marker. If the landing ever carried it, unknown /exam/ URLs would
// silently go back to 200 soft-404s.
if (readFileSync(INDEX, 'utf8').includes('exam-hero')) {
  throw new Error('prerender: dist/index.html contains "exam-hero" — the unknown-exam 404 in functions/_middleware.js would stop working')
}

rmSync(SSR_OUT, { recursive: true, force: true })
console.log(`prerender: wrote zh + en landings, the exam catalog, ${EXAM_META.length} exam pages, sitemap, and llms.txt`)
