import { Database, KeyRound, Search, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { zhTW } from '../i18n/zh-TW'
import { setSyncPass } from '../storage/sync'
import { ONBOARDING_DONE_KEY, PROFILE_NAME_KEY } from './onboardingState'
import { useActiveExam } from './useActiveExam'

interface Props {
  onComplete: () => void
}

export function OnboardingGate({ onComplete }: Props) {
  const { activeExam, installedExams, setActiveExamId } = useActiveExam()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [examId, setExamId] = useState(activeExam.examId)
  const [subjectSearch, setSubjectSearch] = useState('')
  const normalizedSearch = subjectSearch.trim().toLowerCase()
  const filteredExams = useMemo(() => {
    if (!normalizedSearch) return installedExams
    return installedExams.filter((exam) => {
      const haystack = [
        exam.examId,
        exam.titleZh,
        exam.titleEn,
        exam.category,
        exam.level,
        exam.version,
        exam.sourceRevision,
        ...exam.sections.flatMap((section) => [section.id, section.subjectCode, section.titleZh]),
      ].join(' ').toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [installedExams, normalizedSearch])
  const selectedExamId = filteredExams.some((exam) => exam.examId === examId)
    ? examId
    : filteredExams[0]?.examId ?? examId

  const complete = (syncValue = passphrase) => {
    const trimmedName = name.trim()
    const trimmedPassphrase = syncValue.trim()
    if (trimmedName) localStorage.setItem(PROFILE_NAME_KEY, trimmedName)
    else localStorage.removeItem(PROFILE_NAME_KEY)
    if (trimmedPassphrase) setSyncPass(trimmedPassphrase)
    setActiveExamId(selectedExamId)
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
    onComplete()
  }

  return (
    <div className="onboarding-screen">
      <section className="onboarding-card" aria-label={zhTW.onboarding.title}>
        <header>
          <p className="eyebrow">{step === 1 ? zhTW.onboarding.stepProfile : zhTW.onboarding.stepSubject}</p>
          <h1>{zhTW.onboarding.title}</h1>
          <p>{zhTW.onboarding.description}</p>
        </header>

        {step === 1 ? (
          <div className="onboarding-fields">
            <label>
              <span><UserRound size={16} /> {zhTW.onboarding.nameLabel}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={zhTW.onboarding.namePlaceholder} />
            </label>
            <label>
              <span><KeyRound size={16} /> {zhTW.onboarding.syncLabel}</span>
              <input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={zhTW.onboarding.syncPlaceholder} type="password" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-subjects">
            <p className="eyebrow">{zhTW.onboarding.subjectLabel}</p>
            <label className="onboarding-subject-search">
              <Search size={17} />
              <input
                aria-label={zhTW.onboarding.subjectSearch}
                onChange={(event) => setSubjectSearch(event.target.value)}
                placeholder={zhTW.onboarding.subjectSearchPlaceholder}
                type="search"
                value={subjectSearch}
              />
            </label>
            <div className="onboarding-subject-list">
              {filteredExams.map((exam) => (
                <button className={exam.examId === selectedExamId ? 'selected' : ''} key={exam.examId} onClick={() => setExamId(exam.examId)} type="button">
                  <Database size={18} />
                  <span>
                    <strong>{exam.titleZh}</strong>
                    <small>{exam.category} · {exam.level} · {exam.version}</small>
                  </span>
                  <em>{zhTW.onboarding.subjectCount(exam.activeQuestionCount)}</em>
                </button>
              ))}
              {!filteredExams.length ? <p className="onboarding-empty">{zhTW.onboarding.noSubjectMatch}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="onboarding-actions">
          {step === 1 ? (
            <>
              <button className="primary-action" onClick={() => setStep(2)} type="button">{zhTW.onboarding.next}</button>
              <button className="secondary-action" onClick={() => { setPassphrase(''); setStep(2) }} type="button">{zhTW.onboarding.skipSync}</button>
            </>
          ) : (
            <>
              <button className="primary-action" onClick={() => complete()} type="button">{zhTW.onboarding.start}</button>
              <button className="secondary-action" onClick={() => setStep(1)} type="button">{zhTW.onboarding.back}</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
