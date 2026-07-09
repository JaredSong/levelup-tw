import { ArrowRight, Compass, Shuffle, Target, Zap } from 'lucide-react'
import { LibraryView } from '../../components/LibraryView'
import type { Question, Progress } from '../../domain/studyEngine'

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
        <p className="eyebrow">Practice</p>
        <h1>Official questions</h1>
        <p>Fresh questions, random drills, high-yield mixes, and the full searchable bank.</p>
      </header>

      <section className="syllabus-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Latest syllabus</p>
            <h2>All required banks included</h2>
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
            <p className="eyebrow">Question modes</p>
            <h2>Choose the kind of practice</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onSprint}>
            <span className="mode-icon coral"><Zap size={21} /></span>
            <span><strong>Exam sprint</strong><small>20 weighted to weak spots · for a short break</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={() => props.onFresh(20)}>
            <span className="mode-icon blue"><Compass size={21} /></span>
            <span><strong>Fresh sprint</strong><small>20 unseen first · no review repeats</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onHighYield}>
            <span className="mode-icon slate"><Target size={21} /></span>
            <span><strong>Mini mock 20</strong><small>Official mock mix · normal sampling</small></span>
            <span className="mode-meta">20</span>
          </button>
          <button type="button" onClick={props.onRandom}>
            <span className="mode-icon blue"><Shuffle size={21} /></span>
            <span><strong>Random 10</strong><small>Mixed across all 13 syllabus groups</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onSequential}>
            <span className="mode-icon accent"><ArrowRight size={21} /></span>
            <span><strong>Sequential set</strong><small>Continue the official bank in order</small></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <LibraryView questions={props.questions} progress={props.progress} onOpen={props.onOpenQuestion} />
    </main>
  )
}
