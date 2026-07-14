import { Database, KeyRound, UserRound } from 'lucide-react'
import { useState } from 'react'
import { zhTW } from '../i18n/zh-TW'
import { setSyncPass } from '../storage/sync'
import { ONBOARDING_DONE_KEY, PROFILE_NAME_KEY } from './onboardingState'
import { useActiveExam } from './useActiveExam'

interface Props {
  onComplete: () => void
}

export function OnboardingGate({ onComplete }: Props) {
  const { activeExam, installedExams, setActiveExamId } = useActiveExam()
  const [name, setName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [examId, setExamId] = useState(activeExam.examId)

  const complete = (syncValue = passphrase) => {
    const trimmedName = name.trim()
    const trimmedPassphrase = syncValue.trim()
    if (trimmedName) localStorage.setItem(PROFILE_NAME_KEY, trimmedName)
    else localStorage.removeItem(PROFILE_NAME_KEY)
    if (trimmedPassphrase) setSyncPass(trimmedPassphrase)
    setActiveExamId(examId)
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true')
    onComplete()
  }

  return (
    <div className="onboarding-screen">
      <section className="onboarding-card" aria-label={zhTW.onboarding.title}>
        <header>
          <p className="eyebrow">{zhTW.onboarding.eyebrow}</p>
          <h1>{zhTW.onboarding.title}</h1>
          <p>{zhTW.onboarding.description}</p>
        </header>

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

        <div className="onboarding-subjects">
          <p className="eyebrow">{zhTW.onboarding.subjectLabel}</p>
          <div className="onboarding-subject-list">
            {installedExams.map((exam) => (
              <button className={exam.examId === examId ? 'selected' : ''} key={exam.examId} onClick={() => setExamId(exam.examId)} type="button">
                <Database size={18} />
                <span>
                  <strong>{exam.titleZh}</strong>
                  <small>{exam.category} · {exam.level} · {exam.version}</small>
                </span>
                <em>{zhTW.onboarding.subjectCount(exam.activeQuestionCount)}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="primary-action" onClick={() => complete()} type="button">{zhTW.onboarding.start}</button>
          <button className="secondary-action" onClick={() => complete('')} type="button">{zhTW.onboarding.skipSync}</button>
        </div>
      </section>
    </div>
  )
}
