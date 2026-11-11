import { BarChart3, Dumbbell, Home, Layers3, Timer } from 'lucide-react'
import { useEffect } from 'react'
import { installStandaloneViewportFix } from '../app/standaloneViewport'
import { zhTW } from '../i18n/zh-TW'

export type Tab = 'home' | 'practice' | 'review' | 'mock' | 'insights'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const items = [
  { id: 'home' as const, label: zhTW.nav.home, Icon: Home },
  { id: 'practice' as const, label: zhTW.nav.practice, Icon: Dumbbell },
  { id: 'review' as const, label: zhTW.nav.review, Icon: Layers3 },
  { id: 'mock' as const, label: zhTW.nav.mock, Icon: Timer },
  { id: 'insights' as const, label: zhTW.nav.insights, Icon: BarChart3 },
]

export function BottomNav({ active, onChange }: Props) {
  // The bar is the fixed element iOS misplaces; it owns the workaround.
  useEffect(() => installStandaloneViewportFix(window as unknown as Parameters<typeof installStandaloneViewportFix>[0]), [])
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {items.map(({ id, label, Icon }) => (
        <button
          className={active === id ? 'nav-item active' : 'nav-item'}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
