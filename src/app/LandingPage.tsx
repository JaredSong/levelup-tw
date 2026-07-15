import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CloudOff,
  Database,
  RotateCcw,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { formatIntegrityLabel, groupExamsByCategory } from './activeExam'

interface Props {
  exams: ExamManifest[]
  returning: boolean
  onEnter: () => void
  onSelectExam: (examId: string) => void
}

const learningLoop = [
  { icon: BookOpenCheck, label: zhTW.landing.loopPractice },
  { icon: RotateCcw, label: zhTW.landing.loopRepair },
  { icon: CheckCircle2, label: zhTW.landing.loopRemember },
  { icon: Timer, label: zhTW.landing.loopVerify },
]

export function LandingPage({ exams, returning, onEnter, onSelectExam }: Props) {
  const examGroups = groupExamsByCategory(exams)

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label={zhTW.landing.brand}>
        <a className="landing-brand" href="#top" aria-label={zhTW.landing.brand}>
          <img alt={zhTW.landing.brandAlt} src="/app-icon.svg" />
          <span>
            <strong>{zhTW.landing.brand}</strong>
            <small>{zhTW.landing.navTagline}</small>
          </span>
        </a>
        <button className="landing-nav-action" onClick={onEnter} type="button">
          {returning ? zhTW.landing.returnAction : zhTW.landing.restoreAction}
          <ArrowRight size={17} />
        </button>
      </nav>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{zhTW.landing.eyebrow}</p>
          <h1>{zhTW.landing.brand}</h1>
          <h2>{zhTW.landing.title}</h2>
          <p className="landing-hero-description">{zhTW.landing.description}</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onEnter} type="button">
              {zhTW.landing.primaryAction}<ArrowRight size={19} />
            </button>
            <a className="landing-secondary" href="#landing-exams">{zhTW.landing.secondaryAction}</a>
          </div>
          <div className="landing-proof" aria-label={zhTW.landing.sourceNote}>
            <span><CheckCircle2 size={16} /> {zhTW.landing.freeLabel}</span>
            <span><CloudOff size={16} /> {zhTW.landing.offlineLabel}</span>
            <span><ShieldCheck size={16} /> {zhTW.landing.localLabel}</span>
          </div>
          <p className="landing-source-note">{zhTW.landing.sourceNote}</p>
        </div>
      </section>

      <section className="landing-exams" id="landing-exams">
        <header className="landing-section-head">
          <div>
            <p className="landing-eyebrow">{zhTW.landing.examSectionEyebrow}</p>
            <h2>{zhTW.landing.examSectionTitle}</h2>
          </div>
          <p>{zhTW.landing.examSectionDescription}</p>
        </header>
        <div className="landing-exam-groups">
          {examGroups.map((group) => (
            <section className="landing-exam-group" key={group.category}>
              <header className="landing-exam-group-head">
                <h3>{group.category}</h3>
                <span>{zhTW.shell.catalogGroupCount(group.exams.length)}</span>
              </header>
              <div className="landing-exam-grid">
                {group.exams.map((exam) => (
                  <button
                    className="landing-exam-card"
                    key={exam.examId}
                    onClick={() => onSelectExam(exam.examId)}
                    style={{ '--landing-index': exams.indexOf(exam) } as CSSProperties}
                    type="button"
                  >
                    <Database size={21} />
                    <span className="landing-exam-copy">
                      <small>{exam.sections[0]?.subjectCode ?? exam.examId} · {exam.level}</small>
                      <strong>{exam.titleZh}</strong>
                      <span>{zhTW.landing.examQuestions(exam.activeQuestionCount)} · {exam.version}</span>
                    </span>
                    <span className={`landing-integrity ${exam.integrity?.status ?? 'unchecked'}`}>
                      {formatIntegrityLabel(exam)}
                    </span>
                    <span className="landing-exam-arrow" aria-label={zhTW.landing.examAction(exam.titleZh)}><ArrowRight size={19} /></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="landing-method">
        <div className="landing-method-copy">
          <p className="landing-eyebrow">{zhTW.landing.methodEyebrow}</p>
          <h2>{zhTW.landing.methodTitle}</h2>
          <p>{zhTW.landing.methodDescription}</p>
        </div>
        <ol className="landing-loop">
          {learningLoop.map(({ icon: Icon, label }, index) => (
            <li key={label}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <Icon size={20} />
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-trust">
        <div>
          <p className="landing-eyebrow">{zhTW.landing.trustEyebrow}</p>
          <h2>{zhTW.landing.trustTitle}</h2>
        </div>
        <p>{zhTW.landing.trustBody}</p>
      </section>

      <footer className="landing-footer">
        <a href="https://techbank.wdasec.gov.tw/" rel="noreferrer" target="_blank">
          {zhTW.landing.officialSource}<ArrowRight size={15} />
        </a>
        <p>{zhTW.landing.footerNote}</p>
      </footer>
    </main>
  )
}
