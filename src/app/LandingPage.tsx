import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Github,
  Languages,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Share,
  ShieldCheck,
  Sun,
  Timer,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'
import { categoryIcon } from './categoryIcons'
import { ExamCard } from './ExamCard'
import { DEMAND_PERIOD, DEMAND_SOURCE, EN_CATEGORY, examCode, groupByCategory, matchesFilter, rankByDemand } from './examCatalog'
import { GENERATED_EXAM_SAMPLES } from './generatedExamSamples'
import { prefersReducedMotion, useAutoDrift, useCountUp } from './landingMotion'
import { applyTheme, currentTheme, type Theme } from './theme'
import { SupportPanel } from './SupportPanel'
import { QrSvg } from '../components/QrCode'
import { NATIONAL_EXAM_SCHEDULE_115, NATIONAL_EXAM_SCHEDULE_SOURCE, type NationalExamScheduleEntry } from './nationalExamSchedule'
import { CATALOG_PATH, EN_PATH, GUIDE_PATH, SITE_ORIGIN, examPath } from './seoUrls'
import { MathText } from '../components/MathText'

// zhTW.landing infers each value as its exact Chinese string *literal*, which an
// English translation can't satisfy. Widen literal strings to `string` while
// keeping the function-valued entries (examCount, examAction…) intact.
type WidenStrings<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R : string }
export type LandingStrings = WidenStrings<typeof zhTW.landing>
export type LandingLang = 'zh' | 'en'

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** How many exams the popular row shows, ranked by official 報檢人次. */
const POPULAR_COUNT = 8

const CJK_PUNCT = new Set(['，', '。', '！', '？', '；', '：', '、'])
/** Full-width CJK punctuation at display size leaves awkward gaps; wrap it so
    CSS can shrink the glyph without touching the copy itself. */
function displayText(text: string) {
  return text.split(/([，。！？；：、])/).map((part, index) =>
    CJK_PUNCT.has(part) ? <span className="landing-punct" key={index}>{part}</span> : part,
  )
}

// ROC (民國) year = Gregorian − 1911. Dates come from nationalExamSchedule.ts,
// the same official 簡章 data the app uses, so this section never drifts from it.
function rocDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y - 1911}年${m}月${d}日`
}
function engDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${EN_MONTHS[m - 1]} ${d}, ${y}`
}
function monthDayRange(startIso: string, endIso: string) {
  const md = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}` }
  return `${md(startIso)}–${md(endIso)}`
}
function scheduleLabel(entry: NationalExamScheduleEntry, lang: LandingLang) {
  return lang === 'en' ? `Round ${entry.round}, ${entry.year + 1911}` : entry.label
}
function writtenDate(iso: string, lang: LandingLang) {
  return lang === 'en' ? engDate(iso) : rocDate(iso)
}
/** "58,693" → "58,000+": a floor that stays true as banks grow between releases. */
function questionFloor(total: number) {
  return total >= 1000 ? `${Math.floor(total / 1000).toLocaleString('en-US')},000+` : String(total)
}

const REPO_URL = 'https://github.com/JaredSong/levelup-tw'

interface Props {
  exams: ExamManifest[]
  returning: boolean
  onEnter: (source: string) => void
  /** Landing copy for the active locale. Defaults to Traditional Chinese. */
  t?: LandingStrings
  /** Active locale — drives the language toggle target and date formatting. */
  lang?: LandingLang
}

/** Theme lives on <html data-theme>; the toggle records an explicit choice. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme)
  useEffect(() => setTheme(currentTheme()), [])
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }
  return [theme, toggle]
}

export function LandingPage({ exams, returning, onEnter, t = zhTW.landing, lang = 'zh' }: Props) {
  const [theme, toggleTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [showTop, setShowTop] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [tryPick, setTryPick] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const popularRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDListElement>(null)
  // Motion that only makes sense with JS and full motion: the popular row's
  // looping drift (needs its clone set) and the showcase autoplay.
  const [motionOk, setMotionOk] = useState(false)
  const [autoplay, setAutoplay] = useState(false)
  const [showcaseInView, setShowcaseInView] = useState(false)
  const showcaseRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    setMotionOk(true)
    setAutoplay(true)
  }, [])
  const wrapPopular = useAutoDrift(popularRef, motionOk)

  const navLinks = [
    { href: CATALOG_PATH, label: t.navCatalog },
    { href: '#landing-how', label: t.navHow },
    { href: '#landing-schedule', label: t.navSchedule },
    { href: '#landing-install', label: t.navInstall },
    { href: '#landing-faq', label: t.navFaq },
    { href: '#landing-donate', label: t.navDonate },
  ]

  // The loop, told with real app screens (public/screens, captured from the
  // current build in both themes).
  const steps = [
    { icon: BookOpenCheck, label: t.loopPractice, body: t.loopPracticeBody, shot: 'practice' },
    { icon: RotateCcw, label: t.loopRepair, body: t.loopRepairBody, shot: 'review' },
    { icon: Clock, label: t.loopRemember, body: t.loopRememberBody, shot: 'card' },
    { icon: Timer, label: t.loopVerify, body: t.loopVerifyBody, shot: 'mock' },
  ]

  const faqItems = [
    { q: t.faqOfficialQ, a: t.faqOfficialA },
    { q: t.faqFreeQ, a: t.faqFreeA },
    { q: t.faqAccountQ, a: t.faqAccountA },
    { q: t.faqSourceQ, a: t.faqSourceA },
    { q: t.faqProgressQ, a: t.faqProgressA },
    { q: t.faqExamsQ, a: t.faqExamsA },
  ]

  // The QR opens the site on a phone; keep it on whichever locale the visitor is
  // viewing so an English reader lands back on the English page.
  const siteUrl = lang === 'en' ? `${SITE_ORIGIN}${EN_PATH}` : `${SITE_ORIGIN}/`
  const otherLangHref = lang === 'en' ? '/' : EN_PATH
  const otherLangLabel = lang === 'en' ? '中文' : 'EN'

  const examTitle = (exam: ExamManifest) => (lang === 'en' ? exam.titleEn : exam.titleZh)
  const categoryName = (category: string) => (lang === 'en' ? EN_CATEGORY[category] ?? category : category)

  // Counts and lists all derive from the manifests, so a new pack needs no copy edit.
  const totalQuestions = useMemo(() => exams.reduce((sum, exam) => sum + exam.activeQuestionCount, 0), [exams])
  const popular = useMemo(() => rankByDemand(exams).slice(0, POPULAR_COUNT), [exams])
  const categories = useMemo(() => groupByCategory(exams), [exams])

  const statExams = useCountUp(exams.length, statsRef)
  const statThousands = useCountUp(Math.floor(totalQuestions / 1000), statsRef)

  // Showcase autoplay (step-progress): advance every few seconds while the
  // section is on screen; the first click on a step hands control to the visitor.
  useEffect(() => {
    const el = showcaseRef.current
    if (!el || !autoplay || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => setShowcaseInView(entries.some((entry) => entry.isIntersecting)), { threshold: 0.35 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [autoplay])

  // Hero "try one": the first sample of the most-registered exam that has one.
  // "換一題" steps through the popular exams that have verified samples.
  const tryExams = useMemo(() => popular.filter((exam) => GENERATED_EXAM_SAMPLES[exam.examId]?.samples.length), [popular])
  const [tryIndex, setTryIndex] = useState(0)
  const tryExam = tryExams.length ? tryExams[tryIndex % tryExams.length] : undefined
  const trySample = tryExam ? GENERATED_EXAM_SAMPLES[tryExam.examId].samples[0] : null
  const nextTry = () => {
    setTryIndex((index) => index + 1)
    setTryPick(null)
    trackLanding('try_next', { exam_id: tryExam?.examId ?? '' })
  }

  const searchResults = query.trim()
    ? exams.filter((exam) => matchesFilter(exam, { query, level: '', category: '' })).slice(0, 6)
    : []

  // The nearest upcoming round drives the schedule highlight. sv-SE gives local
  // YYYY-MM-DD. Once every listed round has passed, nothing is highlighted.
  const todayIso = new Date().toLocaleDateString('sv-SE')
  const nextScheduleId = NATIONAL_EXAM_SCHEDULE_115.find((entry) => entry.writtenDate >= todayIso)?.id

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Scroll-reveal: sections fade/slide in once as they enter the viewport. The
  // classes are added from JS only, so the prerendered no-JS page stays visible.
  useEffect(() => {
    const root = document.querySelector('.landing-page')
    if (!root || !('IntersectionObserver' in window)) return
    const targets = root.querySelectorAll(':scope > section:not(.landing-hero)')
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('landing-in')
          observer.unobserve(entry.target)
        }
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 })
    targets.forEach((el) => { el.classList.add('landing-reveal'); observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  // Sticky mobile CTA: show once the hero has scrolled away, hide again at the
  // final CTA band and footer (each has its own primary button).
  useEffect(() => {
    const hero = document.querySelector('.landing-hero')
    const end = document.querySelector('.landing-final')
    if (!hero || !end || !('IntersectionObserver' in window)) return
    let heroGone = false
    let endHere = false
    const update = () => setCtaVisible(heroGone && !endHere)
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) heroGone = !entry.isIntersecting
        if (entry.target === end) endHere = entry.isIntersecting || entry.boundingClientRect.top < 0
      }
      update()
    })
    observer.observe(hero)
    observer.observe(end)
    return () => observer.disconnect()
  }, [])

  const navJump = (href: string) => trackLanding('nav', { target: href })
  const scrollPopular = (direction: 1 | -1) => {
    const row = popularRef.current
    if (!row) return
    wrapPopular(direction)
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' })
    trackLanding('popular_scroll', { direction })
  }
  // Without JS the form is a plain GET to /exams/?q=…, which the catalog reads.
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    trackLanding('hero_search', { query: query.trim().slice(0, 40) })
    if (!query.trim()) {
      event.preventDefault()
      window.location.href = CATALOG_PATH
    }
  }
  const cardStrings = { examCount: t.examCount, mockSpec: t.mockSpec, applicants: t.applicants, cardAction: t.examCardAction }

  return (
    <main className={lang === 'en' ? 'landing-page landing-en' : 'landing-page'}>
      <div className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={t.brand}>
          <a className="landing-brand" href="#top" aria-label={t.brand}>
            <img alt={t.brandAlt} src="/app-icon.svg" />
            <span>
              <strong>{t.brand}</strong>
              <small>{t.navTagline}</small>
            </span>
          </a>

          <div className="landing-nav-links">
            {navLinks.map((link) => (
              <a href={link.href} key={link.href} onClick={() => navJump(link.href)}>{link.label}</a>
            ))}
          </div>

          <div className="landing-nav-actions">
            <a
              className="landing-lang-toggle"
              href={otherLangHref}
              hrefLang={lang === 'en' ? 'zh-Hant-TW' : 'en'}
              onClick={() => trackLanding('lang_switch', { to: lang === 'en' ? 'zh' : 'en' })}
            >
              <Languages size={16} />{otherLangLabel}
            </a>
            <button
              aria-label={t.navThemeToggle}
              className="landing-icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="landing-nav-action" onClick={() => onEnter('nav')} type="button">
              {returning ? t.returnAction : t.restoreAction}
              <ArrowRight size={16} />
            </button>
            <button
              aria-expanded={menuOpen}
              aria-label={t.navMenu}
              className="landing-icon-button landing-burger"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
        <span aria-hidden="true" className="landing-nav-progress" />

        {menuOpen ? (
          <div className="landing-nav-sheet">
            {navLinks.map((link) => (
              <a href={link.href} key={link.href} onClick={() => { navJump(link.href); setMenuOpen(false) }}>{link.label}</a>
            ))}
          </div>
        ) : null}
      </div>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-hero-badge">{t.eyebrow}</p>
          <h1>
            {displayText(t.titleLead(exams.length))}
            <em><span className="hero-mark">{displayText(t.titleAccent)}</span>{displayText(t.titleTail)}</em>
          </h1>
          <p className="landing-hero-description">{t.description}</p>

          <form className="hero-search" action={CATALOG_PATH} method="get" role="search" onSubmit={submitSearch}>
            <label>
              <Search size={20} aria-hidden="true" />
              <input
                type="search"
                name="q"
                autoComplete="off"
                aria-label={t.heroSearchLabel}
                placeholder={t.heroSearchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="landing-primary" type="submit">{t.heroSearchAction}<ArrowRight size={17} /></button>
            {query.trim() ? (
              <div className="hero-search-results" aria-live="polite">
                {searchResults.map((exam) => (
                  <a
                    key={exam.examId}
                    href={examPath(exam.examId)}
                    onClick={() => trackLanding('exam_details', { exam_id: exam.examId, cta_location: 'hero_search' })}
                  >
                    <span><strong>{examTitle(exam)}</strong><small>{examCode(exam)} · {t.examCount(exam.activeQuestionCount)}</small></span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                ))}
                {!searchResults.length ? <p>{t.heroSearchEmpty}</p> : null}
              </div>
            ) : null}
          </form>

          <div className="hero-popular">
            <p>{t.heroPopular}</p>
            <ul>
              {popular.map((exam) => (
                <li key={exam.examId}>
                  <a href={examPath(exam.examId)} onClick={() => trackLanding('exam_details', { exam_id: exam.examId, cta_location: 'hero_chip' })}>{examTitle(exam)}</a>
                </li>
              ))}
            </ul>
          </div>

          <a className="hero-browse" href={CATALOG_PATH} onClick={() => trackLanding('catalog_link', { cta_location: 'hero' })}>
            {t.heroBrowse(exams.length)}<ArrowRight size={15} />
          </a>

          {/* One trust line; the full disclaimer lives in the footer on every page. */}
          <div className="landing-proof">
            <span><CheckCircle2 size={16} /> {t.freeLabel}</span>
            <span><WifiOff size={16} /> {t.offlineLabel}</span>
            <span><ShieldCheck size={16} /> {t.verifiedLabel}</span>
          </div>
        </div>

        {tryExam && trySample ? (
          <aside className="try-card" aria-label={t.tryEyebrow}>
            <p className="try-eyebrow">{t.tryEyebrow}</p>
            <p className="try-from">{t.tryFrom(examTitle(tryExam))} · {trySample.id}</p>
            <p className="try-prompt" lang="zh-Hant-TW"><MathText text={trySample.prompt} /></p>
            <ol className="try-options" lang="zh-Hant-TW">
              {trySample.options.map((option, index) => {
                const n = index + 1
                const picked = tryPick === n
                const state = tryPick === null ? '' : n === trySample.answer ? ` is-answer${picked ? ' is-picked' : ''}` : picked ? ' is-wrong' : ''
                return (
                  <li key={n}>
                    <button
                      type="button"
                      className={`try-option${state}`}
                      aria-pressed={picked}
                      disabled={tryPick !== null}
                      onClick={() => { setTryPick(n); trackLanding('try_question', { exam_id: tryExam.examId, correct: n === trySample.answer }) }}
                    >
                      <span className="try-num">{n}</span>
                      <span><MathText text={option} /></span>
                      {tryPick !== null && n === trySample.answer ? <CheckCircle2 size={17} aria-hidden="true" /> : null}
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="try-feedback" aria-live="polite">
              {tryPick === null ? t.tryHint : tryPick === trySample.answer ? t.tryRight : t.tryWrong(trySample.answer)}
            </p>
            <div className="try-foot">
              <a className="try-link" href={examPath(tryExam.examId)} onClick={() => trackLanding('exam_details', { exam_id: tryExam.examId, cta_location: 'try_card' })}>
                {t.tryCta(examTitle(tryExam))}<ArrowRight size={15} />
              </a>
              {tryExams.length > 1 ? <button type="button" className="try-next" onClick={nextTry}><RefreshCw size={14} aria-hidden="true" />{t.tryNext}</button> : null}
            </div>
          </aside>
        ) : null}
      </section>

      <section className="landing-stats" aria-label={t.brand}>
        <dl ref={statsRef}>
          <div><dt>{t.statsExams}</dt><dd>{statExams}</dd></div>
          <div><dt>{t.statsQuestions}</dt><dd>{totalQuestions >= 1000 ? `${statThousands.toLocaleString('en-US')},000+` : questionFloor(totalQuestions)}</dd></div>
          <div><dt>{t.statsFree}</dt><dd>{t.statsFreeValue}</dd></div>
          <div><dt>{t.statsSignup}</dt><dd>{t.statsSignupValue}</dd></div>
        </dl>
      </section>

      <section className="landing-popular" id="landing-exams">
        <header className="landing-section-head">
          <div>
            <p className="landing-eyebrow">{t.popularEyebrow}</p>
            <h2>{displayText(t.popularTitle)}</h2>
          </div>
          <div className="landing-section-aside">
            <p>{t.popularBody}</p>
            <div className="popular-controls">
              <button type="button" className="landing-icon-button" aria-label={t.popularPrev} onClick={() => scrollPopular(-1)}><ArrowLeft size={18} /></button>
              <button type="button" className="landing-icon-button" aria-label={t.popularNext} onClick={() => scrollPopular(1)}><ArrowRight size={18} /></button>
            </div>
          </div>
        </header>
        <div className={motionOk ? 'popular-row is-drifting' : 'popular-row'} ref={popularRef}>
          {popular.map((exam, index) => (
            <ExamCard exam={exam} key={exam.examId} t={cardStrings} lang={lang} location="popular" index={index} />
          ))}
          {/* Clone set for a seamless loop; client-only so crawlers see each exam once. */}
          {motionOk ? popular.map((exam, index) => (
            <ExamCard exam={exam} key={`clone-${exam.examId}`} t={cardStrings} lang={lang} location="popular" index={index} cloned />
          )) : null}
        </div>
        <div className="popular-foot">
          <a className="landing-secondary" href={CATALOG_PATH} onClick={() => trackLanding('catalog_link', { cta_location: 'popular' })}>
            {t.popularAll(exams.length)}<ArrowRight size={16} />
          </a>
          {DEMAND_PERIOD ? (
            <p className="landing-demand-note">
              {t.demandNote(DEMAND_PERIOD.year, DEMAND_PERIOD.month)}{' '}
              <a href={DEMAND_SOURCE} rel="noopener noreferrer" target="_blank">{t.demandSource}<ArrowUpRight size={13} /></a>
            </p>
          ) : null}
        </div>
      </section>

      <section className="landing-categories" id="landing-categories">
        <header className="landing-categories-head">
          <p className="landing-eyebrow">{t.categoriesEyebrow}</p>
          <h2>{displayText(t.categoriesTitle)}</h2>
        </header>
        <ul className="category-grid">
          {categories.map((group) => {
            const Icon = categoryIcon(group.category)
            return (
              <li key={group.slug}>
                <a href={`${CATALOG_PATH}#${group.slug}`} onClick={() => trackLanding('category', { category: group.category })}>
                  <span className="category-icon" aria-hidden="true"><Icon size={20} /></span>
                  <span className="category-copy">
                    <strong>{categoryName(group.category)}</strong>
                    <small>{t.categoryCount(group.exams.length)} · {t.examCount(group.questionCount)}</small>
                  </span>
                  <ArrowRight className="category-arrow" size={16} aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="landing-showcase" id="landing-how" ref={showcaseRef}>
        <div className="showcase-copy">
          <p className="landing-eyebrow">{t.showcaseEyebrow}</p>
          <h2>{displayText(t.showcaseTitle)}</h2>
          <p>{t.showcaseBody}</p>
          <ol className="showcase-steps">
            {steps.map(({ icon: Icon, label, body }, index) => (
              <li key={label}>
                <button
                  type="button"
                  aria-pressed={step === index}
                  onClick={() => { setStep(index); setAutoplay(false); trackLanding('showcase_step', { step: index + 1 }) }}
                >
                  {autoplay && step === index ? (
                    <span
                      aria-hidden="true"
                      className={showcaseInView ? 'showcase-progress' : 'showcase-progress is-paused'}
                      onAnimationEnd={() => setStep((current) => (current + 1) % steps.length)}
                    />
                  ) : null}
                  <span className="showcase-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="showcase-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="showcase-text">
                    <strong>{label}</strong>
                    <span>{body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="showcase-stage">
          {steps.map(({ label, shot }, index) => (
            <figure className={step === index ? 'showcase-shot is-active' : 'showcase-shot'} key={shot} aria-hidden={step !== index}>
              <img className="shot-light" src={`/screens/${shot}-light.webp`} alt={t.showcaseAlt(label)} width={390} height={844} loading={index ? 'lazy' : 'eager'} decoding="async" />
              <img className="shot-dark" src={`/screens/${shot}-dark.webp`} alt="" width={390} height={844} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-schedule" id="landing-schedule">
        <div className="landing-schedule-head">
          <p className="landing-eyebrow">{t.scheduleEyebrow}</p>
          <h2>{displayText(t.scheduleTitle)}</h2>
          <p>{t.scheduleBody}</p>
        </div>
        <div className="landing-schedule-grid">
          {NATIONAL_EXAM_SCHEDULE_115.map((entry) => (
            <div
              className={entry.id === nextScheduleId ? 'landing-schedule-card landing-schedule-next' : 'landing-schedule-card'}
              key={entry.id}
            >
              <strong>{scheduleLabel(entry, lang)}</strong>
              <p className="landing-schedule-written"><span>{t.scheduleWritten}</span>{writtenDate(entry.writtenDate, lang)}</p>
              <p><span>{t.scheduleReg}</span>{monthDayRange(entry.registrationStart, entry.registrationEnd)}</p>
            </div>
          ))}
        </div>
        <p className="landing-schedule-note">
          <span>{t.scheduleNote}</span>
          <a href={NATIONAL_EXAM_SCHEDULE_SOURCE} rel="noreferrer" target="_blank" onClick={() => trackLanding('schedule_source')}>
            {t.scheduleSource}<ArrowUpRight size={14} />
          </a>
        </p>
      </section>

      <section className="landing-install" id="landing-install">
        <div className="landing-install-copy">
          <p className="landing-eyebrow">{t.installEyebrow}</p>
          <h2>{displayText(t.installTitle)}</h2>
          <p>{t.installBody}</p>
          <p className="landing-install-note">
            <ShieldCheck size={17} />
            <span>{t.installNote}</span>
          </p>
          <div className="landing-install-qr">
            <QrSvg text={siteUrl} ariaLabel={t.installQrAlt} size={116} className="landing-qr" />
            <div>
              <strong>{t.installQrTitle}</strong>
              <p>{t.installQrBody}</p>
            </div>
          </div>
        </div>
        <div className="landing-install-cards">
          <div>
            <strong>{t.installIos}</strong>
            <ol>
              <li><span>1</span><p>{t.installIosStep1}</p></li>
              <li><span>2</span><p>{t.installIosStep2} <Share size={14} /></p></li>
              <li><span>3</span><p>{t.installIosStep3}</p></li>
            </ol>
          </div>
          <div>
            <strong>{t.installAndroid}</strong>
            <ol>
              <li><span>1</span><p>{t.installAndroidStep1}</p></li>
              <li><span>2</span><p>{t.installAndroidStep2} <kbd>⋮</kbd></p></li>
              <li><span>3</span><p>{t.installAndroidStep3}</p></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="landing-faq" id="landing-faq">
        <div className="landing-faq-head">
          <p className="landing-eyebrow">{t.faqEyebrow}</p>
          <h2>{displayText(t.faqTitle)}</h2>
        </div>
        <div className="landing-faq-list">
          {faqItems.map((item, index) => (
            <div key={item.q}>
              <button
                aria-expanded={openFaq === index}
                onClick={() => { const next = openFaq === index ? -1 : index; setOpenFaq(next); if (next === index) trackLanding('faq_open', { q: item.q }) }}
                type="button"
              >
                {item.q}
                {openFaq === index ? <X size={16} /> : <Plus size={16} />}
              </button>
              <div className={openFaq === index ? 'landing-faq-answer landing-open' : 'landing-faq-answer'}>
                <div><p>{item.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <h2>{displayText(t.finalTitle)}</h2>
        <p>{t.finalBody}</p>
        <div className="landing-final-actions">
          <button className="landing-primary landing-primary-light" onClick={() => onEnter('final')} type="button">
            {t.primaryAction}<ArrowRight size={18} />
          </button>
          <a className="landing-final-link" href={CATALOG_PATH} onClick={() => trackLanding('catalog_link', { cta_location: 'final' })}>
            {t.finalSecondary}<ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section className="landing-donate" id="landing-donate">
        <SupportPanel location="landing" lang={lang} />
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <a className="landing-brand" href="#top">
            <img alt="" src="/app-icon.svg" />
            <span>
              <strong>{t.brand}</strong>
              <small>{t.navTagline}</small>
            </span>
          </a>
          <div className="landing-footer-cols">
            <div>
              <p>{t.footerExplore}</p>
              <a href={CATALOG_PATH}>{t.navCatalog}</a>
              {lang === 'en' ? null : <a href={GUIDE_PATH} onClick={() => trackLanding('guide_link')}>{zhTW.landing.navGuide}</a>}
              <a href={otherLangHref} hrefLang={lang === 'en' ? 'zh-Hant-TW' : 'en'}>{lang === 'en' ? '中文版' : 'English'}</a>
            </div>
            <div>
              <p>{t.footerAbout}</p>
              <a href="https://techbank.wdasec.gov.tw/" rel="noreferrer" target="_blank" onClick={() => trackLanding('official_source')}>
                {t.officialSource}<ArrowUpRight size={14} />
              </a>
              <a href={REPO_URL} rel="noreferrer" target="_blank" onClick={() => trackLanding('source_code')}>
                <Github size={14} />{t.sourceCode}<ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
        <p>{t.footerNote}</p>
      </footer>

      {showTop ? (
        <a aria-label={t.backToTop} className="landing-to-top" href="#top">
          <ArrowUp size={18} />
        </a>
      ) : null}

      {/* Sticky mobile CTA: CSS confines it to small viewports; JS shows it only
          between the hero and the final CTA band. */}
      <div className={ctaVisible ? 'landing-mobile-cta landing-in' : 'landing-mobile-cta'}>
        <button className="landing-primary" onClick={() => onEnter('mobile_cta')} type="button">
          {t.primaryAction}<ArrowRight size={16} />
        </button>
      </div>
    </main>
  )
}
