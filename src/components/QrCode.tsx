import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

// Shared QR renderer with a small centre logo. Used by the sync-code handoff
// (SyncCodePanel) and the landing "scan to open on your phone" block. Kept in
// one place so the logo geometry and error-correction level stay in sync.

const APP_ICON_SVG = '<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_19_191)"><path d="M408 0H104C46.5624 0 0 46.5624 0 104V408C0 465.438 46.5624 512 104 512H408C465.438 512 512 465.438 512 408V104C512 46.5624 465.438 0 408 0Z" fill="#111713"/><path d="M112 124H400V388H112V124Z" fill="#EEF0E9"/><path d="M112 124H400V196H112V124Z" fill="#2B7650"/><path d="M151 170C156.523 170 161 165.523 161 160C161 154.477 156.523 150 151 150C145.477 150 141 154.477 141 160C141 165.523 145.477 170 151 170Z" fill="#EF765E"/><path d="M183 170C188.523 170 193 165.523 193 160C193 154.477 188.523 150 183 150C177.477 150 173 154.477 173 160C173 165.523 177.477 170 183 170Z" fill="#E5B64B"/><path d="M215 170C220.523 170 225 165.523 225 160C225 154.477 220.523 150 215 150C209.477 150 205 154.477 205 160C205 165.523 209.477 170 215 170Z" fill="#EEF0E9"/><path d="M256 233L322 299H283.5V343H228.5V299H190L256 233Z" fill="#2F9B6D"/><path opacity="0.16" d="M256 252L211 296.584H241V331H271V296.584H301L256 252Z" fill="#111713"/><path d="M256 233L322 299H283.5V343H228.5V299H190L256 233Z" stroke="#111713" stroke-width="10" stroke-linejoin="round"/></g><defs><clipPath id="clip0_19_191"><rect width="512" height="512" fill="white"/></clipPath></defs></svg>'
const APP_ICON_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(APP_ICON_SVG)}`

/**
 * Builds the QR module path. SVG rather than canvas so it stays crisp at any
 * size, prints, and survives a screenshot at whatever DPI the phone uses.
 */
export function qrPath(text: string) {
  // Type 0 = smallest version that fits; H = ~30% error correction, which gives
  // enough room for a small centre logo without making the scan fragile.
  const qr = qrcode(0, 'H')
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

function logoGeometry(count: number) {
  const box = count * 0.24
  const x = (count - box) / 2
  const y = x
  return { box, x, y }
}

function QrCenterLogo({ count }: { count: number }) {
  const { box, x, y } = logoGeometry(count)

  return (
    <g aria-hidden="true">
      <rect fill="#ffffff" height={box + 1.2} rx="1.4" width={box + 1.2} x={x - 0.6} y={y - 0.6} />
      <image height={box} href={APP_ICON_DATA_URI} preserveAspectRatio="xMidYMid meet" width={box} x={x} y={y} />
    </g>
  )
}

function qrCenterLogoMarkup(count: number) {
  const { box, x, y } = logoGeometry(count)
  return `<g aria-hidden="true"><rect fill="#ffffff" x="${x - 0.6}" y="${y - 0.6}" width="${box + 1.2}" height="${box + 1.2}" rx="1.4"/><image href="${APP_ICON_DATA_URI}" x="${x}" y="${y}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/></g>`
}

/** Standalone SVG string, for downloading the QR as a file. */
export function qrSvgMarkup(text: string) {
  const path = qrPath(text)
  const size = path.count + 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${size} ${size}" width="640" height="640"><rect fill="#ffffff" x="-1" y="-1" width="${size}" height="${size}"/><path fill="#18201b" d="${path.d}"/>${qrCenterLogoMarkup(path.count)}</svg>`
}

export function QrSvg({
  text,
  ariaLabel,
  size = 168,
  className = 'sync-qr',
}: {
  text: string
  ariaLabel: string
  size?: number
  className?: string
}) {
  const path = useMemo(() => qrPath(text), [text])

  return (
    <svg
      className={className}
      height={size}
      role="img"
      aria-label={ariaLabel}
      viewBox={`-1 -1 ${path.count + 2} ${path.count + 2}`}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#ffffff" height={path.count + 2} width={path.count + 2} x="-1" y="-1" />
      <path d={path.d} fill="#18201b" />
      <QrCenterLogo count={path.count} />
    </svg>
  )
}
