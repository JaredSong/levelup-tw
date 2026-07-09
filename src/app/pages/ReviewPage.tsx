import { ArrowRight, Brain, Headphones, Layers3, ListRestart } from 'lucide-react'
import { GlossaryView } from '../../components/GlossaryView'

interface Props {
  due: number
  wrongCount: number
  onAdaptive: () => void
  onWrong: () => void
  onFlashcards: () => void
  onCommuteNotes: () => void
  onPracticeSection: (section: string, title: string) => void
}

export function ReviewPage(props: Props) {
  return (
    <main className="page dashboard-page">
      <header className="page-title">
        <p className="eyebrow">Review</p>
        <h1>Memory work</h1>
        <p>Due items, wrong-answer repair, recall cards, commute notes, and terms.</p>
      </header>

      <section className="readiness-strip" aria-label="Review overview">
        <div>
          <span>Due now</span>
          <strong>{props.due}</strong>
        </div>
        <div>
          <span>Wrong active</span>
          <strong>{props.wrongCount}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>Review</strong>
        </div>
      </section>

      <section className="mode-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Queues</p>
            <h2>Repair what is slipping</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onAdaptive}>
            <span className="mode-icon violet"><Brain size={21} /></span>
            <span><strong>Due review 10</strong><small>Scheduled review queue · then weak/new</small></span>
            <span className="mode-meta">10</span>
          </button>
          <button type="button" onClick={props.onWrong}>
            <span className="mode-icon coral"><ListRestart size={21} /></span>
            <span><strong>Wrong answers</strong><small>Stable queue, no jump back to item 1</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
          <button type="button" onClick={props.onFlashcards}>
            <span className="mode-icon violet"><Layers3 size={21} /></span>
            <span><strong>Recall cards</strong><small>Reveal, then grade what you knew</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onCommuteNotes}>
            <span className="mode-icon slate"><Headphones size={21} /></span>
            <span><strong>Commute notes</strong><small>All wrong answers · cached voice memory cues</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
        </div>
      </section>

      <GlossaryView onPracticeSection={props.onPracticeSection} />
    </main>
  )
}
