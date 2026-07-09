export type QuestionKind = 'single' | 'multiple'

export interface Question {
  examId?: string
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
  sourceImages?: string[]
  sourcePageImage?: string
  /** false for officially deleted questions; absent means active. */
  active?: boolean
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

function reviewPriority(question: Question, progressById: Record<string, Progress>, now: Date): number {
  const progress = progressById[question.id]
  if (!progress || progress.attempts === 0) return 2 // unseen
  if (progress.wrong > 0 && progress.streak < 2) return 5 // wrong, not mastered
  if (progress.guessed > 0 && progress.streak < 2) return 4 // guessed, not mastered
  if (progress.nextReviewAt && new Date(progress.nextReviewAt).getTime() <= now.getTime()) return 3 // due
  return 1 // seen and settled
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function buildOptionOrder(
  question: Question,
  options: { randomize: boolean; random?: () => number },
): number[] {
  const order = question.options.map((_, index) => index + 1)
  if (!options.randomize) return order
  if (question.options.some((option) => option.includes('圖示選項'))) return order
  return shuffled(order, options.random ?? Math.random)
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

export function buildFreshQueue(
  questions: Question[],
  progressById: Record<string, Progress>,
  limit: number,
  random = Math.random,
): Question[] {
  const ranked = shuffled(questions, random).sort((left, right) => {
    const a = progressById[left.id]?.attempts ?? 0
    const b = progressById[right.id]?.attempts ?? 0
    if (a !== b) return a - b
    return (progressById[left.id]?.lastAnsweredAt ?? '').localeCompare(progressById[right.id]?.lastAnsweredAt ?? '')
  })
  return ranked.slice(0, limit)
}

export function buildHighYieldQueue(
  questions: Question[],
  _progressById: Record<string, Progress>,
  limit = 20,
  random = Math.random,
): Question[] {
  const used = new Set<string>()
  const take = (pool: Question[], count: number): Question[] => {
    const picked = shuffled(pool.filter((question) => !used.has(question.id)), random).slice(0, count)
    picked.forEach((question) => used.add(question.id))
    return picked
  }

  const commonCodes = ['90006', '90007', '90008', '90009']
  const common = commonCodes.flatMap((code) => take(questions.filter((question) => question.subjectCode === code), 1))
  const info = take(questions.filter((question) => question.subjectCode === '90011'), 2)
  const occupation = take(questions.filter((question) => question.subjectCode === '17300'), Math.max(0, limit - common.length - info.length))
  const backfill = take(questions, Math.max(0, limit - common.length - info.length - occupation.length))

  return shuffled([...common, ...info, ...occupation, ...backfill], random).slice(0, limit)
}

// Official mock composition: 80 questions = four from each general subject (16),
// nine from 90011, and the rest from 17300, with 60 single + 20 multiple overall.
export function buildMockQueue(
  questions: Question[],
  random = Math.random,
): Question[] {
  const commonCodes = ['90006', '90007', '90008', '90009']
  const bySubject = (code: string) => questions.filter((question) => question.subjectCode === code)
  const kindOf = (pool: Question[], kind: QuestionKind) => pool.filter((question) => question.kind === kind)

  const common = commonCodes.flatMap((code) => shuffled(bySubject(code), random).slice(0, 4))
  const info = shuffled(bySubject('90011'), random).slice(0, 9)
  const occupation = bySubject('17300')

  const usedSingles = kindOf(common, 'single').length + kindOf(info, 'single').length
  const usedMultiples = kindOf(common, 'multiple').length + kindOf(info, 'multiple').length
  const occSingles = shuffled(kindOf(occupation, 'single'), random).slice(0, 60 - usedSingles)
  const occMultiples = shuffled(kindOf(occupation, 'multiple'), random).slice(0, 20 - usedMultiples)

  const queue = [...common, ...info, ...occSingles, ...occMultiples]
  const ok = common.length === 16
    && info.length === 9
    && occSingles.length === 60 - usedSingles
    && occMultiples.length === 20 - usedMultiples
    && kindOf(queue, 'single').length === 60
    && kindOf(queue, 'multiple').length === 20
  if (!ok) throw new Error('The question bank cannot satisfy the official mock format')

  return shuffled(queue, random)
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

// Short 20-question session for a work break: weighted toward wrong, guessed,
// due, and unseen items, and guaranteed to include four common-subject questions.
export function buildSprintQueue(
  questions: Question[],
  progressById: Record<string, Progress>,
  limit = 20,
  now = new Date(),
  random = Math.random,
): Question[] {
  // shuffle first, then stable-sort by priority, so ties stay randomised.
  const ranked = (pool: Question[]) => shuffled(pool, random).sort((a, b) => reviewPriority(b, progressById, now) - reviewPriority(a, progressById, now))

  const common = ranked(questions.filter((question) => question.sourceGroup === 'general-common')).slice(0, 4)
  const commonIds = new Set(common.map((question) => question.id))
  const rest = ranked(questions.filter((question) => !commonIds.has(question.id))).slice(0, Math.max(0, limit - common.length))
  return shuffled([...common, ...rest], random).slice(0, limit)
}
