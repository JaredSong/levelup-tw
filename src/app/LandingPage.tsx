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
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { GENERATED_LANDING_CATALOG } from './generatedLandingCatalog'
import { applyTheme, currentTheme, type Theme } from './theme'

interface Props {
  exams: ExamManifest[]
  returning: boolean
  onEnter: () => void
  onSelectExam: (examId: string) => void
}

const JKOPAY_CODE = zhTW.landing.donateCode
const REPO_URL = 'https://github.com/JaredSong/levelup-tw'

const navLinks = [
  { href: '#landing-exams', label: zhTW.landing.navExams },
  { href: '#landing-how', label: zhTW.landing.navHow },
  { href: '#landing-install', label: zhTW.landing.navInstall },
  { href: '#landing-faq', label: zhTW.landing.navFaq },
  { href: '#landing-donate', label: zhTW.landing.navDonate },
]

const FEATURED_EXAM_IDS: readonly string[] = GENERATED_LANDING_CATALOG.featuredExamIds

const learningLoop = [
  { icon: BookOpenCheck, tone: 'accent', label: zhTW.landing.loopPractice, body: zhTW.landing.loopPracticeBody },
  { icon: RotateCcw, tone: 'coral', label: zhTW.landing.loopRepair, body: zhTW.landing.loopRepairBody },
  { icon: Clock, tone: 'blue', label: zhTW.landing.loopRemember, body: zhTW.landing.loopRememberBody },
  { icon: Timer, tone: 'gold', label: zhTW.landing.loopVerify, body: zhTW.landing.loopVerifyBody },
]

// Each tile shows a screen the hero does not: repeating 首頁 here would just be
// the hero's screenshot a second time.
const screenShots = [
  { name: 'practice', title: zhTW.landing.screensPractice, body: zhTW.landing.screensPracticeBody },
  { name: 'review', title: zhTW.landing.screensReview, body: zhTW.landing.screensReviewBody },
  { name: 'mock', title: zhTW.landing.screensMock, body: zhTW.landing.screensMockBody },
]

const trustCards = [
  { icon: BadgeCheck, title: zhTW.landing.trustFree, body: zhTW.landing.trustFreeBody },
  { icon: WifiOff, title: zhTW.landing.trustOffline, body: zhTW.landing.trustOfflineBody },
  { icon: Ban, title: zhTW.landing.trustNoAds, body: zhTW.landing.trustNoAdsBody },
]

const faqItems = [
  { q: zhTW.landing.faqOfficialQ, a: zhTW.landing.faqOfficialA },
  { q: zhTW.landing.faqFreeQ, a: zhTW.landing.faqFreeA },
  { q: zhTW.landing.faqAccountQ, a: zhTW.landing.faqAccountA },
  { q: zhTW.landing.faqSourceQ, a: zhTW.landing.faqSourceA },
  { q: zhTW.landing.faqProgressQ, a: zhTW.landing.faqProgressA },
  { q: zhTW.landing.faqExamsQ, a: zhTW.landing.faqExamsA },
]

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

export function LandingPage({ exams, returning, onEnter, onSelectExam }: Props) {
  const [theme, toggleTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [showTop, setShowTop] = useState(false)
  const [copied, setCopied] = useState(false)

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
      await navigator.clipboard.writeText(JKOPAY_CODE)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const shot = (name: string) => `/screens/${name}-${theme}.webp`

  return (
    <main className="landing-page">
      <div className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={zhTW.landing.brand}>
          <a className="landing-brand" href="#top" aria-label={zhTW.landing.brand}>
            <img alt={zhTW.landing.brandAlt} src="/app-icon.svg" />
            <span>
              <strong>{zhTW.landing.brand}</strong>
              <small>{zhTW.landing.navTagline}</small>
            </span>
          </a>

          <div className="landing-nav-links">
            {navLinks.map((link) => (
              <a href={link.href} key={link.href}>{link.label}</a>
            ))}
          </div>

          <div className="landing-nav-actions">
            <button
              aria-label={zhTW.landing.navThemeToggle}
              className="landing-icon-button"
              onClick={toggleTheme}
              type="button"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="landing-nav-action" onClick={onEnter} type="button">
              {returning ? zhTW.landing.returnAction : zhTW.landing.restoreAction}
              <ArrowRight size={16} />
            </button>
            <button
              aria-expanded={menuOpen}
              aria-label={zhTW.landing.navMenu}
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
              <a href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>
            ))}
          </div>
        ) : null}
      </div>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-hero-badge">{zhTW.landing.eyebrow}</p>
          <h1>
            {zhTW.landing.titleLead}
            <em>{zhTW.landing.titleAccent}</em>
            {zhTW.landing.titleTail}
          </h1>
          <p className="landing-hero-description">{zhTW.landing.description}</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onEnter} type="button">
              {zhTW.landing.primaryAction}<ArrowRight size={18} />
            </button>
            <a className="landing-secondary" href="#landing-how">{zhTW.landing.secondaryAction}</a>
          </div>
          <div className="landing-proof">
            <span><CheckCircle2 size={16} /> {zhTW.landing.freeLabel}</span>
            <span><WifiOff size={16} /> {zhTW.landing.offlineLabel}</span>
            <span><ShieldCheck size={16} /> {zhTW.landing.localLabel}</span>
          </div>
          <p className="landing-source-note">{zhTW.landing.sourceNote}</p>
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
            <p className="landing-eyebrow">{zhTW.landing.examSectionEyebrow(totalQuestions)}</p>
            <h2>{zhTW.landing.examSectionTitle}</h2>
          </div>
          <p>{zhTW.landing.examSectionDescription}</p>
        </header>
        <div className="landing-exam-grid">
          {featured.map((exam, index) => (
            <button
              className="landing-exam-card"
              key={exam.examId}
              onClick={() => onSelectExam(exam.examId)}
              style={{ '--landing-index': index } as CSSProperties}
              type="button"
            >
              <span className="landing-exam-icon"><Database size={17} /></span>
              <span className="landing-exam-copy">
                <strong>{exam.titleZh}</strong>
                <small>{exam.sections[0]?.subjectCode ?? exam.examId} · {exam.category} · {exam.level}</small>
              </span>
              <small className="landing-exam-count">{zhTW.landing.examCount(exam.activeQuestionCount)}</small>
              <span className="landing-exam-arrow" aria-label={zhTW.landing.examAction(exam.titleZh)}>
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>

        {rest.length ? (
          // Named in plain text rather than hidden behind the button: someone
          // searching 「會計事務丙級 題庫」 should still find this page.
          <div className="landing-exam-rest">
            <p>
              <span>{zhTW.landing.examRestLabel}</span>
              {rest.map((exam) => exam.titleZh).join('、')}
            </p>
            <button className="landing-secondary" onClick={onEnter} type="button">
              {zhTW.landing.examSeeAll}<ArrowRight size={16} />
            </button>
          </div>
        ) : null}
      </section>

      <section className="landing-method" id="landing-how">
        <div className="landing-method-copy">
          <p className="landing-eyebrow">{zhTW.landing.methodEyebrow}</p>
          <h2>{zhTW.landing.methodTitle}</h2>
          <p>{zhTW.landing.methodDescription}</p>
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
          <p className="landing-eyebrow">{zhTW.landing.screensEyebrow}</p>
          <h2>{zhTW.landing.screensTitle}</h2>
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
            <p className="landing-eyebrow">{zhTW.landing.trustEyebrow}</p>
            <h2>{zhTW.landing.trustTitle}</h2>
          </div>
          <p>{zhTW.landing.trustBody}</p>
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

      <section className="landing-install" id="landing-install">
        <div className="landing-install-copy">
          <p className="landing-eyebrow">{zhTW.landing.installEyebrow}</p>
          <h2>{zhTW.landing.installTitle}</h2>
          <p>{zhTW.landing.installBody}</p>
          <p className="landing-install-note">
            <ShieldCheck size={17} />
            <span>{zhTW.landing.installNote}</span>
          </p>
        </div>
        <div className="landing-install-cards">
          <div>
            <strong>{zhTW.landing.installIos}</strong>
            <ol>
              <li><span>1</span><p>{zhTW.landing.installIosStep1}</p></li>
              <li><span>2</span><p>{zhTW.landing.installIosStep2} <Share size={14} /></p></li>
              <li><span>3</span><p>{zhTW.landing.installIosStep3}</p></li>
            </ol>
          </div>
          <div>
            <strong>{zhTW.landing.installAndroid}</strong>
            <ol>
              <li><span>1</span><p>{zhTW.landing.installAndroidStep1}</p></li>
              <li><span>2</span><p>{zhTW.landing.installAndroidStep2} <kbd>⋮</kbd></p></li>
              <li><span>3</span><p>{zhTW.landing.installAndroidStep3}</p></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="landing-faq" id="landing-faq">
        <div className="landing-faq-head">
          <p className="landing-eyebrow">{zhTW.landing.faqEyebrow}</p>
          <h2>{zhTW.landing.faqTitle}</h2>
        </div>
        <div className="landing-faq-list">
          {faqItems.map((item, index) => (
            <div key={item.q}>
              <button
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
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
            <p className="landing-eyebrow">{zhTW.landing.donateEyebrow}</p>
            <h2>{zhTW.landing.donateTitle}</h2>
            <p>{zhTW.landing.donateBody}</p>
          </div>
          <div className="landing-donate-actions">
            <button onClick={() => void copyJkopay()} type="button">
              <span aria-hidden="true">街</span>
              {copied ? zhTW.landing.donateCopied : zhTW.landing.donateAction}
            </button>
            <small>{JKOPAY_CODE}</small>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <a className="landing-brand" href="#top">
            <img alt="" src="/app-icon.svg" />
            <span>
              <strong>{zhTW.landing.brand}</strong>
              <small>{zhTW.landing.navTagline}</small>
            </span>
          </a>
          <div className="landing-footer-actions">
            <a href="https://techbank.wdasec.gov.tw/" rel="noreferrer" target="_blank">
              {zhTW.landing.officialSource}<ArrowUpRight size={15} />
            </a>
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              <Github size={15} />{zhTW.landing.sourceCode}<ArrowUpRight size={15} />
            </a>
            <button className="landing-primary" onClick={onEnter} type="button">
              {zhTW.landing.primaryAction}<ArrowRight size={16} />
            </button>
          </div>
        </div>
        <p>{zhTW.landing.footerNote}</p>
      </footer>

      {showTop ? (
        <a aria-label={zhTW.landing.backToTop} className="landing-to-top" href="#top">
          <ArrowUp size={18} />
        </a>
      ) : null}
    </main>
  )
}
