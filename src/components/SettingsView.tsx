import { Download, ExternalLink, FileWarning, LogOut, Moon, RefreshCw, RotateCcw, Shuffle, Sun, Upload } from 'lucide-react'
import { useState } from 'react'
import { getExamDate, setExamDate } from '../app/examCountdown'
import { formatSyncCode, normalizeSyncCode } from '../app/syncCode'
import { getNextNationalExamEntry, isScheduleEntryPast, NATIONAL_EXAM_SCHEDULE_115, NATIONAL_EXAM_SCHEDULE_SOURCE } from '../app/nationalExamSchedule'
import { PROFILE_NAME_KEY } from '../app/onboardingState'
import { useActiveExam } from '../app/useActiveExam'
import type { Progress, Question } from '../domain/studyEngine'
import { zhTW } from '../i18n/zh-TW'
import { SyncCodePanel } from './SyncCodePanel'
import { exportBackup, importBackup } from '../storage/backup'
import { getSyncPass, setSyncPass, syncNow, syncStatusLabel } from '../storage/sync'
import { clearCurrentProfile } from '../storage/leaveProfile'
import './LeaveProfile.css'

const OPTION_RANDOMIZE_KEY = 'level-b-randomize-options'
// The sync code IS the account: functions/api/sync.js stores the cloud copy under
// hash(secret) and never stores the secret, and there is no email or reset. So
// "雲端副本不受影響" is true but useless on its own — clearing the code without
// showing it first strands the backup forever. Surface the code, then wipe.
const switchUserCopy = {
  eyebrow: '本機使用者',
  title: '切換使用者',
  hint: '清除這台裝置上的進度，回到考科與進度代碼設定。適合把手機借給別人，或換你自己的帳號進來。',
  action: '離開此進度',
  cancel: '取消',
  confirm: '我抄好了，清除此機',
  confirmNoCode: '我知道會消失，清除此機',
  switching: '正在切換…',
  // With a code: the cloud copy survives, but only this string can reach it.
  confirmTitle: '先抄下你的進度代碼',
  confirmHint: '雲端副本會保留，但只有這組代碼能取回。清除後代碼不會留在這台裝置，沒抄到就再也拿不回來。',
  codeLabel: '你的進度代碼',
  copyCode: '複製代碼',
  copiedCode: '已複製 ✓',
  // No code: there is no cloud copy at all, so don't imply one.
  confirmTitleNoCode: '這台裝置的進度會永久消失',
  confirmHintNoCode: '你還沒建立進度代碼，所以進度只存在這台裝置，沒有雲端副本。清除後無法復原；想留著就先取消，建立進度代碼或匯出備份。',
}

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
  const [leaving, setLeaving] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  // Read once when the confirm opens: clearCurrentProfile wipes the code, so we
  // must hold it for display rather than re-read it mid-wipe.
  const [leaveCode, setLeaveCode] = useState('')
  const [leaveCodeCopied, setLeaveCodeCopied] = useState(false)
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const [randomizeOptions, setRandomizeOptions] = useState(() => localStorage.getItem(OPTION_RANDOMIZE_KEY) !== 'false')
  const [examDateValue, setExamDateValue] = useState(() => getExamDate() ?? '')
  // One owner for the sync secret: the code panel and the adopt field both read
  // and write this, so they cannot show contradictory state.
  const [syncSecret, setSyncSecret] = useState(() => getSyncPass())
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

  const openLeaveConfirm = () => {
    setLeaveCode(getSyncPass())
    setLeaveCodeCopied(false)
    setLeaveConfirmOpen(true)
  }

  const copyLeaveCode = async () => {
    try {
      await navigator.clipboard.writeText(formatSyncCode(leaveCode))
      setLeaveCodeCopied(true)
    } catch {
      // Clipboard can be blocked; the code is on screen to copy by hand anyway.
      setLeaveCodeCopied(false)
    }
  }

  const handleLeaveProfile = async () => {
    setLeaving(true)
    try {
      await clearCurrentProfile()
      window.location.assign('/app')
    } finally {
      setLeaving(false)
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

      <SyncCodePanel onCodeChange={setSyncSecret} secret={syncSecret} />

      <section className="cloud-sync">
        <div>
          <p className="eyebrow">{zhTW.stats.syncEyebrow}</p>
          <h2>{zhTW.stats.syncTitle}</h2>
          <p>{zhTW.stats.syncHint}</p>
          <p className={syncSecret ? 'sync-status ok' : 'sync-status warn'}>{syncStatusLabel()}</p>
        </div>
        {/* The panel above owns this device's own code. This field is the other
            direction: adopting a code (or an old passphrase) from a device the
            learner already has. Controlled by the same state so the two can
            never disagree about what the secret currently is. */}
        <label>
          <span>{zhTW.stats.syncAdoptLabel}</span>
          <input
            onBlur={(event) => {
              const next = normalizeSyncCode(event.target.value)
              setSyncPass(next)
              setSyncSecret(next)
            }}
            onChange={(event) => setSyncSecret(event.target.value)}
            placeholder={zhTW.stats.syncAdoptPlaceholder}
            value={syncSecret}
          />
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

      <section className="leave-profile">
        <div>
          <p className="eyebrow">{switchUserCopy.eyebrow}</p>
          <h2>{switchUserCopy.title}</h2>
          <p>{switchUserCopy.hint}</p>
        </div>
        {!leaveConfirmOpen ? (
          <button className="secondary-action danger-action" onClick={openLeaveConfirm} type="button">
            <LogOut size={17} /> {switchUserCopy.action}
          </button>
        ) : (
          <div className="leave-profile-confirm" role="alert">
            <strong>{leaveCode ? switchUserCopy.confirmTitle : switchUserCopy.confirmTitleNoCode}</strong>
            <p>{leaveCode ? switchUserCopy.confirmHint : switchUserCopy.confirmHintNoCode}</p>

            {leaveCode ? (
              <div className="leave-profile-code">
                <span>{switchUserCopy.codeLabel}</span>
                <code>{formatSyncCode(leaveCode)}</code>
                <button className="secondary-action" onClick={() => void copyLeaveCode()} type="button">
                  {leaveCodeCopied ? switchUserCopy.copiedCode : switchUserCopy.copyCode}
                </button>
              </div>
            ) : null}

            <div>
              <button className="secondary-action" onClick={() => setLeaveConfirmOpen(false)} type="button">{switchUserCopy.cancel}</button>
              <button className="danger-action" disabled={leaving} onClick={() => void handleLeaveProfile()} type="button">
                <LogOut size={16} />
                {leaving
                  ? switchUserCopy.switching
                  : (leaveCode ? switchUserCopy.confirm : switchUserCopy.confirmNoCode)}
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="build-version">升級吧 {__APP_VERSION__}</p>
    </div>
  )
}
