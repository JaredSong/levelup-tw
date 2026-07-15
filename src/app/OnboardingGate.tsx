import { Camera, Database, KeyRound, Search, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatSyncCode, isValidSyncCode, normalizeSyncCode, readSyncLink } from '../app/syncCode'
import { zhTW } from '../i18n/zh-TW'
import { setSyncPass } from '../storage/sync'
import { ONBOARDING_DONE_KEY, PROFILE_NAME_KEY } from './onboardingState'
import { useActiveExam } from './useActiveExam'

interface Props {
  onComplete: () => void
}

interface BarcodeDetection {
  rawValue?: string
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: HTMLVideoElement): Promise<BarcodeDetection[]>
}

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null
}

// Subject comes first because it is the only answer the app actually needs to
// work, and it is the shortest path to studying. The name is a greeting and the
// passphrase only matters to the minority who already have another device, so
// both wait until after the real choice is made.
export function OnboardingGate({ onComplete }: Props) {
  const { activeExam, installedExams, setActiveExamId } = useActiveExam()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(() => localStorage.getItem(PROFILE_NAME_KEY) ?? '')
  const scannedCode = readSyncLink(window.location.hash)
  const [restoring, setRestoring] = useState(() => Boolean(scannedCode))
  const [passphrase, setPassphrase] = useState(() => scannedCode ? formatSyncCode(scannedCode) : '')
  const [examId, setExamId] = useState(activeExam.examId)
  const [subjectNameSearch, setSubjectNameSearch] = useState('')
  const [subjectCodeSearch, setSubjectCodeSearch] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerMsg, setScannerMsg] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const scannerActiveRef = useRef(false)
  const normalizedNameSearch = subjectNameSearch.trim().toLowerCase()
  const normalizedCodeSearch = subjectCodeSearch.trim().toLowerCase()
  const filteredExams = useMemo(() => {
    if (!normalizedNameSearch && !normalizedCodeSearch) return installedExams
    return installedExams.filter((exam) => {
      const nameHaystack = [
        exam.titleZh,
        exam.titleEn,
        exam.category,
        exam.level,
        ...exam.sections.map((section) => section.titleZh),
      ].join(' ').toLowerCase()
      const codeHaystack = [
        exam.examId,
        exam.version,
        exam.sourceRevision,
        ...exam.sections.flatMap((section) => [section.id, section.subjectCode]),
      ].join(' ').toLowerCase()
      return (!normalizedNameSearch || nameHaystack.includes(normalizedNameSearch))
        && (!normalizedCodeSearch || codeHaystack.includes(normalizedCodeSearch))
    })
  }, [installedExams, normalizedCodeSearch, normalizedNameSearch])
  const selectedExamId = filteredExams.some((exam) => exam.examId === examId)
    ? examId
    : filteredExams[0]?.examId ?? examId

  const trimmedName = name.trim()
  const normalizedPassphrase = normalizeSyncCode(passphrase)
  // Restoring keys the cloud record on name + passphrase, so an empty name or a
  // too-short passphrase would quietly resolve to somebody else's record (or an
  // empty one) instead of this learner's progress. Block rather than mislead.
  const restoreError = !restoring
    ? null
    : !isValidSyncCode(passphrase)
      ? zhTW.onboarding.syncInvalidCode
      : null

  const stopScanner = useCallback(() => {
    scannerActiveRef.current = false
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScannerOpen(false)
  }, [])

  useEffect(() => () => stopScanner(), [stopScanner])

  const acceptScannedValue = useCallback((value: string) => {
    const code = readSyncLink(value) ?? (isValidSyncCode(value) ? normalizeSyncCode(value) : null)
    if (!code) return false
    setRestoring(true)
    setPassphrase(formatSyncCode(code))
    setScannerMsg(zhTW.onboarding.scanSuccess)
    stopScanner()
    return true
  }, [stopScanner])

  const startScanner = async () => {
    setRestoring(true)
    setScannerMsg(null)
    const Detector = getBarcodeDetector()
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScannerMsg(zhTW.onboarding.scanUnsupported)
      return
    }

    setScannerOpen(true)
    setScannerMsg(zhTW.onboarding.scanStarting)
    scannerActiveRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      })
      if (!scannerActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScannerMsg(zhTW.onboarding.scanLooking)

      const detector = new Detector({ formats: ['qr_code'] })
      const scan = async () => {
        if (!scannerActiveRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          const found = codes.some((code) => code.rawValue ? acceptScannedValue(code.rawValue) : false)
          if (found) return
        } catch {
          // Keep scanning; a half-ready video frame can fail transiently.
        }
        if (scannerActiveRef.current) frameRef.current = requestAnimationFrame(() => void scan())
      }
      frameRef.current = requestAnimationFrame(() => void scan())
    } catch {
      stopScanner()
      setScannerMsg(zhTW.onboarding.scanPermissionDenied)
    }
  }

  const complete = () => {
    if (restoreError) return
    if (trimmedName) localStorage.setItem(PROFILE_NAME_KEY, trimmedName)
    else localStorage.removeItem(PROFILE_NAME_KEY)
    // Only a deliberate restore stores a sync code; leaving the panel closed is
    // what "local only" means, so a half-typed value can never enable sync.
    if (restoring && normalizedPassphrase) setSyncPass(normalizedPassphrase)
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
            <section className="onboarding-scan-card">
              <div>
                <p className="onboarding-restore-head"><Camera size={15} /> {zhTW.onboarding.scanTitle}</p>
                <p className="onboarding-restore-hint">{zhTW.onboarding.scanHint}</p>
              </div>
              <button className="onboarding-restore-toggle" onClick={() => void startScanner()} type="button">
                <Camera size={15} /> {zhTW.onboarding.scanCamera}
              </button>
              {restoring ? (
                <label className="onboarding-code-field">
                  <span>{scannedCode ? zhTW.onboarding.scannedCodeDetected : zhTW.onboarding.syncCodeLabel}</span>
                  <input
                    inputMode="text"
                    onChange={(event) => setPassphrase(event.target.value)}
                    placeholder={zhTW.onboarding.syncCodePlaceholder}
                    value={passphrase}
                  />
                  {restoreError ? <em>{restoreError}</em> : null}
                </label>
              ) : (
                <button className="onboarding-restore-toggle" onClick={() => setRestoring(true)} type="button">
                  <KeyRound size={15} /> {zhTW.onboarding.restoreToggle}
                </button>
              )}
              {scannerOpen ? (
                <div className="onboarding-scanner">
                  <video ref={videoRef} playsInline muted />
                  <button className="secondary-action" onClick={stopScanner} type="button">
                    <X size={16} /> {zhTW.onboarding.scanCancel}
                  </button>
                </div>
              ) : null}
              {scannerMsg ? <p className={scannerMsg === zhTW.onboarding.scanSuccess ? 'scan-msg ok' : 'scan-msg'}>{scannerMsg}</p> : null}
            </section>
            <div className="onboarding-search-grid">
              <label className="onboarding-subject-search">
                <Search size={17} />
                <span>{zhTW.onboarding.subjectCodeSearch}</span>
                <input
                  aria-label={zhTW.onboarding.subjectCodeSearch}
                  onChange={(event) => setSubjectCodeSearch(event.target.value)}
                  placeholder={zhTW.onboarding.subjectCodeSearchPlaceholder}
                  type="search"
                  value={subjectCodeSearch}
                />
              </label>
              <label className="onboarding-subject-search">
                <Search size={17} />
                <span>{zhTW.onboarding.subjectNameSearch}</span>
                <input
                  aria-label={zhTW.onboarding.subjectNameSearch}
                  onChange={(event) => setSubjectNameSearch(event.target.value)}
                  placeholder={zhTW.onboarding.subjectNameSearchPlaceholder}
                  type="search"
                  value={subjectNameSearch}
                />
              </label>
            </div>
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
                  <span>{zhTW.onboarding.syncCodeLabel}</span>
                  <input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder={zhTW.onboarding.syncCodePlaceholder} />
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
