import { ArrowRight, BadgeCheck, CheckCircle2, Database, ShieldCheck, WifiOff } from 'lucide-react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { INSTALLED_EXAMS } from './activeExam'
import { trackLanding } from './analytics'
import { GENERATED_EXAM_SAMPLES } from './generatedExamSamples'
import { getNextNationalExamEntry } from './nationalExamSchedule'

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

  // Related exams: same category first (a real "explore" cluster for readers and
  // an internal-linking signal for crawlers), topped up with others, capped at 6.
  const others = INSTALLED_EXAMS.filter((e) => e.examId !== exam.examId)
  const related = [
    ...others.filter((e) => e.category === exam.category),
    ...others.filter((e) => e.category !== exam.category),
  ].slice(0, 6)

  // Registration dates, pass mark and official links: the questions people
  // actually search during registration season. All of it comes from the
  // manifest and the schedule module — never hand-typed here, so a stale date
  // can't outlive the data it came from. Computed at prerender time, which is
  // why it is the next *upcoming* round rather than a fixed one.
  const nextRound = getNextNationalExamEntry(new Date())
  const links = exam.officialLinks ?? {}
  const linkCandidates: { href?: string; label: string }[] = [
    { href: links.registration, label: t.officialRegistration },
    { href: links.scoreLookup, label: t.officialScore },
    { href: links.handbook, label: t.officialHandbook },
    { href: links.questionBank, label: t.officialBank },
  ]
  const officialLinks = linkCandidates.filter(
    (link): link is { href: string; label: string } => Boolean(link.href),
  )

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

      <section className="exam-facts">
        <h2>{t.factsTitle}</h2>
        <dl className="exam-facts-list">
          <div>
            <dt>{t.passLabel}</dt>
            <dd>{t.passValue(exam.mockRules.passScore, exam.mockRules.maxScore)}</dd>
          </div>
          {nextRound ? (
            <>
              <div>
                <dt>{t.scheduleLabel(nextRound.label)}</dt>
                <dd>{t.scheduleValue(nextRound.registrationStart, nextRound.registrationEnd)}</dd>
              </div>
              <div>
                <dt>{t.writtenLabel}</dt>
                <dd>{nextRound.writtenDate}</dd>
              </div>
            </>
          ) : null}
        </dl>
        {officialLinks.length ? (
          <ul className="exam-facts-links">
            {officialLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} rel="noopener noreferrer nofollow" target="_blank">{link.label}</a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="exam-facts-note">{t.factsNote}</p>
      </section>

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

      {related.length ? (
        <section className="exam-related">
          <h2>{t.relatedTitle}</h2>
          <ul>
            {related.map((e) => (
              <li key={e.examId}>
                <a href={`/exam/${e.examId}`}>{e.titleZh}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
