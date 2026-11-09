import { ArrowRight, ArrowUpRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ExamManifest } from '../core/exam'
import { zhTW } from '../i18n/zh-TW'
import { trackLanding } from './analytics'
import { categoryIcon } from './categoryIcons'
import { ExamCard } from './ExamCard'
import { DEMAND_PERIOD, DEMAND_SOURCE, groupByCategory, levelsOf, matchesFilter } from './examCatalog'
import { GUIDE_PATH } from './seoUrls'

interface Props {
  exams: ExamManifest[]
  /** Enter the study app (generic — the app opens on its own exam picker). */
  onEnter: () => void
  onHome: () => void
}

/** "58,693" → "58,000+": a floor that stays true as banks grow between releases. */
function questionFloor(total: number): string {
  return total >= 1000 ? `${Math.floor(total / 1000).toLocaleString('en-US')},000+` : String(total)
}

// /exams/ — every published exam, grouped by trade, with search and a level
// filter. Prerendered with all cards visible (it is the crawl hub that links
// each /exam/<id>/ page); filtering only hides cards after hydration.
export function CatalogPage({ exams, onEnter, onHome }: Props) {
  const t = zhTW.catalog
  const lt = zhTW.landing
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')

  // Landing search submits to /exams/?q=…; read it after mount so the
  // prerendered markup (no query) and the first client render agree.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setQuery(q)
  }, [])

  // Keep the URL shareable without adding history entries per keystroke.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (query.trim()) url.searchParams.set('q', query.trim())
    else url.searchParams.delete('q')
    if (url.href !== window.location.href) history.replaceState(history.state, '', url)
  }, [query])

  const groups = useMemo(() => groupByCategory(exams), [exams])
  const levels = useMemo(() => levelsOf(exams), [exams])
  const total = useMemo(() => exams.reduce((sum, exam) => sum + exam.activeQuestionCount, 0), [exams])
  const filter = { query, level, category: '' }
  const visibleGroups = groups
    .map((group) => ({ ...group, shown: group.exams.filter((exam) => matchesFilter(exam, filter)) }))
    .filter((group) => group.shown.length)
  const shownCount = visibleGroups.reduce((sum, group) => sum + group.shown.length, 0)
  const filtered = Boolean(query.trim() || level)

  const homeClick = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    onHome()
  }
  const enter = (source: string) => {
    trackLanding('catalog_cta', { source })
    onEnter()
  }
  const clear = () => {
    setQuery('')
    setLevel('')
  }
  const cardStrings = { examCount: lt.examCount, mockSpec: lt.mockSpec, applicants: lt.applicants, cardAction: t.cardAction }

  return (
    <main className="exam-page catalog-page">
      <div className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={lt.brand}>
          <a className="landing-brand" href="/" onClick={homeClick} aria-label={lt.brand}>
            <img alt={lt.brandAlt} src="/app-icon.svg" />
            <span>
              <strong>{lt.brand}</strong>
              <small>{lt.navTagline}</small>
            </span>
          </a>
          <div className="landing-nav-actions">
            <button className="landing-nav-action landing-nav-primary" onClick={() => enter('nav')} type="button">
              {t.startFree}<ArrowRight size={16} />
            </button>
          </div>
        </nav>
      </div>

      <nav className="exam-crumb" aria-label="breadcrumb">
        <a href="/" onClick={homeClick}>{t.home}</a>
        <span aria-hidden="true">/</span>
        <span className="exam-crumb-current">{t.crumb}</span>
      </nav>

      <header className="catalog-hero">
        <p className="landing-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="catalog-lead">{t.lead(exams.length, questionFloor(total))}</p>
      </header>

      <div className="catalog-toolbar">
        <label className="catalog-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label={t.clear} onClick={() => setQuery('')}><X size={16} /></button>
          ) : null}
        </label>
        <div className="catalog-levels" role="group" aria-label={t.levelLabel}>
          {['', ...levels].map((value) => (
            <button type="button" key={value || 'all'} aria-pressed={level === value} onClick={() => setLevel(value)}>
              {value || t.levelAll}
            </button>
          ))}
        </div>
        <p className="catalog-count" aria-live="polite">{t.resultCount(shownCount, exams.length)}</p>
      </div>

      <div className="catalog-body">
        <aside className="catalog-rail" aria-label={t.categoryLabel}>
          <p className="catalog-rail-title">{t.categoryLabel}</p>
          <ul>
            {groups.map((group) => {
              const Icon = categoryIcon(group.category)
              const shown = visibleGroups.find((g) => g.slug === group.slug)?.shown.length ?? 0
              return (
                <li key={group.slug}>
                  <a href={`#${group.slug}`} aria-disabled={shown === 0 || undefined}>
                    <Icon size={16} aria-hidden="true" />
                    <span>{group.category}</span>
                    <small>{filtered ? shown : group.exams.length}</small>
                  </a>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="catalog-results">
          {visibleGroups.map((group) => (
            <section className="catalog-group" id={group.slug} key={group.slug} aria-labelledby={`${group.slug}-title`}>
              <h2 id={`${group.slug}-title`}>
                {group.category}
                <span>{lt.categoryCount(group.shown.length)}</span>
              </h2>
              <div className="exam-card-grid">
                {group.shown.map((exam, index) => (
                  <ExamCard exam={exam} key={exam.examId} t={cardStrings} location="catalog" index={index} />
                ))}
              </div>
            </section>
          ))}
          {!shownCount ? (
            <div className="catalog-empty">
              <p>{t.empty}</p>
              <button className="landing-secondary" type="button" onClick={clear}>{t.clear}</button>
            </div>
          ) : null}

          {DEMAND_PERIOD ? (
            <p className="catalog-note">
              {lt.demandNote(DEMAND_PERIOD.year, DEMAND_PERIOD.month)}{' '}
              <a href={DEMAND_SOURCE} rel="noopener noreferrer" target="_blank">{lt.demandSource}<ArrowUpRight size={13} /></a>
            </p>
          ) : null}

          <section className="catalog-missing">
            <h2>{t.missingTitle}</h2>
            <p>{t.missingBody}</p>
            <a href={GUIDE_PATH}>{t.guideLink}<ArrowRight size={15} /></a>
          </section>
        </div>
      </div>

      <section className="landing-final">
        <h2>{lt.finalTitle}</h2>
        <p>{lt.finalBody}</p>
        <div className="landing-final-actions">
          <button className="landing-primary landing-primary-light" onClick={() => enter('final')} type="button">
            {t.startFree}<ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <p>{lt.footerNote}</p>
      </footer>
    </main>
  )
}
