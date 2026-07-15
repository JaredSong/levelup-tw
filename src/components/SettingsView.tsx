import { Download, ExternalLink, FileWarning, Moon, RefreshCw, RotateCcw, Shuffle, Sun, Upload } from 'lucide-react'
import { useState } from 'react'
import { getExamDate, setExamDate } from '../app/examCountdown'
import { getNextNationalExamEntry, isScheduleEntryPast, NATIONAL_EXAM_SCHEDULE_115, NATIONAL_EXAM_SCHEDULE_SOURCE } from '../app/nationalExamSchedule'
import { PROFILE_NAME_KEY } from '../app/onboardingState'
import { useActiveExam } from '../app/useActiveExam'
import type { Progress, Question } from '../domain/studyEngine'
import { zhTW } from '../i18n/zh-TW'
import { exportBackup, importBackup } from '../storage/backup'
import { getSyncPass, setSyncPass, syncNow, syncStatusLabel } from '../storage/sync'

const OPTION_RANDOMIZE_KEY = 'level-b-randomize-options'

interface Props {
  questions: Question[]
  progress: Record<string, Progress>
}

interface OfficialLinkItem {
  label: string
  href: string
}

// Settings is a secondary shell surface (docs/level-up-interface-spec.md): local
// app behavior only, reached from the gear icon rather than the bottom nav, so
// it stays out of the way until there is more than one exam pack to manage.
export function SettingsView({ questions, progress }: Props) {
  const { activeExam } = useActiveExam()
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('level-b-ai-provider') ?? 'openai')
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const [randomizeOptions, setRandomizeOptions] = useState(() => localStorage.getItem(OPTION_RANDOMIZE_KEY) !== 'false')
  const [examDateValue, setExamDateValue] = useState(() => getExamDate() ?? '')
  const showAiSettings = !!localStorage.getItem('level-b-ai-access-token') || new URLSearchParams(window.location.search).has('ai')
  const now = new Date()
  const nextNationalExam = getNextNationalExamEntry(now)
  const officialLinks = activeExam.officialLinks
  const officialLinkItems: OfficialLinkItem[] = []
  if (officialLinks?.registration) officialLinkItems.push({ label: zhTW.stats.officialRegistration, href: officialLinks.registration })
  if (officialLinks?.handbook) officialLinkItems.push({ label: zhTW.stats.officialHandbook, href: officialLinks.handbook })
  if (officialLinks?.scoreLookup) officialLinkItems.push({ label: zhTW.stats.officialScoreLookup, href: officialLinks.scoreLookup })
  if (officialLinks?.questionBank) officialLinkItems.push({ label: zhTW.stats.officialQuestionBank, href: officialLinks.questionBank })

  const chooseTheme = (value: 'light' | 'dark') => {
    setTheme(value)
    localStorage.setItem('level-b-theme', value)
    document.documentElement.dataset.theme = value
  }

  const chooseRandomizeOptions = (value: boolean) => {
    setRandomizeOptions(value)
    localStorage.setItem(OPTION_RANDOMIZE_KEY, value ? 'true' : 'false')
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { hadRemote } = await syncNow(localStorage.getItem(PROFILE_NAME_KEY) ?? '')
      setSyncMsg(hadRemote ? zhTW.stats.syncMerged : zhTW.stats.syncUploaded)
      if (hadRemote) window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setSyncMsg(error instanceof Error ? error.message : zhTW.stats.syncFailed)
    } finally {
      setSyncing(false)
    }
  }

  const chooseProvider = (value: string) => {
    setAiProvider(value)
    localStorage.setItem('level-b-ai-provider', value)
  }

  const download = (content: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    download(await exportBackup(), `level-up-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const handleExportWrong = () => {
    const wrong = questions.filter((question) => (progress[question.id]?.wrong ?? 0) > 0)
    if (!wrong.length) {
      setDataMsg(zhTW.stats.noWrongYet)
      return
    }
    const blocks = wrong.map((question, index) => {
      const item = progress[question.id]
      const mastered = (item?.streak ?? 0) >= 2 ? ' [已熟練]' : ''
      const options = question.options
        .map((option, optionIndex) => `   ${question.answers.includes(optionIndex + 1) ? '✓' : ' '} ${optionIndex + 1}. ${option}`)
        .join('\n')
      return `${index + 1}. [${question.id}] ${question.sectionTitle ?? ''} · 錯 ${item?.wrong ?? 0} 次${mastered}\n${question.prompt}\n${options}`
    })
    const header = `升級吧 — 錯題匯出（${wrong.length} 題）\n匯出時間：${new Date().toLocaleString()}\n✓ 為官方正確答案。\n`
    download(`${header}\n${blocks.join('\n\n')}\n`, `level-up-wrong-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8')
    setDataMsg(zhTW.stats.exportedWrong(wrong.length))
  }

  const handleImport = async (file: File) => {
    try {
      await importBackup(await file.text())
      setDataMsg(zhTW.stats.importDone)
      window.setTimeout(() => window.location.reload(), 800)
    } catch (error) {
      setDataMsg(error instanceof Error ? error.message : zhTW.stats.importFailed)
    }
  }

  return (
    <div className="settings-view">
      <section className="appearance">
        <h2>{zhTW.stats.appearanceTitle}</h2>
        <p>{zhTW.stats.appearanceHint}</p>
        <div className="theme-toggle" role="group" aria-label="Theme">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => chooseTheme('light')} type="button"><Sun size={16} /> {zhTW.stats.themeLight}</button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => chooseTheme('dark')} type="button"><Moon size={16} /> {zhTW.stats.themeDark}</button>
        </div>
      </section>

      <section className="appearance">
        <h2>{zhTW.stats.practiceOptionsTitle}</h2>
        <p>{zhTW.stats.practiceOptionsHint}</p>
        <div className="theme-toggle" role="group" aria-label="Answer choice order">
          <button className={randomizeOptions ? 'active' : ''} onClick={() => chooseRandomizeOptions(true)} type="button"><Shuffle size={16} /> {zhTW.stats.optionRandom}</button>
          <button className={!randomizeOptions ? 'active' : ''} onClick={() => chooseRandomizeOptions(false)} type="button"><RotateCcw size={16} /> {zhTW.stats.optionOfficial}</button>
        </div>
      </section>

      <section className="appearance">
        <h2>{zhTW.stats.examDateTitle}</h2>
        <p>{zhTW.stats.examDateHint}</p>
        <div className="schedule-buttons" role="group" aria-label={zhTW.stats.examDateOfficial}>
          {NATIONAL_EXAM_SCHEDULE_115.map((entry) => {
            const isPast = isScheduleEntryPast(entry, now)
            const isNext = nextNationalExam?.id === entry.id
            const isSelected = examDateValue === entry.writtenDate
            return (
              <button
                className={isSelected ? 'active' : ''}
                key={entry.id}
                onClick={() => {
                  setExamDate(entry.writtenDate)
                  setExamDateValue(entry.writtenDate)
                }}
                type="button"
              >
                <strong>{entry.label}</strong>
                <span>{entry.writtenDate}</span>
                <em>{isNext ? zhTW.stats.examDateNext : isPast ? zhTW.stats.examDatePast : ''}</em>
              </button>
            )
          })}
        </div>
        <label className="exam-date-field">
          <span>{zhTW.stats.examDateManual}</span>
          <input
            onBlur={(event) => setExamDate(event.target.value)}
            onChange={(event) => setExamDateValue(event.target.value)}
            type="date"
            value={examDateValue}
          />
        </label>
        <p className="source-note"><a href={NATIONAL_EXAM_SCHEDULE_SOURCE} rel="noreferrer" target="_blank">{zhTW.stats.examDateSource}</a></p>
      </section>

      <section className="official-info">
        <div>
          <p className="eyebrow">{zhTW.stats.officialInfoEyebrow}</p>
          <h2>{zhTW.stats.officialInfoTitle}</h2>
          <p>{zhTW.stats.officialInfoHint}</p>
          {nextNationalExam ? (
            <p className="official-deadline">{zhTW.stats.officialInfoSchedule(nextNationalExam.label, nextNationalExam.registrationStart, nextNationalExam.registrationEnd)}</p>
          ) : null}
        </div>
        <div className="official-link-grid">
          {officialLinkItems.map((item) => (
            <a href={item.href} key={item.label} rel="noreferrer" target="_blank">
              {item.label}
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      </section>

      <section className="data-backup">
        <div>
          <p className="eyebrow">{zhTW.stats.dataEyebrow}</p>
          <h2>{zhTW.stats.dataTitle}</h2>
          <p>{zhTW.stats.dataHint}</p>
        </div>
        <div className="backup-actions">
          <button className="secondary-action" onClick={() => void handleExport()} type="button"><Download size={17} /> {zhTW.stats.exportBackup}</button>
          <label className="secondary-action file-button">
            <Upload size={17} /> {zhTW.stats.importBackup}
            <input accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); event.target.value = '' }} type="file" />
          </label>
          <button className="secondary-action" onClick={handleExportWrong} type="button"><FileWarning size={17} /> {zhTW.stats.exportWrong}</button>
        </div>
        {dataMsg ? <p className="backup-msg">{dataMsg}</p> : null}
      </section>

      <section className="cloud-sync">
        <div>
          <p className="eyebrow">{zhTW.stats.syncEyebrow}</p>
          <h2>{zhTW.stats.syncTitle}</h2>
          <p>{zhTW.stats.syncHint}</p>
          <p className={getSyncPass() ? 'sync-status ok' : 'sync-status warn'}>{syncStatusLabel()}</p>
        </div>
        <label>
          <span>{zhTW.stats.syncPassLabel}</span>
          <input defaultValue={getSyncPass()} onBlur={(event) => setSyncPass(event.target.value.trim())} placeholder={zhTW.stats.syncPassPlaceholder} type="password" />
        </label>
        <button className="secondary-action" disabled={syncing} onClick={() => void handleSync()} type="button"><RefreshCw size={17} /> {syncing ? zhTW.stats.syncing : zhTW.stats.syncNow}</button>
        {syncMsg ? <p className="backup-msg">{syncMsg}</p> : null}
      </section>

      {showAiSettings ? (
        // Live AI is a private/developer feature (docs/level-up-public-app-plan.md:
        // public build ships bundled explanations only). Hidden unless a token is
        // already configured; open with ?ai=1 to set up a new device.
        <section className="ai-settings">
          <div>
            <p className="eyebrow">Optional</p>
            <h2>AI explanations</h2>
            <p>Pick which model explains answered items. Provider keys stay on the server.</p>
          </div>
          <div className="provider-toggle" role="group" aria-label="AI provider">
            <button className={aiProvider === 'anthropic' ? 'active' : ''} onClick={() => chooseProvider('anthropic')} type="button">Claude</button>
            <button className={aiProvider === 'openai' ? 'active' : ''} onClick={() => chooseProvider('openai')} type="button">OpenAI</button>
            <button className={aiProvider === 'gemini' ? 'active' : ''} onClick={() => chooseProvider('gemini')} type="button">Gemini</button>
          </div>
          <label>
            <span>Private app access token</span>
            <input defaultValue={localStorage.getItem('level-b-ai-access-token') ?? ''} onBlur={(event) => localStorage.setItem('level-b-ai-access-token', event.target.value.trim())} placeholder="Not configured" type="password" />
          </label>
        </section>
      ) : null}

      <p className="build-version">升級吧 · Level Up {__APP_VERSION__}</p>
    </div>
  )
}
