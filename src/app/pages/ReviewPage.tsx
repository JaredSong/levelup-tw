import { ArrowRight, Brain, Headphones, Layers3, ListRestart, PlusCircle } from 'lucide-react'
import { GlossaryView } from '../../components/GlossaryView'
import { ReviewCardStack } from '../../components/ReviewCardStack'
import type { ReviewCard, ReviewRating } from '../../core/contracts'
import { zhTW } from '../../i18n/zh-TW'

interface Props {
  due: number
  wrongCount: number
  dueCards: ReviewCard[]
  totalCards: number
  wrongWithoutCards: number
  onGradeCard: (card: ReviewCard, rating: ReviewRating) => Promise<void> | void
  onOpenCardSource: (card: ReviewCard) => void
  onCreateWrongCards: () => Promise<void> | void
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
        <p className="eyebrow">{zhTW.review.eyebrow}</p>
        <h1>{zhTW.review.title}</h1>
        <p>{zhTW.review.description}</p>
      </header>

      <ReviewCardStack
        dueCards={props.dueCards}
        totalCards={props.totalCards}
        onGrade={props.onGradeCard}
        onOpenSource={props.onOpenCardSource}
      />
      {props.wrongWithoutCards > 0 ? (
        <button className="secondary-action wide" onClick={() => void props.onCreateWrongCards()} type="button">
          <PlusCircle size={17} /> {zhTW.review.makeWrongCards(props.wrongWithoutCards)}
        </button>
      ) : null}

      <section className="readiness-strip" aria-label="複習概況">
        <div>
          <span>{zhTW.review.dueNow}</span>
          <strong>{props.due}</strong>
        </div>
        <div>
          <span>{zhTW.review.wrongActive}</span>
          <strong>{props.wrongCount}</strong>
        </div>
        <div>
          <span>{zhTW.review.cards}</span>
          <strong>{props.totalCards}</strong>
        </div>
      </section>

      <section className="mode-section">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">{zhTW.review.queues}</p>
            <h2>{zhTW.review.repair}</h2>
          </div>
        </div>
        <div className="mode-list">
          <button type="button" onClick={props.onAdaptive}>
            <span className="mode-icon violet"><Brain size={21} /></span>
            <span><strong>{zhTW.review.dueReview}</strong><small>{zhTW.review.dueReviewHint}</small></span>
            <span className="mode-meta">10</span>
          </button>
          <button type="button" onClick={props.onWrong}>
            <span className="mode-icon coral"><ListRestart size={21} /></span>
            <span><strong>{zhTW.review.wrongAnswers}</strong><small>{zhTW.review.wrongAnswersHint}</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
          <button type="button" onClick={props.onFlashcards}>
            <span className="mode-icon violet"><Layers3 size={21} /></span>
            <span><strong>{zhTW.review.recallCards}</strong><small>{zhTW.review.recallCardsHint}</small></span>
            <ArrowRight size={18} />
          </button>
          <button type="button" onClick={props.onCommuteNotes}>
            <span className="mode-icon slate"><Headphones size={21} /></span>
            <span><strong>{zhTW.review.commuteNotes}</strong><small>{zhTW.review.commuteNotesHint}</small></span>
            <span className="mode-meta">{props.wrongCount || '—'}</span>
          </button>
        </div>
      </section>

      <GlossaryView onPracticeSection={props.onPracticeSection} />
    </main>
  )
}
