import qrcode from 'qrcode-generator'
import { Check, Copy, Download, QrCode, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildSyncLink, formatSyncCode, generateSyncCode, isValidSyncCode } from '../app/syncCode'
import { zhTW } from '../i18n/zh-TW'
import { setSyncPass } from '../storage/sync'

interface Props {
  /** The sync secret this device currently uses. Owned by SettingsView. */
  secret: string
  onCodeChange: (code: string) => void
}

/**
 * Renders the handoff link as an inline SVG. SVG rather than canvas so it stays
 * crisp at any size, prints, and survives a screenshot at whatever DPI the
 * phone uses.
 */
function qrPath(text: string) {
  // Type 0 = smallest version that fits; M = ~15% error correction, enough to
  // survive a screenshot re-crop without bloating the module count.
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  let d = ''
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`
    }
  }
  return { d, count }
}

function QrSvg({ text, size = 168 }: { text: string; size?: number }) {
  const path = useMemo(() => qrPath(text), [text])

  return (
    <svg
      className="sync-qr"
      height={size}
      role="img"
      aria-label={zhTW.stats.syncCodeQrAlt}
      viewBox={`-1 -1 ${path.count + 2} ${path.count + 2}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#ffffff" height={path.count + 2} width={path.count + 2} x="-1" y="-1" />
      <path d={path.d} fill="#18201b" />
    </svg>
  )
}

function qrSvgMarkup(text: string) {
  const path = qrPath(text)
  const size = path.count + 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${size} ${size}" width="640" height="640"><rect fill="#ffffff" x="-1" y="-1" width="${size}" height="${size}"/><path fill="#18201b" d="${path.d}"/></svg>`
}

// The sync code replaces "remember a passphrase". It cannot be remembered, so it
// has to be findable: this panel is permanent, not a one-time onboarding screen.
// A learner who swipes away or loses a screenshot can always come back here —
// as long as they still have a device that is signed in. If they don't, the
// backup export is the real recovery path, which the copy says plainly.
export function SyncCodePanel({ secret, onCodeChange }: Props) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  // Checks the alphabet, not just the length: a self-chosen 12-character
  // passphrase formats to the same shape as a generated code.
  const isGenerated = isValidSyncCode(secret)

  // Only a real code makes a scannable link; a legacy passphrase is the
  // learner's own secret and has no business in a QR.
  const link = isGenerated ? buildSyncLink(secret, window.location.origin) : ''

  const claimCode = () => {
    const next = generateSyncCode()
    setSyncPass(next)
    onCodeChange(next)
    setShowQr(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatSyncCode(secret))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const downloadQr = () => {
    if (!link) return
    const blob = new Blob([qrSvgMarkup(link)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `level-up-sync-${formatSyncCode(secret)}.svg`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="sync-code">
      <div>
        <p className="eyebrow">{zhTW.stats.syncCodeEyebrow}</p>
        <h2>{zhTW.stats.syncCodeTitle}</h2>
        <p>{zhTW.stats.syncCodeHint}</p>
      </div>

      {!secret ? (
        <button className="secondary-action" onClick={claimCode} type="button">{zhTW.stats.syncCodeCreate}</button>
      ) : (
        <>
          <p className="sync-code-value">{formatSyncCode(secret)}</p>
          <div className="sync-code-actions">
            <button className="secondary-action" onClick={() => void copy()} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? zhTW.stats.syncCodeCopied : zhTW.stats.syncCodeCopy}
            </button>
            {isGenerated ? (
              <button className="secondary-action" onClick={() => setShowQr((value) => !value)} type="button">
                <QrCode size={16} /> {showQr ? zhTW.stats.syncCodeHideQr : zhTW.stats.syncCodeShowQr}
              </button>
            ) : null}
          </div>

          {showQr && link ? (
            <div className="sync-qr-block">
              <QrSvg text={link} />
              <button className="secondary-action compact" onClick={downloadQr} type="button">
                <Download size={15} /> {zhTW.stats.syncCodeDownloadQr}
              </button>
              <p>{zhTW.stats.syncCodeQrHint}</p>
            </div>
          ) : null}

          {!isGenerated ? (
            // Pre-code devices are still on a self-chosen passphrase, which is
            // short enough to guess into. Offer the swap, but never force it:
            // re-keying strands any other device still using the old one.
            <div className="sync-code-upgrade">
              <p>{zhTW.stats.syncCodeLegacy}</p>
              <button className="secondary-action" onClick={claimCode} type="button">
                <RefreshCw size={15} /> {zhTW.stats.syncCodeUpgrade}
              </button>
            </div>
          ) : null}

          {/* The code is a key, not a backup. Say so where the false sense of
              security would otherwise form. */}
          <p className="sync-code-note">{zhTW.stats.syncCodeBackupNote}</p>
        </>
      )}
    </section>
  )
}
