import {
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Ban,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Database,
  Github,
  Languages,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Share,
  ShieldCheck,
  Sun,
  Timer,
  WifiOff,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'
import { GENERATED_LANDING_CATALOG } from './generatedLandingCatalog'
import { applyTheme, currentTheme, type Theme } from './theme'
import { QrSvg } from '../components/QrCode'
import { NATIONAL_EXAM_SCHEDULE_115, NATIONAL_EXAM_SCHEDULE_SOURCE, type NationalExamScheduleEntry } from './nationalExamSchedule'

// zhTW.landing infers each value as its exact Chinese string *literal*, which an
// English translation can't satisfy. Widen literal strings to `string` while
// keeping the function-valued entries (examCount, examAction…) intact.
type WidenStrings<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => R : string }
export type LandingStrings = WidenStrings<typeof zhTW.landing>
export type LandingLang = 'zh' | 'en'

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Manifests carry a Chinese category/level; map them for the English page so the
// exam cards don't read half-translated. Exam titles use the manifest's titleEn.
const EN_CATEGORY: Record<string, string> = {
  商業服務: 'Business Services',
  餐飲食品: 'Food & Beverage',
  美容美髮: 'Beauty & Hair',
  車輛修護: 'Vehicle Repair',
  照護服務: 'Care Services',
  資訊: 'Information',
  機械操作: 'Machinery Operation',
  電機工程: 'Electrical Engineering',
  電子儀表: 'Electronics & Instrumentation',
  營造工程: 'Construction',
  職業安全衛生: 'Occupational Safety & Health',
  銲接配管: 'Welding & Piping',
}
const EN_LEVEL: Record<string, string> = {
  丙級: 'Class C',
  乙級: 'Class B',
  甲級: 'Class A',
  單一級: 'Single Level',
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

const REPO_URL = 'https://github.com/JaredSong/levelup-tw'

interface Props {
  exams: ExamManifest[]
  returning: boolean
  onEnter: (source: string) => void
  onSelectExam: (examId: string) => void
  /** Landing copy for the active locale. Defaults to Traditional Chinese. */
  t?: LandingStrings
  /** Active locale — drives the language toggle target and date formatting. */
  lang?: LandingLang
}

const FEATURED_EXAM_IDS: readonly string[] = GENERATED_LANDING_CATALOG.featuredExamIds

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

export function LandingPage({ exams, returning, onEnter, onSelectExam, t = zhTW.landing, lang = 'zh' }: Props) {
  const [theme, toggleTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [showTop, setShowTop] = useState(false)
  const [copied, setCopied] = useState(false)

  const navLinks = [
    { href: '#landing-exams', label: t.navExams },
    { href: '#landing-how', label: t.navHow },
    { href: '#landing-schedule', label: t.navSchedule },
    { href: '#landing-install', label: t.navInstall },
    { href: '#landing-faq', label: t.navFaq },
    { href: '#landing-donate', label: t.navDonate },
  ]

  const learningLoop = [
    { icon: BookOpenCheck, tone: 'accent', label: t.loopPractice, body: t.loopPracticeBody },
    { icon: RotateCcw, tone: 'coral', label: t.loopRepair, body: t.loopRepairBody },
    { icon: Clock, tone: 'blue', label: t.loopRemember, body: t.loopRememberBody },
    { icon: Timer, tone: 'gold', label: t.loopVerify, body: t.loopVerifyBody },
  ]

  // Each tile shows a screen the hero does not: repeating 首頁 here would just be
  // the hero's screenshot a second time.
  const screenShots = [
    { name: 'practice', title: t.screensPractice, body: t.screensPracticeBody },
    { name: 'review', title: t.screensReview, body: t.screensReviewBody },
    { name: 'mock', title: t.screensMock, body: t.screensMockBody },
  ]

  const trustCards = [
    { icon: BadgeCheck, title: t.trustFree, body: t.trustFreeBody },
    { icon: WifiOff, title: t.trustOffline, body: t.trustOfflineBody },
    { icon: Ban, title: t.trustNoAds, body: t.trustNoAdsBody },
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
  const siteUrl = lang === 'en' ? 'https://levelup.tw/en' : 'https://levelup.tw/'
  const otherLangHref = lang === 'en' ? '/' : '/en'
  const otherLangLabel = lang === 'en' ? '中文' : 'EN'

  // Exam titles/labels come from the manifest in Chinese; on /en show the English
  // title and mapped category/level so no card reads half-translated.
  const examTitle = (exam: ExamManifest) => (lang === 'en' ? exam.titleEn : exam.titleZh)
  const examCategory = (exam: ExamManifest) => (lang === 'en' ? EN_CATEGORY[exam.category] ?? exam.category : exam.category)
  const examLevel = (exam: ExamManifest) => (lang === 'en' ? EN_LEVEL[exam.level] ?? exam.level : exam.level)
  const restSeparator = lang === 'en' ? ', ' : '、'

  // Counts and lists all derive from the manifests, so a new pack needs no copy
  // edit: it either matches FEATURED_EXAM_IDS or falls into 其他考科 by itself.
  const totalQuestions = useMemo(
    () => exams.reduce((sum, exam) => sum + exam.activeQuestionCount, 0),
    [exams],
  )
  const featured = useMemo(
    () => FEATURED_EXAM_IDS
      .map((id) => exams.find((exam) => exam.examId === id))
      .filter((exam): exam is ExamManifest => Boolean(exam)),
    [exams],
  )
  const rest = useMemo(
    () => exams.filter((exam) => !FEATURED_EXAM_IDS.includes(exam.examId)),
    [exams],
  )

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

  const copyJkopay = async () => {
    try {
      await navigator.clipboard.writeText(t.donateCode)
      setCopied(true)
      trackLanding('donate_copy')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const navJump = (href: string) => trackLanding('nav', { target: href })
  const shot = (name: string) => `/screens/${name}-${theme}.webp`

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
            {t.titleLead}
            <em>{t.titleAccent}</em>
            {t.titleTail}
          </h1>
          <p className="landing-hero-description">{t.description}</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={() => onEnter('hero')} type="button">
              {t.primaryAction}<ArrowRight size={18} />
            </button>
            <a className="landing-secondary" href="#landing-how" onClick={() => trackLanding('secondary_how')}>{t.secondaryAction}</a>
          </div>
          <div className="landing-proof">
            <span><CheckCircle2 size={16} /> {t.freeLabel}</span>
            <span><WifiOff size={16} /> {t.offlineLabel}</span>
            <span><ShieldCheck size={16} /> {t.localLabel}</span>
          </div>
          <p className="landing-source-note">{t.sourceNote}</p>
        </div>

        <div className="landing-hero-visual">
          <span aria-hidden="true" className="landing-hero-glow" />
          <div className="landing-phone">
            <div className="landing-phone-screen">
              <img alt="" src={shot('home')} width={780} height={1560} />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-exams" id="landing-exams">
        <header className="landing-section-head">
          <div>
            <p className="landing-eyebrow">{t.examSectionEyebrow(totalQuestions)}</p>
            <h2>{t.examSectionTitle}</h2>
          </div>
          <p>{t.examSectionDescription}</p>
        </header>
        <div className="landing-exam-grid">
          {featured.map((exam, index) => (
            // A real link to the exam's SEO page (crawlable, passes link equity),
            // but a click keeps the fast path straight into practice.
            <a
              className="landing-exam-card"
              key={exam.examId}
              href={`/exam/${exam.examId}`}
              onClick={(event) => { event.preventDefault(); onSelectExam(exam.examId) }}
              style={{ '--landing-index': index } as CSSProperties}
            >
              <span className="landing-exam-icon"><Database size={17} /></span>
              <span className="landing-exam-copy">
                <strong>{examTitle(exam)}</strong>
                <small>{exam.sections[0]?.subjectCode ?? exam.examId} · {examCategory(exam)} · {examLevel(exam)}</small>
              </span>
              <small className="landing-exam-count">{t.examCount(exam.activeQuestionCount)}</small>
              <span className="landing-exam-arrow" aria-label={t.examAction(examTitle(exam))}>
                <ArrowRight size={16} />
              </span>
            </a>
          ))}
        </div>

        {rest.length ? (
          // Named in plain text rather than hidden behind the button: someone
          // searching 「會計事務丙級 題庫」 should still find this page.
          <div className="landing-exam-rest">
            <p>
              <span>{t.examRestLabel}</span>
              {rest.map((exam, index) => (
                <Fragment key={exam.examId}>
                  {index > 0 ? restSeparator : ''}
                  <a
                    className="landing-exam-rest-link"
                    href={`/exam/${exam.examId}`}
                    onClick={(event) => { event.preventDefault(); onSelectExam(exam.examId) }}
                  >{examTitle(exam)}</a>
                </Fragment>
              ))}
            </p>
            <button className="landing-secondary" onClick={() => onEnter('exam_see_all')} type="button">
              {t.examSeeAll}<ArrowRight size={16} />
            </button>
          </div>
        ) : null}
      </section>

      <section className="landing-method" id="landing-how">
        <div className="landing-method-copy">
          <p className="landing-eyebrow">{t.methodEyebrow}</p>
          <h2>{t.methodTitle}</h2>
          <p>{t.methodDescription}</p>
        </div>
        <ol className="landing-loop">
          {learningLoop.map(({ icon: Icon, tone, label, body }, index) => (
            <li key={label}>
              <span className="landing-loop-index">{String(index + 1).padStart(2, '0')}</span>
              <span className={`landing-loop-icon ${tone}`}><Icon size={19} /></span>
              <strong>{label}</strong>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-screens">
        <div className="landing-screens-head">
          <p className="landing-eyebrow">{t.screensEyebrow}</p>
          <h2>{t.screensTitle}</h2>
        </div>
        <div className="landing-screens-grid">
          {screenShots.map((item) => (
            <figure key={item.name}>
              {/* No bezel here on purpose: the hero already establishes the
                  device, so these tiles spend their pixels on the UI. */}
              <div className="landing-shot">
                <img alt={item.title} loading="lazy" src={shot(item.name)} width={780} height={1560} />
              </div>
              <figcaption>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-trust">
        <div className="landing-trust-head">
          <div>
            <p className="landing-eyebrow">{t.trustEyebrow}</p>
            <h2>{t.trustTitle}</h2>
          </div>
          <p>{t.trustBody}</p>
        </div>
        <div className="landing-trust-grid">
          {trustCards.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="landing-trust-icon"><Icon size={18} /></span>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-schedule" id="landing-schedule">
        <div className="landing-schedule-head">
          <p className="landing-eyebrow">{t.scheduleEyebrow}</p>
          <h2>{t.scheduleTitle}</h2>
          <p>{t.scheduleBody}</p>
        </div>
        <div className="landing-schedule-grid">
          {NATIONAL_EXAM_SCHEDULE_115.map((entry) => (
            <div className="landing-schedule-card" key={entry.id}>
              <strong>{scheduleLabel(entry, lang)}</strong>
              <p><span>{t.scheduleWritten}</span>{writtenDate(entry.writtenDate, lang)}</p>
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
          <h2>{t.installTitle}</h2>
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
          <h2>{t.faqTitle}</h2>
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
              {openFaq === index ? <p>{item.a}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="landing-donate" id="landing-donate">
        <div className="landing-donate-card">
          <div>
            <p className="landing-eyebrow">{t.donateEyebrow}</p>
            <h2>{t.donateTitle}</h2>
            <p>{t.donateBody}</p>
          </div>
          <div className="landing-donate-actions">
            <button onClick={() => void copyJkopay()} type="button">
              <span aria-hidden="true">街</span>
              {copied ? t.donateCopied : t.donateAction}
            </button>
            <small>{t.donateCode}</small>
          </div>
        </div>
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
          <div className="landing-footer-actions">
            {lang === 'en' ? null : (
              <a href="/guide" onClick={() => trackLanding('guide_link')}>
                {zhTW.landing.navGuide}<ArrowRight size={15} />
              </a>
            )}
            <a href="https://techbank.wdasec.gov.tw/" rel="noreferrer" target="_blank" onClick={() => trackLanding('official_source')}>
              {t.officialSource}<ArrowUpRight size={15} />
            </a>
            <a href={REPO_URL} rel="noreferrer" target="_blank" onClick={() => trackLanding('source_code')}>
              <Github size={15} />{t.sourceCode}<ArrowUpRight size={15} />
            </a>
            <button className="landing-primary" onClick={() => onEnter('footer')} type="button">
              {t.primaryAction}<ArrowRight size={16} />
            </button>
          </div>
        </div>
        <p>{t.footerNote}</p>
      </footer>

      {showTop ? (
        <a aria-label={t.backToTop} className="landing-to-top" href="#top">
          <ArrowUp size={18} />
        </a>
      ) : null}
    </main>
  )
}
