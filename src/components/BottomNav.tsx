import { BarChart3, Dumbbell, Home, Layers3, Timer } from 'lucide-react'

export type Tab = 'home' | 'practice' | 'review' | 'mock' | 'insights'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const items = [
  { id: 'home' as const, label: 'Home', Icon: Home },
  { id: 'practice' as const, label: 'Practice', Icon: Dumbbell },
  { id: 'review' as const, label: 'Review', Icon: Layers3 },
  { id: 'mock' as const, label: 'Mock', Icon: Timer },
  { id: 'insights' as const, label: 'Insights', Icon: BarChart3 },
]

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
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
