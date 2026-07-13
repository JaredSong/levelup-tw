import { ArrowLeft, ChevronDown, Database, HardDrive, Plus, Settings, X } from 'lucide-react'
import { useState } from 'react'
import { SettingsView } from '../components/SettingsView'
import type { Progress, Question } from '../domain/studyEngine'
import { zhTW } from '../i18n/zh-TW'
import { formatExamSwitcherItem } from './activeExam'
import { useActiveExam } from './useActiveExam'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
}

export function ActiveExamHeader({ questions, progress }: Props) {
  const { activeExam, installedExams, setActiveExamId } = useActiveExam()
  const [open, setOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="active-exam-bar" aria-label={zhTW.shell.activeExam}>
      <button className="active-exam-chip" onClick={() => setOpen(true)} title={zhTW.shell.switchExam} type="button">
        <Database size={16} />
        <span>
          <strong>{activeExam.titleZh}</strong>
          <small>{activeExam.category} · {activeExam.level} · {activeExam.version}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      <div className="active-exam-meta">
        <span className="active-exam-status"><HardDrive size={14} /> {zhTW.shell.offline}</span>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} title={zhTW.shell.settingsButton} aria-label={zhTW.shell.settingsButton} type="button">
          <Settings size={17} />
        </button>
      </div>
      {open ? (
        <div className="exam-switcher-overlay" role="presentation" onClick={() => setOpen(false)}>
          <section className="exam-switcher-sheet" aria-modal="true" role="dialog" aria-label={zhTW.shell.chooseExam} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <p className="eyebrow">{zhTW.shell.chooseExam}</p>
                <h2>{zhTW.shell.studyOneExam}</h2>
                <small className="sheet-note">{zhTW.shell.mySubjectsHint}</small>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)} aria-label="關閉考科選單" type="button"><X size={18} /></button>
            </div>
            <div className="exam-switcher-list">
              {installedExams.map((exam) => {
                const item = formatExamSwitcherItem(exam, exam.examId === activeExam.examId)
                return (
                  <button
                    className={exam.examId === activeExam.examId ? 'exam-switcher-item active' : 'exam-switcher-item'}
                    key={item.examId}
                    onClick={() => {
                      setActiveExamId(item.examId)
                      setOpen(false)
                    }}
                    type="button"
                  >
                    <Database size={18} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                      <small>{item.countLabel}</small>
                    </span>
                    <em>{item.statusLabel}</em>
                  </button>
                )
              })}
            </div>
            <button className="exam-catalog-link" type="button" onClick={() => setCatalogOpen(true)}>
              <Plus size={17} />
              <span>
                <strong>{zhTW.shell.addMoreExams}</strong>
                <small>{zhTW.shell.catalogComingSoon}</small>
              </span>
            </button>
          </section>
        </div>
      ) : null}
      {catalogOpen ? (
        <div className="exam-switcher-overlay" role="presentation" onClick={() => setCatalogOpen(false)}>
          <section className="exam-switcher-sheet catalog-sheet" aria-modal="true" role="dialog" aria-label={zhTW.shell.catalogEyebrow} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <p className="eyebrow">{zhTW.shell.catalogEyebrow}</p>
                <h2>{zhTW.shell.catalogTitle}</h2>
                <small className="sheet-note">{zhTW.shell.catalogDescription}</small>
              </div>
              <button className="icon-button" onClick={() => setCatalogOpen(false)} aria-label="關閉考科目錄" type="button"><X size={18} /></button>
            </div>
            <button className="catalog-back" onClick={() => setCatalogOpen(false)} type="button">
              <ArrowLeft size={16} />
              {zhTW.shell.chooseExam}
            </button>
            <div className="catalog-list">
              {installedExams.map((exam) => {
                const isActive = exam.examId === activeExam.examId
                const imageQuestionCount = exam.examId === 'web-design-b'
                  ? 18
                  : exam.examId === 'man-haircut-c' || exam.examId === 'women-hairdressing-c'
                    ? 4
                    : 0
                return (
                  <article className={isActive ? 'catalog-card active' : 'catalog-card'} key={exam.examId}>
                    <div>
                      <p className="eyebrow">{exam.category} · {exam.level}</p>
                      <h3>{exam.titleZh}</h3>
                      <p>{exam.sourceRevision}</p>
                      <div className="catalog-meta">
                        <span>{zhTW.shell.questionPack(exam.activeQuestionCount)}</span>
                        <span>{zhTW.shell.sectionsCount(exam.sections.length)}</span>
                        <span>{zhTW.shell.imageQuestionsCount(imageQuestionCount)}</span>
                      </div>
                    </div>
                    <button
                      className={isActive ? 'secondary-action compact active' : 'primary-action compact'}
                      onClick={() => {
                        setActiveExamId(exam.examId)
                        setCatalogOpen(false)
                        setOpen(false)
                      }}
                      type="button"
                    >
                      {isActive ? zhTW.shell.currentExam : zhTW.shell.useExam}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="mock-overlay" role="presentation" onClick={() => setSettingsOpen(false)}>
          <section className="mock-sheet settings-sheet" aria-modal="true" role="dialog" aria-label={zhTW.shell.settingsTitle} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <p className="eyebrow">{zhTW.shell.settingsEyebrow}</p>
                <h2>{zhTW.shell.settingsTitle}</h2>
              </div>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="關閉設定" type="button"><X size={18} /></button>
            </div>
            <SettingsView progress={progress} questions={questions} />
          </section>
        </div>
      ) : null}
    </div>
  )
}
