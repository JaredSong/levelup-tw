import { ArrowRight, ArrowUpRight, BadgeCheck, Check, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'
import { ExamCard } from './ExamCard'
import { DEMAND_PERIOD, DEMAND_SOURCE, rankByDemand } from './examCatalog'
import { guideFaqs } from './guideFaqs'
import { useReveal, useScrollSpy } from './landingMotion'
import { CATALOG_PATH } from './seoUrls'

interface Props {
  exams: ExamManifest[]
  /** Enter the app (generic — the guide's CTA leads to the exam catalog). */
  onEnter: () => void
  onHome: () => void
}

/** The 升級吧 option in t.ways — marked as this site's approach. */
const OUR_WAY_INDEX = 1
const POPULAR_COUNT = 6

// AEO guide: a quotable, question-shaped page targeting "免費技能檢定題庫" and
// nearby informational queries. Structured so a featured snippet or AI answer can
// lift the lead paragraph / FAQ wholesale, with 升級吧 named as one honest option.
// Layout: an article column with a sticky table of contents (scroll-spy) on
// desktop; the FAQ stays open because it is also the page's FAQPage JSON-LD.
export function GuidePage({ exams, onEnter, onHome }: Props) {
  const t = zhTW.guide
  const lt = zhTW.landing
  const rootRef = useRef<HTMLElement>(null)
  const tocRef = useRef<HTMLOListElement>(null)
  const [pill, setPill] = useState<{ y: number; h: number } | null>(null)
  useReveal(rootRef)

  const totalQuestions = useMemo(
    () => Math.floor(exams.reduce((sum, exam) => sum + exam.activeQuestionCount, 0) / 1000) * 1000,
    [exams],
  )
  const popular = useMemo(() => rankByDemand(exams).slice(0, POPULAR_COUNT), [exams])
  const faqs = guideFaqs(new Date())

  const toc = [
    { id: 'guide-what', label: t.whatTitle },
    { id: 'guide-ways', label: t.waysTitle },
    { id: 'guide-how', label: t.howTitle },
    { id: 'guide-popular', label: t.popularTitle },
    { id: 'guide-faq', label: t.faqTitle },
  ]
  const active = useScrollSpy(toc.map((item) => item.id))

  // Sliding highlight behind the active TOC entry (scroll-spy pill).
  useLayoutEffect(() => {
    // Measure the <li>: the link's own offsetTop is relative to it, not the list.
    const item = tocRef.current?.querySelector<HTMLElement>(`a[href="#${active}"]`)?.parentElement
    if (item) setPill({ y: item.offsetTop, h: item.offsetHeight })
  }, [active])

  const homeClick = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    onHome()
  }
  const enter = (source: string) => {
    trackLanding('guide_cta', { source })
    onEnter()
  }
  const cardStrings = { examCount: lt.examCount, mockSpec: lt.mockSpec, applicants: lt.applicants, cardAction: lt.examCardAction }

  return (
    <main className="exam-page guide-page" ref={rootRef}>
      <div className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={lt.brand}>
          <a className="landing-brand" href="/" onClick={homeClick} aria-label={lt.brand}>
            <img alt={lt.brandAlt} src="/app-icon.svg" />
            <span>
              <strong>{lt.brand}</strong>
              <small>{lt.navTagline}</small>
            </span>
          </a>
          <div className="landing-nav-actions">
            <a className="landing-nav-action guide-nav-catalog" href={CATALOG_PATH}>{lt.navCatalog}</a>
            <button className="landing-nav-action landing-nav-primary" onClick={() => enter('nav')} type="button">
              {t.startFree}<ArrowRight size={16} />
            </button>
          </div>
        </nav>
      </div>

      <nav className="exam-crumb" aria-label="breadcrumb">
        <a href="/" onClick={homeClick}>{t.home}</a>
        <span aria-hidden="true">/</span>
        <span className="exam-crumb-current">{t.crumb}</span>
      </nav>

      <header className="guide-hero">
        <p className="landing-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="guide-answer">
          <p className="guide-answer-label">{t.quickAnswer}</p>
          <p className="exam-overview guide-lead">{t.lead(exams.length, totalQuestions)}</p>
        </div>
        <dl className="guide-facts">
          <div><dd>{exams.length}</dd><dt>{t.factExams}</dt></div>
          <div><dd>{totalQuestions.toLocaleString('en-US')}+</dd><dt>{t.factQuestions}</dt></div>
          <div><dd>0 元</dd><dt>{t.factFree}</dt></div>
        </dl>
        <div className="guide-hero-actions">
          <button className="landing-primary" onClick={() => enter('hero')} type="button">
            {t.startFree}<ArrowRight size={18} />
          </button>
          <a className="landing-secondary" href={CATALOG_PATH}>{t.seeExams}<ArrowRight size={16} /></a>
        </div>
      </header>

      <div className="guide-layout">
        <aside className="guide-toc" aria-label={t.tocTitle}>
          <p>{t.tocTitle}</p>
          <ol ref={tocRef}>
            {pill ? <span aria-hidden="true" className="guide-toc-pill" style={{ transform: `translateY(${pill.y}px)`, height: pill.h }} /> : null}
            {toc.map((item, index) => (
              <li key={item.id}>
                <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>
                  <span>{String(index + 1).padStart(2, '0')}</span>{item.label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="guide-article">
          <section className="guide-section" id="guide-what">
            <h2>{t.whatTitle}</h2>
            <p>{t.whatBody}</p>
          </section>

          <section className="guide-section" id="guide-ways">
            <h2>{t.waysTitle}</h2>
            <div className="guide-ways">
              {t.ways.map((way, index) => (
                <div className={index === OUR_WAY_INDEX ? 'guide-way is-ours' : 'guide-way'} key={way.name}>
                  {index === OUR_WAY_INDEX ? <span className="guide-way-tag">{t.recommended}</span> : null}
                  <strong>{way.name}</strong>
                  <p className="guide-good"><Check size={15} />{way.good}</p>
                  <p className="guide-bad"><X size={15} />{way.bad}</p>
                </div>
              ))}
            </div>
            <p className="guide-conclusion">{t.waysConclusion}</p>
          </section>

          <section className="guide-section" id="guide-how">
            <h2>{t.howTitle}</h2>
            <ol className="guide-steps" data-reveal>
              {t.howSteps.map((step, index) => (
                <li key={step} style={{ '--step': index } as CSSProperties}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="guide-section" id="guide-popular">
            <h2>{t.popularTitle}</h2>
            <p>{t.popularBody}</p>
            <div className="exam-card-grid guide-cards">
              {popular.map((exam, index) => (
                <ExamCard exam={exam} key={exam.examId} t={cardStrings} location="guide" index={index} />
              ))}
            </div>
            <div className="guide-popular-foot">
              <a className="landing-secondary" href={CATALOG_PATH}>{t.popularAll(exams.length)}<ArrowRight size={16} /></a>
              {DEMAND_PERIOD ? (
                <p className="landing-demand-note">
                  {lt.demandNote(DEMAND_PERIOD.year, DEMAND_PERIOD.month)}{' '}
                  <a href={DEMAND_SOURCE} rel="noopener noreferrer" target="_blank">{lt.demandSource}<ArrowUpRight size={13} /></a>
                </p>
              ) : null}
            </div>
          </section>

          <section className="guide-section guide-faq" id="guide-faq">
            <h2>{t.faqTitle}</h2>
            <div className="guide-faq-list">
              {faqs.map((item) => (
                <div key={item.q}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="exam-about">
            <h3>{t.aboutTitle}</h3>
            <p>{t.aboutBody}</p>
            <p className="guide-about-tag"><BadgeCheck size={15} />{lt.freeLabel}</p>
          </section>
        </article>
      </div>

      <section className="landing-final">
        <h2>{t.ctaTitle}</h2>
        <p>{t.ctaBody}</p>
        <div className="landing-final-actions">
          <button className="landing-primary landing-primary-light" onClick={() => enter('cta')} type="button">
            {t.startFree}<ArrowRight size={18} />
          </button>
          <a className="landing-final-link" href={CATALOG_PATH}>{t.seeExams}<ArrowRight size={16} /></a>
        </div>
      </section>

      <footer className="landing-footer">
        <p>{lt.footerNote}</p>
      </footer>
    </main>
  )
}
