import { Bookmark, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'

type Filter = 'all' | 'wrong' | 'due' | 'bookmarked' | 'unseen'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  onOpen: (question: Question) => void
}

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wrong', label: 'Wrong' },
  { id: 'due', label: 'Due' },
  { id: 'bookmarked', label: 'Saved' },
  { id: 'unseen', label: 'Unseen' },
]

export function LibraryView({ questions, progress, onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [section, setSection] = useState('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(80)
  const now = Date.now()
  const sections = useMemo(() => Array.from(new Map(questions.map((question) => [
    question.section,
    `${question.subjectCode} · ${question.sectionTitle}`,
  ])).entries()), [questions])

  const matches = useMemo(() => questions.filter((question) => {
    const item = progress[question.id]
    const isDue = item?.nextReviewAt ? new Date(item.nextReviewAt).getTime() <= now : false
    const statusMatch =
      filter === 'all' ||
      (filter === 'wrong' && !!item?.wrong && item.streak < 2) ||
      (filter === 'due' && isDue) ||
      (filter === 'bookmarked' && !!item?.bookmarked) ||
      (filter === 'unseen' && !item?.attempts)
    return statusMatch &&
      (section === 'all' || question.section === section) &&
      (!query || `${question.id} ${question.prompt}`.toLowerCase().includes(query.toLowerCase()))
  }), [filter, now, progress, query, questions, section])

  return (
    <main className="page library-page">
      <header className="page-title">
        <p className="eyebrow">Item record</p>
        <h1>Question bank</h1>
        <p>Every attempt stays attached to its exact item.</p>
      </header>

      <label className="search-field">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number or question" />
      </label>

      <div className="filter-row" aria-label="Question status filter">
        {filters.map((item) => (
          <button className={filter === item.id ? 'selected' : ''} key={item.id} onClick={() => setFilter(item.id)} type="button">
            {item.label}
          </button>
        ))}
      </div>

      <div className="section-filter">
        <SlidersHorizontal size={17} />
        <select value={section} onChange={(event) => setSection(event.target.value)}>
          <option value="all">All work sections</option>
          {sections.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span>{matches.length} items</span>
      </div>

      <div className="item-list">
        {matches.slice(0, limit).map((question) => {
          const item = progress[question.id]
          const accuracy = item?.attempts ? Math.round((item.correct / item.attempts) * 100) : null
          return (
            <button key={question.id} onClick={() => onOpen(question)} type="button">
              <span className="item-id">{question.id}</span>
              <span className="item-copy">
                <strong>{question.prompt}</strong>
                <small>{item?.attempts ? `${item.attempts} attempts · ${accuracy}% correct` : 'Not attempted'}</small>
              </span>
              {item?.bookmarked ? <Bookmark className="bookmark-mark" size={16} fill="currentColor" /> : null}
              <ChevronRight size={18} />
            </button>
          )
        })}
      </div>
      {matches.length > limit ? (
        <button className="load-more" onClick={() => setLimit((value) => value + 80)} type="button">Show more</button>
      ) : null}
    </main>
  )
}
