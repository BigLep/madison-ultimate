"use client"

import { Home, User, Calendar, Trophy, type LucideIcon } from 'lucide-react'

export type PortalScreen = 'home' | 'player' | 'practices' | 'games'

/** Bottom nav height (excluding the safe-area inset); anything fixed to the bottom sits above it. */
export const PORTAL_NAV_HEIGHT_PX = 68

// Hash routing keeps last season's bookmarks and the PWA start URL working
// (docs/fall-2026/player-portal-grill.md Q8). Legacy hashes map onto the same four tabs.
export const HASH_TO_SCREEN: Record<string, PortalScreen> = {
  '#home': 'home',
  '#season': 'home',
  '#help': 'home',
  '#player': 'player',
  '#player-info': 'player',
  '#practices': 'practices',
  '#games': 'games',
}

export const SCREEN_TO_HASH: Record<PortalScreen, string> = {
  home: '#home',
  player: '#player',
  practices: '#practices',
  games: '#games',
}

const NAV_ITEMS: Array<BottomTabItem<PortalScreen>> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'player', label: 'Player', icon: User },
  { id: 'practices', label: 'Practices', icon: Calendar },
  { id: 'games', label: 'Games', icon: Trophy },
]

export function PortalNav({ active, onChange }: { active: PortalScreen; onChange: (screen: PortalScreen) => void }) {
  return <BottomTabNav label="Player Portal" items={NAV_ITEMS} active={active} onChange={onChange} />
}

export interface BottomTabItem<T extends string> {
  id: T
  label: string
  icon: LucideIcon
}

/** The sticky bottom tab bar shared by the Player Portal and Coach Home. */
export function BottomTabNav<T extends string>({
  label,
  items,
  active,
  onChange,
}: {
  label: string
  items: Array<BottomTabItem<T>>
  active: T
  onChange: (screen: T) => void
}) {
  return (
    <div className="sticky bottom-0 z-40 border-t shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto">
        <nav aria-label={label} className="flex" style={{ height: `calc(${PORTAL_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {items.map(item => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                type="button"
                key={item.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(item.id)}
                className={`flex-1 py-2 px-1 text-center transition-colors ${
                  isActive ? 'text-[var(--page-title)] bg-[var(--primary-bg)]' : 'text-[var(--secondary-text)] bg-transparent'
                }`}
              >
                <Icon className="w-5 h-5 mx-auto mb-1" aria-hidden="true" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
