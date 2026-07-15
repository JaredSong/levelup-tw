import { Bookmark, ChevronDown, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Progress, Question } from '../domain/studyEngine'
import { zhTW } from '../i18n/zh-TW'

type Filter = 'all' | 'wrong' | 'due' | 'bookmarked' | 'unseen'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
  onOpen: (question: Question) => void
}

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: zhTW.practice.filters.all },
  { id: 'wrong', label: zhTW.practice.filters.wrong },
  { id: 'due', label: zhTW.practice.filters.due },
  { id: 'bookmarked', label: zhTW.practice.filters.saved },
  { id: 'unseen', label: zhTW.practice.filters.unseen },
]

// A browsable index of every question in the bank. It is a reference tool, not
// the reason to open Practice, so it collapses: expanded it is over a thousand
// rows and buries the practice modes above it. Mirrors the glossary panel on
// Review — same shared `.collapse-*` shell.
export function LibraryView({ questions, progress, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false)
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
    <section className={expanded ? 'collapse-panel expanded' : 'collapse-panel'}>
      <header className="collapse-head">
        <div>
          <p className="eyebrow">{zhTW.practice.allQuestionsEyebrow}</p>
          <h2>{zhTW.practice.allQuestionsTitle}</h2>
          <p>{zhTW.practice.allQuestionsDescription}</p>
        </div>
        <button aria-expanded={expanded} className="collapse-toggle" onClick={() => setExpanded((current) => !current)} type="button">
          {expanded ? zhTW.common.collapse : zhTW.common.expand}
          <ChevronDown size={17} />
        </button>
      </header>

      {!expanded ? (
        <div className="collapse-preview">
          <span>{zhTW.practice.itemCount(questions.length)}</span>
        </div>
      ) : null}

      {expanded ? (
        <>
          <label className="search-field">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zhTW.practice.searchPlaceholder} />
          </label>

          <div className="filter-row" aria-label={zhTW.practice.filterAria}>
            {filters.map((item) => (
              <button className={filter === item.id ? 'selected' : ''} key={item.id} onClick={() => setFilter(item.id)} type="button">
                {item.label}
              </button>
            ))}
          </div>

          <div className="section-filter">
            <SlidersHorizontal size={17} />
            <select value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="all">{zhTW.practice.allSections}</option>
              {sections.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <span>{zhTW.practice.itemCount(matches.length)}</span>
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
                    <small>{item?.attempts && accuracy !== null ? zhTW.practice.attempts(item.attempts, accuracy) : zhTW.practice.notAttempted}</small>
                  </span>
                  {item?.bookmarked ? <Bookmark className="bookmark-mark" size={16} fill="currentColor" /> : null}
                  <ChevronRight size={18} />
                </button>
              )
            })}
          </div>
          {matches.length > limit ? (
            <button className="load-more" onClick={() => setLimit((value) => value + 80)} type="button">{zhTW.practice.showMore}</button>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
