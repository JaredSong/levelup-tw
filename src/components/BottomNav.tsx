import { BarChart3, BookOpen, LibraryBig } from 'lucide-react'

export type Tab = 'study' | 'library' | 'stats'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const items = [
  { id: 'study' as const, label: 'Study', Icon: BookOpen },
  { id: 'library' as const, label: 'Items', Icon: LibraryBig },
  { id: 'stats' as const, label: 'Progress', Icon: BarChart3 },
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
