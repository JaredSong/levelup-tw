// Public URL + title shapes shared by the prerender (scripts/prerender.mjs via
// entry-prerender) and the runtime head updates in App.tsx, so the two can't drift.
//
// Trailing slashes are deliberate. Every prerendered page is a directory index
// (dist/exam/<id>/index.html, dist/en/index.html, dist/guide/index.html) and
// Cloudflare Pages answers the bare spelling with a 308 to the slashed one. A
// canonical, sitemap entry or internal link without the slash therefore points
// at a redirect, and Search Console indexed every exam page under both
// spellings, splitting its impressions.

export const SITE_ORIGIN = 'https://levelup.tw'
export const EN_PATH = '/en/'
export const GUIDE_PATH = '/guide/'
export const CATALOG_PATH = '/exams/'

/** The /exams/ <title>. Prerender writes it; App.tsx sets the same after hydration. */
export const catalogTitle = (examCount: number): string =>
  `技能檢定學科題庫總覽｜${examCount} 個考科免費線上練習 - 升級吧`

/** The /en <title>. Prerender writes it; App.tsx must set the same string after hydration. */
export const EN_TITLE = 'Level Up｜Taiwan Skills-Certification Written-Exam Question Bank · Free Offline Practice'

export const examPath = (examId: string): string => `/exam/${encodeURIComponent(examId)}/`

/** Fixed en-US grouping so the browser's locale can't render "1.187 題". */
export const formatQuestionCount = (count: number): string => count.toLocaleString('en-US')

export const examPageTitle = (titleZh: string, count: number): string =>
  `${titleZh}學科題庫｜${formatQuestionCount(count)} 題免費線上練習 - 升級吧`
