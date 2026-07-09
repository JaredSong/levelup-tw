import { StatsView } from '../../components/StatsView'
import type { Question, Progress } from '../../domain/studyEngine'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  onSaveAiToken: (token: string) => void
  onPracticeGroup: (section: string, title: string) => void
}

export function InsightsPage(props: Props) {
  return (
    <StatsView
      questions={props.questions}
      progress={props.progress}
      onSaveAiToken={props.onSaveAiToken}
      onPracticeGroup={props.onPracticeGroup}
    />
  )
}
