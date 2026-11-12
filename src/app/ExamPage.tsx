import { ArrowRight, BadgeCheck, CheckCircle2, Database, FileDown, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { SupportPanel } from './SupportPanel'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { INSTALLED_EXAMS } from './activeExam'
import { trackLanding } from './analytics'
import { GENERATED_EXAM_SAMPLES } from './generatedExamSamples'
import { getNextNationalExamEntry } from './nationalExamSchedule'
import { CATALOG_PATH, examPath } from './seoUrls'
import { examAliasCopy, examFaqs } from './examFaqs'

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
  const [sampleAnswers, setSampleAnswers] = useState<Record<string, number>>({})
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
  const now = new Date()
  const nextRound = getNextNationalExamEntry(now)
  const faqs = examFaqs(exam, now)
  const aliases = examAliasCopy(exam.examId)
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
        <a href={CATALOG_PATH}>{t.crumbExams}</a>
        <span aria-hidden="true">/</span>
        <span className="exam-crumb-current">{exam.titleZh}</span>
      </nav>

      <section className="exam-hero exam-hero-split">
        <div>
          <p className="landing-eyebrow">{subjectCode} · {exam.category}</p>
          <h1>{exam.titleZh}<br />學科題庫與線上測驗</h1>
          <p className="exam-overview">官方公開題庫，依自己的步調練習。<br />先做一小組，寫錯的留給下一次複習。</p>
          {aliases.plain.length ? <p className="exam-aliases">{t.aliasLine(aliases.plain.join('、'))}</p> : null}
          {aliases.families.map((family) => <p className="exam-aliases" key={family.name}>{t.familyLine(family.name, family.titles)}</p>)}
          <div className="exam-proof"><span><Database size={16} />{t.count(exam.activeQuestionCount)}</span><span><CheckCircle2 size={16} />免費練習</span><span><ShieldCheck size={16} />不必註冊</span></div>
          <div className="exam-entry-actions"><button className="landing-primary" onClick={() => enter('hero')} type="button">開始練習 10 題<ArrowRight size={18} /></button><a className="landing-secondary" href="#exam-downloads"><FileDown size={17} />下載官方題庫 PDF</a></div>
          <p className="exam-entry-note">進度保存在這台裝置；有未完成的練習時，會先幫你接續。</p>
        </div>
        <aside className="exam-source-summary"><h2>先確認你的考試範圍</h2><dl><div><dt>測驗範圍</dt><dd>學科</dd></div><div><dt>專業題庫版本</dt><dd>{exam.version}</dd></div><div><dt>資料來源</dt><dd>勞動部技能檢定中心</dd></div><div><dt>模擬考</dt><dd>{exam.mockRules.totalQuestions} 題／{exam.mockRules.durationMinutes} 分鐘</dd></div></dl><a href="#exam-downloads">查看來源與版本說明 ↗</a></aside>
      </section>

      <section className="exam-downloads" id="exam-downloads">
        <h2>{exam.titleZh}官方題庫 PDF 下載</h2>
        <p>以下是本題庫採用的官方來源，包含專業科目與共同科目。版本以各份 PDF 為準；報考前請再確認官方最新公告。</p>
        <ul>{exam.sources?.length ? exam.sources.map(source => <li key={source.officialUrl}><a href={source.officialUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackLanding('official_pdf', { exam_id: exam.examId, subject_code: source.subjectCode })}><FileDown size={17} /><span><strong>{source.subjectCode} · {source.subjectCode === subjectCode ? `${exam.titleZh}專業科目` : exam.sections.find(section => section.subjectCode === source.subjectCode)?.titleZh ?? '共同科目'}</strong><small>{source.version} · PDF</small></span><ArrowRight size={16} /></a></li>) : <li><a href={exam.sourceUrl ?? exam.officialLinks?.questionBank ?? 'https://techbank.wdasec.gov.tw/'} target="_blank" rel="noopener noreferrer">前往官方題庫來源<ArrowRight size={16} /></a></li>}</ul>
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
                    <li key={oi} className={sampleAnswers[q.id] && oi + 1 === q.answer ? 'is-answer' : undefined}>
                      <button type="button" aria-pressed={sampleAnswers[q.id] === oi + 1} onClick={() => setSampleAnswers(current => ({ ...current, [q.id]: oi + 1 }))}><span className="exam-opt-num">{oi + 1}</span>{option}{sampleAnswers[q.id] && oi + 1 === q.answer ? <CheckCircle2 size={15} /> : null}</button>
                    </li>
                  ))}
                </ul>
                <p className="exam-sample-answer" aria-live="polite">{sampleAnswers[q.id] ? sampleAnswers[q.id] === q.answer ? '答對了。' : `再記一次：正確答案是 ${q.answer}。` : '先選一個答案，看看作答回饋。'}</p><details><summary>查看答案</summary><p>{t.answerLabel}：{q.answer}</p></details>
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

      <section className="exam-faq" id="exam-faq">
        <h2>{t.faqTitle(exam.titleZh)}</h2>
        {/* Open, not collapsed: the same Q&As are the page's FAQPage JSON-LD,
            and answers hidden behind a toggle read as thinner content. */}
        <div className="guide-faq-list">
          {faqs.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="exam-cta">
        <h2>{t.ctaTitle(exam.titleZh)}</h2>
        <p>{t.ctaBody}</p>
        <div className="exam-cta-actions">
          <button className="landing-primary" onClick={() => enter('cta')} type="button">
            {t.practice(exam.titleZh)}<ArrowRight size={18} />
          </button>
          <a className="landing-secondary" href={CATALOG_PATH}>{t.seeAll}<ArrowRight size={16} /></a>
        </div>
      </section>

      {related.length ? (
        <section className="exam-related">
          <h2>{t.relatedTitle}</h2>
          <ul>
            {related.map((e) => (
              <li key={e.examId}>
                <a href={examPath(e.examId)}>{e.titleZh}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="exam-support"><SupportPanel location="exam" /></div>

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
