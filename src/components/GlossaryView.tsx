import { useMemo, useState } from 'react'
import { Search, Volume2 } from 'lucide-react'
import { useGlossary, type GlossaryEntry } from '../hooks/useGlossary'

interface Props {
  onPracticeSection: (section: string, title: string) => void
}

function matches(entry: GlossaryEntry, query: string): boolean {
  const haystack = [entry.term, entry.pinyin, entry.en, entry.cue, ...entry.aliases].join(' ').toLowerCase()
  return haystack.includes(query)
}

function EntryCard({ entry, onPracticeSection }: { entry: GlossaryEntry } & Props) {
  return (
    <article className="glossary-card">
      <div className="glossary-head">
        <strong className="glossary-term">{entry.term}</strong>
        <span className="glossary-pinyin">{entry.pinyin}</span>
      </div>
      <p className="glossary-en">{entry.en}</p>
      <p className="glossary-cue"><Volume2 size={14} /> {entry.cue}</p>
      {entry.aliases.length ? (
        <div className="glossary-aliases">{entry.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div>
      ) : null}
      {entry.sections.length ? (
        <div className="glossary-links">
          <span>{entry.qids.length} question{entry.qids.length === 1 ? '' : 's'}</span>
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
        <p className="eyebrow">Bilingual glossary</p>
        <h1>Terms</h1>
        <p>Chinese term, pinyin, plain English, and a memory cue. Tap a section to practise it.</p>
      </header>

      <label className="search-field">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 中文, pinyin, or English…" type="search" />
      </label>

      {examTerms.length ? (
        <section className="glossary-group">
          <div className="section-heading compact"><div><p className="eyebrow">Question wording</p><h2>How the exam phrases things</h2></div></div>
          <div className="glossary-list">{examTerms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} />)}</div>
        </section>
      ) : null}

      {terms.length ? (
        <section className="glossary-group">
          <div className="section-heading compact"><div><p className="eyebrow">Vocabulary</p><h2>Technical &amp; legal terms</h2></div></div>
          <div className="glossary-list">{terms.map((entry) => <EntryCard entry={entry} key={entry.term} onPracticeSection={onPracticeSection} />)}</div>
        </section>
      ) : null}

      {!filtered.length ? <p className="history-empty">No terms match “{query}”.</p> : null}
    </main>
  )
}
