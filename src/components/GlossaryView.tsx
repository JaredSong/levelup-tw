import { useMemo, useState } from 'react'
import { ChevronDown, Languages, Search, Volume2 } from 'lucide-react'
import { useGlossary, type GlossaryEntry } from '../hooks/useGlossary'
import { zhTW } from '../i18n/zh-TW'

interface Props {
  onPracticeSection: (section: string, title: string) => void
}

// Learning content is Chinese-first; the English/pinyin aids exist for learners
// who read pinyin better than characters, so they live behind an opt-in toggle.
const ENGLISH_AID_KEY = 'level-up-glossary-english'

function matches(entry: GlossaryEntry, query: string): boolean {
  const haystack = [entry.term, entry.pinyin, entry.en, entry.cue, ...entry.aliases].join(' ').toLowerCase()
  return haystack.includes(query)
}

function EntryCard({ entry, showEnglish, onPracticeSection }: { entry: GlossaryEntry; showEnglish: boolean } & Props) {
  const [showPinyin, setShowPinyin] = useState(false)
  return (
    <article className="glossary-card">
      <div className="glossary-head">
        <strong className="glossary-term">{entry.term}</strong>
        {showEnglish ? (
          showPinyin
            ? <span className="glossary-pinyin">{entry.pinyin}</span>
            : <button className="pinyin-toggle" onClick={() => setShowPinyin(true)} type="button">拼音</button>
        ) : null}
      </div>
      {showEnglish ? <p className="glossary-en">{entry.en}</p> : null}
      {showEnglish ? <p className="glossary-cue"><Volume2 size={14} /> {entry.cue}</p> : null}
      {entry.aliases.length ? (
        <div className="glossary-aliases">{entry.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div>
      ) : null}
      {entry.sections.length ? (
        <div className="glossary-links">
          <span>{zhTW.glossary.questionCount(entry.qids.length)}</span>
          {entry.sections.map((section) => (
            <button key={section} onClick={() => onPracticeSection(section, `${entry.term} · ${section}`)} type="button">{section}</button>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function GlossaryView({ onPracticeSection }: Props) {
  const glossary = useGlossary()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [showEnglish, setShowEnglish] = useState(() => localStorage.getItem(ENGLISH_AID_KEY) === 'true')

  const toggleEnglish = () => {
    setShowEnglish((current) => {
      localStorage.setItem(ENGLISH_AID_KEY, current ? 'false' : 'true')
      return !current
    })
  }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => (q ? glossary.filter((entry) => matches(entry, q)) : glossary), [glossary, q])
  const examTerms = filtered.filter((entry) => entry.kind === 'exam')
  const terms = filtered.filter((entry) => entry.kind !== 'exam')
  const previewTerms = glossary.filter((entry) => entry.kind === 'exam').slice(0, 4)

  return (
    <section className={expanded ? 'glossary-page expanded' : 'glossary-page'}>
      <header className="glossary-summary">
        <div>
          <p className="eyebrow">{zhTW.glossary.eyebrow}</p>
          <h2>{zhTW.glossary.title}</h2>
          <p>{zhTW.glossary.description}</p>
        </div>
        <button aria-expanded={expanded} className="glossary-toggle" onClick={() => setExpanded((current) => !current)} type="button">
          {expanded ? zhTW.common.collapse : zhTW.common.expand}
          <ChevronDown size={17} />
        </button>
      </header>

      {!expanded ? (
        <div className="glossary-preview">
          {previewTerms.map((entry) => <span key={entry.term}>{entry.term}</span>)}
        </div>
      ) : null}

      {expanded ? (
        <>
          <div className="glossary-tools">
            <label className="search-field">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zhTW.glossary.searchPlaceholder} type="search" />
            </label>
            <button className={showEnglish ? 'english-aid-toggle active' : 'english-aid-toggle'} onClick={toggleEnglish} type="button">
              <Languages size={15} /> {zhTW.glossaryToggle.english}
            </button>
          </div>

          {examTerms.length ? (
            <section className="glossary-group">
              <div className="section-heading compact"><div><p className="eyebrow">{zhTW.glossary.questionWording}</p><h2>{zhTW.glossary.questionWordingHint}</h2></div></div>
              <div className="glossary-list">{examTerms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} showEnglish={showEnglish} />)}</div>
            </section>
          ) : null}

          {terms.length ? (
            <section className="glossary-group">
              <div className="section-heading compact"><div><p className="eyebrow">{zhTW.glossary.vocabulary}</p><h2>{zhTW.glossary.vocabularyHint}</h2></div></div>
              <div className="glossary-list">{terms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} showEnglish={showEnglish} />)}</div>
            </section>
          ) : null}

          {!filtered.length ? <p className="history-empty">{zhTW.glossary.noMatch(query)}</p> : null}
        </>
      ) : null}
    </section>
  )
}
