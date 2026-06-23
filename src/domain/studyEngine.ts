export type QuestionKind = 'single' | 'multiple'

export interface Question {
  id: string
  subjectCode?: string
  subjectTitle?: string
  sourceGroup?: 'occupation' | 'information-common' | 'general-common'
  section: string
  sectionTitle?: string
  number: number
  kind: QuestionKind
  prompt: string
  options: string[]
  answers: number[]
  sourcePage?: number
  hasFigure?: boolean
  sourceImage?: string
}

export interface Progress {
  questionId: string
  attempts: number
  correct: number
  wrong: number
  guessed: number
  streak: number
  lastSelected: number[]
  lastAnsweredAt: string | null
  nextReviewAt: string | null
  totalElapsedMs: number
  bookmarked: boolean
  note: string
}

export interface AttemptInput {
  selected: number[]
  correct: boolean
  guessed: boolean
  elapsedMs: number
  answeredAt: Date
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function createProgress(questionId: string): Progress {
  return {
    questionId,
    attempts: 0,
    correct: 0,
    wrong: 0,
    guessed: 0,
    streak: 0,
    lastSelected: [],
    lastAnsweredAt: null,
    nextReviewAt: null,
    totalElapsedMs: 0,
    bookmarked: false,
    note: '',
  }
}

export function scoreAnswer(question: Question, selected: number[]): boolean {
  const expected = [...question.answers].sort((a, b) => a - b)
  const actual = [...new Set(selected)].sort((a, b) => a - b)
  return (
    expected.length === actual.length &&
    expected.every((answer, index) => answer === actual[index])
  )
}

export function applyAttempt(
  progress: Progress,
  attempt: AttemptInput,
): Progress {
  const streak = attempt.correct && !attempt.guessed ? progress.streak + 1 : 0
  let delay: number

  if (!attempt.correct) delay = 10 * MINUTE
  else if (attempt.guessed) delay = 4 * HOUR
  else if (streak === 1) delay = DAY
  else if (streak === 2) delay = 3 * DAY
  else if (streak === 3) delay = 7 * DAY
  else delay = 14 * DAY

  return {
    ...progress,
    attempts: progress.attempts + 1,
    correct: progress.correct + (attempt.correct ? 1 : 0),
    wrong: progress.wrong + (attempt.correct ? 0 : 1),
    guessed: progress.guessed + (attempt.guessed ? 1 : 0),
    streak,
    lastSelected: [...attempt.selected],
    lastAnsweredAt: attempt.answeredAt.toISOString(),
    nextReviewAt: new Date(attempt.answeredAt.getTime() + delay).toISOString(),
    totalElapsedMs: progress.totalElapsedMs + Math.max(0, attempt.elapsedMs),
  }
}

function weakness(progress: Progress): number {
  if (progress.attempts === 0) return 0
  return (progress.wrong + progress.guessed * 0.5) / progress.attempts
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export interface RandomQueueOptions {
  section?: string | 'all'
  kind?: QuestionKind | 'all'
  random?: () => number
}

export function buildRandomQueue(
  questions: Question[],
  limit: number,
  options: RandomQueueOptions = {},
): Question[] {
  const section = options.section ?? 'all'
  const kind = options.kind ?? 'all'
  const eligible = questions.filter(
    (question) =>
      (section === 'all' || question.section === section) &&
      (kind === 'all' || question.kind === kind),
  )
  return shuffled(eligible, options.random ?? Math.random).slice(0, limit)
}

export function buildMockQueue(
  questions: Question[],
  random = Math.random,
): Question[] {
  const commonCodes = ['90006', '90007', '90008', '90009']
  const hasOfficialSubjects = commonCodes.every((code) =>
    questions.some((question) => question.subjectCode === code),
  )
  const common = hasOfficialSubjects
    ? commonCodes.flatMap((code) => shuffled(
      questions.filter((question) => question.subjectCode === code),
      random,
    ).slice(0, 4))
    : []
  const core = hasOfficialSubjects
    ? questions.filter((question) => !commonCodes.includes(question.subjectCode ?? ''))
    : questions
  const commonSingles = common.filter((question) => question.kind === 'single').length
  const commonMultiples = common.length - commonSingles
  const singles = shuffled(
    core.filter((question) => question.kind === 'single'),
    random,
  ).slice(0, 60 - commonSingles)
  const multiples = shuffled(
    core.filter((question) => question.kind === 'multiple'),
    random,
  ).slice(0, 20 - commonMultiples)

  if (common.length !== (hasOfficialSubjects ? 16 : 0) || singles.length + commonSingles < 60 || multiples.length + commonMultiples < 20) {
    throw new Error('The question bank cannot satisfy the official mock format')
  }

  return shuffled([...common, ...singles, ...multiples], random)
}

export function buildAdaptiveQueue(
  questions: Question[],
  progressById: Record<string, Progress>,
  limit: number,
  now = new Date(),
  random = Math.random,
): Question[] {
  const due: Question[] = []
  const weak: Question[] = []
  const unseen: Question[] = []

  for (const question of questions) {
    const progress = progressById[question.id]
    if (!progress || progress.attempts === 0) {
      unseen.push(question)
      continue
    }

    if (
      progress.nextReviewAt &&
      new Date(progress.nextReviewAt).getTime() <= now.getTime()
    ) {
      due.push(question)
      continue
    }

    if (weakness(progress) >= 0.34 || progress.streak < 2) weak.push(question)
  }

  due.sort((left, right) => {
    const a = progressById[left.id]
    const b = progressById[right.id]
    if (a.wrong !== b.wrong) return b.wrong - a.wrong
    return (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '')
  })

  weak.sort(
    (left, right) =>
      weakness(progressById[right.id]) - weakness(progressById[left.id]),
  )

  return [...due, ...weak, ...shuffled(unseen, random)].slice(0, limit)
}
