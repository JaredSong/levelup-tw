import { useMemo } from 'react'
import { APP_ICON_DATA_URI, logoGeometry, qrPath } from './qrMarkup'

// Shared QR renderer with a small centre logo. Used by the sync-code handoff
// (SyncCodePanel) and the landing "scan to open on your phone" block. Kept in
// one place so the logo geometry and error-correction level stay in sync.

function QrCenterLogo({ count }: { count: number }) {
  const { box, x, y } = logoGeometry(count)

  return (
    <g aria-hidden="true">
      <rect fill="#ffffff" height={box + 1.2} rx="1.4" width={box + 1.2} x={x - 0.6} y={y - 0.6} />
      <image height={box} href={APP_ICON_DATA_URI} preserveAspectRatio="xMidYMid meet" width={box} x={x} y={y} />
    </g>
  )
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
