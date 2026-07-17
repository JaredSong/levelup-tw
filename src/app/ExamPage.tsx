import { ArrowRight, BadgeCheck, CheckCircle2, Database, ShieldCheck, WifiOff } from 'lucide-react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'
import { GENERATED_EXAM_SAMPLES } from './generatedExamSamples'

interface Props {
  exam: ExamManifest
  /** Enter the study app for this exam. */
  onEnter: () => void
  /** Client-side navigate home (anchors keep a real href for crawlers). */
  onHome: () => void
}

// A per-exam SEO landing: unique, keyword-rich, crawlable content for
// "<考科> 題庫" queries, with a clear path into practising that exam. Rendered
// server-side into /exam/<id>/ by scripts/prerender.mjs and hydrated by the SPA.
export function ExamPage({ exam, onEnter, onHome }: Props) {
  const t = zhTW.examPage
  const data = GENERATED_EXAM_SAMPLES[exam.examId] ?? { sections: [], samples: [] }
  const subjectCode = exam.sections[0]?.subjectCode ?? exam.examId

  const homeClick = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    onHome()
  }
  const enter = (source: string) => {
    trackLanding('exam_page_cta', { source, exam_id: exam.examId })
    onEnter()
  }

  return (
    <main className="exam-page">
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
        <span>{t.crumbExams}</span>
        <span aria-hidden="true">/</span>
        <span className="exam-crumb-current">{exam.titleZh}</span>
      </nav>

      <section className="exam-hero">
        <p className="landing-eyebrow">{t.metaLabel(exam.category, exam.level)}</p>
        <h1>{t.overviewTitle(exam.titleZh)}</h1>
        <p className="exam-sub">{subjectCode} · {exam.titleEn}</p>
        <div className="exam-proof">
          <span><Database size={16} /> {t.count(exam.activeQuestionCount)}</span>
          <span><CheckCircle2 size={16} /> {zhTW.landing.freeLabel}</span>
          <span><WifiOff size={16} /> {zhTW.landing.offlineLabel}</span>
          <span><ShieldCheck size={16} /> {zhTW.landing.localLabel}</span>
        </div>
        <p className="exam-overview">{t.overviewBody(exam.titleZh, exam.activeQuestionCount)}</p>
        <button className="landing-primary" onClick={() => enter('hero')} type="button">
          {t.practice(exam.titleZh)}<ArrowRight size={18} />
        </button>
      </section>

      {data.sections.length ? (
        <section className="exam-sections">
          <h2>{t.sectionsTitle}</h2>
          <ul>
            {data.sections.map((section) => (
              <li key={section}><BadgeCheck size={15} />{section}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.samples.length ? (
        <section className="exam-samples">
          <h2>{t.samplesTitle}</h2>
          <div className="exam-sample-list">
            {data.samples.map((q, index) => (
              <article className="exam-sample" key={q.id}>
                <p className="exam-sample-section">{t.sampleSection(q.sectionTitle)}</p>
                <p className="exam-sample-q"><b>Q{index + 1}.</b> {q.prompt}</p>
                <ul>
                  {q.options.map((option, oi) => (
                    <li key={oi} className={oi + 1 === q.answer ? 'is-answer' : undefined}>
                      <span className="exam-opt-num">{oi + 1}</span>
                      {option}
                      {oi + 1 === q.answer ? <CheckCircle2 size={15} /> : null}
                    </li>
                  ))}
                </ul>
                <p className="exam-sample-answer">{t.answerLabel}：{q.answer}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="exam-cta">
        <h2>{t.ctaTitle(exam.titleZh)}</h2>
        <p>{t.ctaBody}</p>
        <div className="exam-cta-actions">
          <button className="landing-primary" onClick={() => enter('cta')} type="button">
            {t.practice(exam.titleZh)}<ArrowRight size={18} />
          </button>
          <a className="landing-secondary" href="/" onClick={homeClick}>{t.seeAll}<ArrowRight size={16} /></a>
        </div>
      </section>

      <section className="exam-about">
        <h3>{t.aboutTitle}</h3>
        <p>{t.aboutBody}</p>
      </section>

      <footer className="landing-footer">
        <p>{zhTW.landing.footerNote}</p>
      </footer>
    </main>
  )
}
