import { Home, ShoppingBag, Trophy, User } from './icons'
import type { ScreenId } from '../types/game'

interface BottomNavProps {
  active: ScreenId
  onNavigate: (screen: ScreenId) => void
}

const ITEMS: { id: ScreenId; label: string; size: number; Icon: typeof Home }[] = [
  { id: 'home', label: 'Play', size: 22, Icon: Home },
  { id: 'shop', label: 'Shop', size: 22, Icon: ShoppingBag },
  { id: 'tournaments', label: 'Compete', size: 22, Icon: Trophy },
  { id: 'profile', label: 'Profile', size: 22, Icon: User },
]

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const resolved = active === 'modes' || active === 'play' || active === 'boast' ? 'home' : active

  return (
    <nav className="wood-panel bottom-nav" aria-label="Primary">
      {ITEMS.map(({ id, label, size, Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav__item${resolved === id ? ' is-active' : ''}`}
          onClick={() => onNavigate(id === 'home' ? 'home' : id)}
        >
          <Icon size={size} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
