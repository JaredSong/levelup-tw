import { Check, ExternalLink, Layers3, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { ReviewCard, ReviewRating } from '../core/contracts'
import { previewInterval } from '../domain/reviewScheduler'
import { zhTW } from '../i18n/zh-TW'

interface Props {
  dueCards: ReviewCard[]
  totalCards: number
  onGrade: (card: ReviewCard, rating: ReviewRating) => Promise<void> | void
  onOpenSource: (card: ReviewCard) => void
}

function intervalLabel(card: ReviewCard, rating: ReviewRating): string {
  const preview = previewInterval(card, rating, new Date())
  return preview.days ? zhTW.review.days(preview.days) : zhTW.review.minutes(preview.minutes ?? 0)
}

// The Anki-style due-card surface: front prompt → reveal → grade. Kept almost
// blank on purpose — this screen needs concentration, not feature density.
export function ReviewCardStack({ dueCards, totalCards, onGrade, onOpenSource }: Props) {
  const [revealed, setRevealed] = useState(false)
  const card = dueCards[0]

  const grade = async (rating: ReviewRating) => {
    if (!card) return
    setRevealed(false)
    await onGrade(card, rating)
  }

  if (!card) {
    return (
      <section className="review-card-stack empty">
        <Sparkles size={20} />
        <strong>{totalCards ? zhTW.review.allClear : zhTW.review.noCardsYet}</strong>
        {totalCards ? <small>{zhTW.review.cardsTotal(totalCards)}</small> : null}
      </section>
    )
  }

  return (
    <section className="review-card-stack" aria-label={zhTW.review.cards}>
      <div className="review-card-strip">
        <span className="review-card-count"><Layers3 size={15} /> {zhTW.review.cardsDue(dueCards.length)}</span>
        <button className="review-card-source" onClick={() => onOpenSource(card)} type="button">
          {zhTW.review.sourceQuestion} <ExternalLink size={13} />
        </button>
      </div>

      <div className="review-card-body">
        <p className="review-card-front">{card.prompt}</p>
        {revealed ? (
          <div className="review-card-back">
            <p className="answer-label">{zhTW.review.officialAnswer}</p>
            {card.answer.split('\n').map((line) => <span key={line}>{line}</span>)}
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="review-grade-bar">
          <button onClick={() => void grade('again')} type="button">
            <RotateCcw size={17} /> {zhTW.review.gradeAgain}
            <small>{intervalLabel(card, 'again')}</small>
          </button>
          <button className="good" onClick={() => void grade('good')} type="button">
            <Check size={17} /> {zhTW.review.gradeGood}
            <small>{intervalLabel(card, 'good')}</small>
          </button>
          <button className="easy" onClick={() => void grade('easy')} type="button">
            <Sparkles size={17} /> {zhTW.review.gradeEasy}
            <small>{intervalLabel(card, 'easy')}</small>
          </button>
        </div>
      ) : (
        <button className="primary-action wide" onClick={() => setRevealed(true)} type="button">
          {zhTW.review.reveal}
        </button>
      )}
    </section>
  )
}
