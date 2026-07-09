import { ArrowRight, Compass, Shuffle, Target, Zap } from 'lucide-react'
import { LibraryView } from '../../components/LibraryView'
import type { Question, Progress } from '../../domain/studyEngine'
import { zhTW } from '../../i18n/zh-TW'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  total: number
  onSequential: () => void
  onRandom: () => void
  onFresh: (limit: number) => void
  onHighYield: () => void
  onSprint: () => void
  onSubject: (subjectCode: string, title: string) => void
  onOpenQuestion: (question: Question) => void
}

export function PracticePage(props: Props) {
  return (
    <main className="page dashboard-page">
      <header className="page-title">
        <p className="eyebrow">{zhTW.practice.eyebrow}</p>
        <h1>{zhTW.practice.title}</h1>
        <p>{zhTW.practice.description}</p>
      </header>

      <section className="syllabus-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">{zhTW.practice.latestSyllabus}</p>
            <h2>{zhTW.practice.allBanksIncluded}</h2>
          </div>
          <strong>{props.total.toLocaleString()}</strong>
        </div>
        <div className="syllabus-list">
          {[
            ['17300', 'Web design', '846 · A13'],
            ['90011', 'Information common', '119 · A10 · 5 groups'],
            ['90006', 'Safety & health', '100 · A18'],
            ['90007', 'Ethics & law', '100 · A17'],
            ['90008', 'Environmental protection', '95 · A16'],
            ['90009', 'Energy & carbon', '100 · A11'],
          ].map(([code, label, meta]) => (
            <button key={code} onClick={() => props.onSubject(code, `${label} · Random 10`)} type="button">
              <span>{code}</span><strong>{label}</strong><small>{meta}</small><ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>

      <section className="mode-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">{zhTW.practice.modes}</p>
            <h2>{zhTW.practice.choosePractice}</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onSprint}>
            <span className="mode-icon coral"><Zap size={21} /></span>
            <span><strong>{zhTW.practice.examSprint}</strong><small>{zhTW.practice.examSprintHint}</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={() => props.onFresh(20)}>
            <span className="mode-icon blue"><Compass size={21} /></span>
            <span><strong>{zhTW.practice.freshSprint}</strong><small>{zhTW.practice.freshSprintHint}</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onHighYield}>
            <span className="mode-icon slate"><Target size={21} /></span>
            <span><strong>{zhTW.practice.miniMock}</strong><small>{zhTW.practice.miniMockHint}</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onRandom}>
            <span className="mode-icon blue"><Shuffle size={21} /></span>
            <span><strong>{zhTW.practice.random10}</strong><small>{zhTW.practice.random10Hint}</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onSequential}>
            <span className="mode-icon accent"><ArrowRight size={21} /></span>
            <span><strong>{zhTW.practice.sequential}</strong><small>{zhTW.practice.sequentialHint}</small></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <LibraryView questions={props.questions} progress={props.progress} onOpen={props.onOpenQuestion} />
    </main>
  )
}
