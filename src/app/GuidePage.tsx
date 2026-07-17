import { ArrowRight, BadgeCheck, Check, X } from 'lucide-react'
import { useMemo } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'

interface Props {
  exams: ExamManifest[]
  /** Enter the app (generic — the guide's CTA leads to the exam catalog). */
  onEnter: () => void
  onHome: () => void
}

// AEO guide: a quotable, question-shaped page targeting "免費技能檢定題庫" and
// nearby informational queries. Structured so a featured snippet or AI answer can
// lift the lead paragraph / FAQ wholesale, with 升級吧 named as one honest option.
export function GuidePage({ exams, onEnter, onHome }: Props) {
  const t = zhTW.guide
  const totalQuestions = useMemo(
    () => Math.floor(exams.reduce((sum, exam) => sum + exam.activeQuestionCount, 0) / 1000) * 1000,
    [exams],
  )

  const homeClick = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    onHome()
  }
  const enter = (source: string) => {
    trackLanding('guide_cta', { source })
    onEnter()
  }

  return (
    <main className="exam-page guide-page">
      <div className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={zhTW.landing.brand}>
          <a className="landing-brand" href="/" onClick={homeClick} aria-label={zhTW.landing.brand}>
            <img alt={zhTW.landing.brandAlt} src="/app-icon.svg" />
            <span>
              <strong>{zhTW.landing.brand}</strong>
              <small>{zhTW.landing.navTagline}</small>
            </span>
          </a>
          <div className="landing-nav-actions">
            <button className="landing-nav-action" onClick={() => enter('nav')} type="button">
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

      <section className="exam-hero">
        <p className="landing-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="exam-overview guide-lead">{t.lead(exams.length, totalQuestions)}</p>
        <button className="landing-primary" onClick={() => enter('hero')} type="button">
          {t.startFree}<ArrowRight size={18} />
        </button>
      </section>

      <section className="guide-section">
        <h2>{t.whatTitle}</h2>
        <p>{t.whatBody}</p>
      </section>

      <section className="guide-section">
        <h2>{t.waysTitle}</h2>
        <div className="guide-ways">
          {t.ways.map((way) => (
            <div className="guide-way" key={way.name}>
              <strong>{way.name}</strong>
              <p className="guide-good"><Check size={15} />{way.good}</p>
              <p className="guide-bad"><X size={15} />{way.bad}</p>
            </div>
          ))}
        </div>
        <p className="guide-conclusion">{t.waysConclusion}</p>
      </section>

      <section className="guide-section">
        <h2>{t.howTitle}</h2>
        <ol className="guide-steps">
          {t.howSteps.map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
          ))}
        </ol>
      </section>

      <section className="guide-section guide-faq">
        <h2>{t.faqTitle}</h2>
        <div className="guide-faq-list">
          {t.faqs.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="exam-cta">
        <h2>{t.ctaTitle}</h2>
        <p>{t.ctaBody}</p>
        <div className="exam-cta-actions">
          <button className="landing-primary" onClick={() => enter('cta')} type="button">
            {t.startFree}<ArrowRight size={18} />
          </button>
          <a className="landing-secondary" href="/" onClick={homeClick}>{t.seeExams}<ArrowRight size={16} /></a>
        </div>
      </section>

      <section className="exam-about">
        <h3>{t.aboutTitle}</h3>
        <p>{t.aboutBody}</p>
        <p className="guide-about-tag"><BadgeCheck size={15} />{zhTW.landing.freeLabel}</p>
      </section>

      <footer className="landing-footer">
        <p>{zhTW.landing.footerNote}</p>
      </footer>
    </main>
  )
}
