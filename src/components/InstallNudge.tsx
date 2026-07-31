import { ArrowRight, X } from 'lucide-react'
import { zhTW } from '../i18n/zh-TW'

interface Props {
  /** Android/Chrome captured a native `beforeinstallprompt` we can fire. */
  canPrompt: boolean
  /** iOS Safari has no programmatic prompt — show the share-sheet hint instead. */
  isIos: boolean
  onInstall: () => void
  onDismiss: () => void
}

// A very quiet, one-line install nudge shown on the session summary — the moment
// someone has just finished practising and is most likely to keep the app. It is
// never a modal and never nags: dismissing (or installing) silences it for good.
export function InstallNudge({ canPrompt, isIos, onInstall, onDismiss }: Props) {
  const t = zhTW.session.installNudge
  if (!canPrompt && !isIos) return null
  return (
    <div className="install-nudge">
      <span className="install-nudge-text">
        {t.text}
        {isIos && !canPrompt ? ` ${t.iosHint}` : ''}
      </span>
      {canPrompt ? (
        <button className="install-nudge-action" onClick={onInstall} type="button">
          {t.action}
          <ArrowRight size={14} />
        </button>
      ) : null}
      <button className="install-nudge-x" onClick={onDismiss} type="button" aria-label={t.dismiss}>
        <X size={15} />
      </button>
    </div>
  )
}
