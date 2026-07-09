import { useMemo, useState } from 'react'
import { Search, Volume2 } from 'lucide-react'
import { useGlossary, type GlossaryEntry } from '../hooks/useGlossary'
import { zhTW } from '../i18n/zh-TW'

interface Props {
  onPracticeSection: (section: string, title: string) => void
}

function matches(entry: GlossaryEntry, query: string): boolean {
  const haystack = [entry.term, entry.pinyin, entry.en, entry.cue, ...entry.aliases].join(' ').toLowerCase()
  return haystack.includes(query)
}

function EntryCard({ entry, onPracticeSection }: { entry: GlossaryEntry } & Props) {
  const [showPinyin, setShowPinyin] = useState(false)
  return (
    <article className="glossary-card">
      <div className="glossary-head">
        <strong className="glossary-term">{entry.term}</strong>
        {showPinyin
          ? <span className="glossary-pinyin">{entry.pinyin}</span>
          : <button className="pinyin-toggle" onClick={() => setShowPinyin(true)} type="button">拼音</button>}
      </div>
      <p className="glossary-en">{entry.en}</p>
      <p className="glossary-cue"><Volume2 size={14} /> {entry.cue}</p>
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

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => (q ? glossary.filter((entry) => matches(entry, q)) : glossary), [glossary, q])
  const examTerms = filtered.filter((entry) => entry.kind === 'exam')
  const terms = filtered.filter((entry) => entry.kind !== 'exam')

  return (
    <main className="page glossary-page">
      <header className="page-title">
        <p className="eyebrow">{zhTW.glossary.eyebrow}</p>
        <h1>{zhTW.glossary.title}</h1>
        <p>{zhTW.glossary.description}</p>
      </header>

      <label className="search-field">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zhTW.glossary.searchPlaceholder} type="search" />
      </label>

      {examTerms.length ? (
        <section className="glossary-group">
          <div className="section-heading compact"><div><p className="eyebrow">{zhTW.glossary.questionWording}</p><h2>{zhTW.glossary.questionWordingHint}</h2></div></div>
          <div className="glossary-list">{examTerms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} />)}</div>
        </section>
      ) : null}

      {terms.length ? (
        <section className="glossary-group">
          <div className="section-heading compact"><div><p className="eyebrow">{zhTW.glossary.vocabulary}</p><h2>{zhTW.glossary.vocabularyHint}</h2></div></div>
          <div className="glossary-list">{terms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} />)}</div>
        </section>
      ) : null}

      {!filtered.length ? <p className="history-empty">{zhTW.glossary.noMatch(query)}</p> : null}
    </main>
  )
}
