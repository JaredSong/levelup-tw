import { InsightsView } from '../../components/InsightsView'
import type { ReviewCard } from '../../core/contracts'
import type { Question, Progress } from '../../domain/studyEngine'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  reviewCards: ReviewCard[]
  streak: number
  onPracticeGroup: (section: string, title: string) => void
}

export function InsightsPage(props: Props) {
  return (
    <InsightsView
      questions={props.questions}
      progress={props.progress}
      reviewCards={props.reviewCards}
      streak={props.streak}
      onPracticeGroup={props.onPracticeGroup}
    />
  )
}
