import { Database, KeyRound, Search, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { zhTW } from '../i18n/zh-TW'
import { setSyncPass } from '../storage/sync'
import { ONBOARDING_DONE_KEY, PROFILE_NAME_KEY } from './onboardingState'
import { useActiveExam } from './useActiveExam'

interface Props {
  onComplete: () => void
}

// Subject comes first because it is the only answer the app actually needs to
// work, and it is the shortest path to studying. The name is a greeting and the
// passphrase only matters to the minority who already have another device, so
// both wait until after the real choice is made.
export function OnboardingGate({ onComplete }: Props) {
  const { activeExam, installedExams, setActiveExamId } = useActiveExam()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '')
  const [restoring, setRestoring] = useState(false)
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

  const trimmedName = name.trim()
  const trimmedPassphrase = passphrase.trim()
  // Restoring keys the cloud record on name + passphrase, so an empty name or a
  // too-short passphrase would quietly resolve to somebody else's record (or an
  // empty one) instead of this learner's progress. Block rather than mislead.
  const restoreError = !restoring
    ? null
    : !trimmedName
      ? zhTW.onboarding.restoreNeedsName
      : trimmedPassphrase.length < 8
        ? zhTW.onboarding.syncTooShort
        : null

  const complete = () => {
    if (restoreError) return
    if (trimmedName) localStorage.setItem(PROFILE_NAME_KEY, trimmedName)
    else localStorage.removeItem(PROFILE_NAME_KEY)
    // Only a deliberate restore stores a passphrase; leaving the panel closed is
    // what "local only" means, so a half-typed value can never enable sync.
    if (restoring && trimmedPassphrase) setSyncPass(trimmedPassphrase)
    setActiveExamId(selectedExamId)
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
    onComplete()
  }

  return (
    <div className="onboarding-screen">
      <section className="onboarding-card" aria-label={zhTW.onboarding.eyebrow}>
        <header>
          <p className="eyebrow">{step === 1 ? zhTW.onboarding.stepSubject : zhTW.onboarding.stepProfile}</p>
          <h1>{step === 1 ? zhTW.onboarding.subjectTitle : zhTW.onboarding.profileTitle}</h1>
          <p>{step === 1 ? zhTW.onboarding.subjectDescription : zhTW.onboarding.profileDescription}</p>
        </header>

        {step === 1 ? (
          <div className="onboarding-subjects">
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

        {step === 2 ? (
          <div className="onboarding-fields">
            <label>
              <span><UserRound size={16} /> {zhTW.onboarding.nameLabel} <em>{zhTW.onboarding.nameOptional}</em></span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={zhTW.onboarding.namePlaceholder} />
            </label>

            {restoring ? (
              <div className="onboarding-restore">
                <p className="onboarding-restore-head"><KeyRound size={15} /> {zhTW.onboarding.restoreTitle}</p>
                <p className="onboarding-restore-hint">{zhTW.onboarding.restoreHint}</p>
                <label>
                  <span>{zhTW.onboarding.syncLabel}</span>
                  <input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={zhTW.onboarding.syncPlaceholder} type="password" />
                </label>
                {restoreError ? <p className="inline-error">{restoreError}</p> : null}
              </div>
            ) : (
              <button className="onboarding-restore-toggle" onClick={() => setRestoring(true)} type="button">
                <KeyRound size={15} /> {zhTW.onboarding.restoreToggle}
              </button>
            )}
          </div>
        ) : null}

        <div className="onboarding-actions">
          {step === 1 ? (
            <button className="primary-action" onClick={() => setStep(2)} type="button">{zhTW.onboarding.next}</button>
          ) : (
            <>
              <button className="primary-action" disabled={!!restoreError} onClick={complete} type="button">{zhTW.onboarding.start}</button>
              <button className="secondary-action" onClick={() => setStep(1)} type="button">{zhTW.onboarding.back}</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
